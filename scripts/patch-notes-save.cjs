const fs = require("node:fs");
const p = "src/zernix/ZernixViews.tsx";
let s = fs.readFileSync(p, "utf8");

const npcSnippet = `
          </label>
          <button
            type="button"
            className="zernix-btn-primary zernix-mt-lg zernix-btn-press"
            onClick={() => {
              console.debug("[ZERNIX] save npc notes", npcNoteKey);
              showToast("Saved!");
              noteGlow.bump();
            }}
          >
            Сохранить заметки мастера
          </button>
`;

if (!s.includes("save npc notes")) {
  const needle = `              placeholder="Голос, сцена, напоминание — сразу на карточке, без модалок."
            />
          </label>
          {npcBusy ? (`;
  if (!s.includes(needle)) {
    console.error("npc needle not found");
    process.exit(1);
  }
  s = s.replace(needle, `              placeholder="Голос, сцена, напоминание — сразу на карточке, без модалок."
            />${npcSnippet}
          {npcBusy ? (`);
}

const prepNeedle = `              placeholder="Тайминги, проверки, напоминания…"
            />
          </label>
        </div>`;
const prepRepl = `              placeholder="Тайминги, проверки, напоминания…"
            />
          </label>
          <button
            type="button"
            className="zernix-btn-primary zernix-mt-lg zernix-btn-press"
            onClick={() => {
              console.debug("[ZERNIX] save prep:dm notes");
              showToast("Saved!");
              prepNoteGlow.bump();
            }}
          >
            Сохранить заметки подготовки
          </button>
        </div>`;

if (!s.includes("save prep:dm")) {
  if (!s.includes(prepNeedle)) {
    console.error("prep needle not found");
    process.exit(1);
  }
  s = s.replace(prepNeedle, prepRepl);
}

fs.writeFileSync(p, s);
