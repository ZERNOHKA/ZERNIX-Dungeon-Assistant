"use strict";

const express = require("express");

/**
 * HTTP API, дублирующее IPC-хендлеры ZERNIX (локальная генерация лута/NPC).
 * Основные маршруты: `POST /generate-loot`, `POST /generate-npc` (и зеркала `/api/v1/…`).
 *
 * @param {object} opts
 * @param {number} opts.port
 * @param {string} opts.apiKey — общий секрет с клиентом; пустой = сервер не стартует из main
 * @param {object} opts.handlers
 * @param {(payload: object) => Promise<object>} opts.handlers.generateLoot
 * @param {(payload: object) => Promise<object>} opts.handlers.generateNpc
 * @param {(payload: object) => Promise<object>} opts.handlers.sessionPrep
 * @param {(payload: object) => Promise<object>} opts.handlers.sceneLoot
 */
async function startZernixApiServer({ port, apiKey, handlers }) {
  const app = express();
  app.use(express.json({ limit: "8mb" }));

  function auth(req, res, next) {
    const fromHeader = req.headers["x-zernix-api-key"];
    const bearer =
      typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ")
        ? req.headers.authorization.slice(7).trim()
        : "";
    const key = fromHeader || bearer || "";
    if (!apiKey || key !== apiKey) {
      res.status(401).json({
        ok: false,
        error: "Unauthorized: send header X-Zernix-Api-Key or Authorization: Bearer <key>",
      });
      return;
    }
    next();
  }

  app.get("/api/v1/health", (_req, res) => {
    res.json({ ok: true, service: "zernix-dungeon-assistant", api: 1 });
  });

  /**
   * @param {string} routePath
   * @param {(body: object) => Promise<object>} fn
   */
  function postJson(routePath, fn) {
    app.post(routePath, auth, async (req, res) => {
      try {
        const out = await fn(req.body ?? {});
        res.json(out);
      } catch (e) {
        res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    });
  }

  postJson("/generate-loot", handlers.generateLoot);
  postJson("/api/v1/generate-loot", handlers.generateLoot);

  postJson("/generate-npc", handlers.generateNpc);
  postJson("/api/v1/generate-npc", handlers.generateNpc);
  postJson("/api/v1/invoke-generate-npc", handlers.generateNpc);

  postJson("/api/v1/session-prep-generate", handlers.sessionPrep);

  postJson("/api/v1/scene-loot-generate", handlers.sceneLoot);

  return new Promise((resolve, reject) => {
    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`[ZERNIX] HTTP API на http://0.0.0.0:${port} (POST /generate-loot, /generate-npc, /api/v1/…)`);
      resolve({
        close: () =>
          new Promise((resClose, rejClose) => {
            server.close((err) => (err ? rejClose(err) : resClose()));
          }),
      });
    });
    server.on("error", reject);
  });
}

module.exports = { startZernixApiServer };
