const fs = require("node:fs");

const NEEDLE = `        </label>
      </div>

      <div className="zernix-premium-panel zernix-panel-pad" style={{ marginTop: 22 }}>
        <div className="zernix-panel-heading">Профиль</div>`;

const INSERT = `        </label>

        <div className="zernix-panel-heading" style={{ marginTop: 18 }}>
          Режим отображения (MVP)
        </div>

        <div className="zernix-quick-settings" style={{ marginTop: 10 }}>
          <label className="zernix-toggle-row-mvp">
            <div>
              <div className="zernix-toggle-row-mvp__label">Тёмная тема</div>
              <div className="zernix-toggle-row-mvp__hint">Экстра-контраст для экзамена / вечернего показа.</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.darkMode}
              className={"zernix-switch " + (settings.darkMode ? "is-on" : "") + " zernix-btn-press"}
              onClick={() => {
                patchSettings({ darkMode: !settings.darkMode });
                console.debug("[ZERNIX] settings dark mode", !settings.darkMode);
                showToast("Настройки сохранены");
              }}
            >
              <span className="zernix-switch__knob" />
            </button>
          </label>

          <label className="zernix-toggle-row-mvp">
            <div>
              <div className="zernix-toggle-row-mvp__label">Автосохранение</div>
              <div className="zernix-toggle-row-mvp__hint">
                Переключатель для интерфейса; замечания всё равно пишутся в локальное хранилище bundle.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoSaveNotes}
              className={"zernix-switch " + (settings.autoSaveNotes ? "is-on" : "") + " zernix-btn-press"}
              onClick={() => {
                patchSettings({ autoSaveNotes: !settings.autoSaveNotes });
                console.debug("[ZERNIX] settings autoSaveNotes");
                showToast("Настройки сохранены");
              }}
            >
              <span className="zernix-switch__knob" />
            </button>
          </label>

          <label className="zernix-toggle-row-mvp">
            <div>
              <div className="zernix-toggle-row-mvp__label">Компактный режим</div>
              <div className="zernix-toggle-row-mvp__hint">Эквивалент компактной плотности списков выше.</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.listDensity === "compact"}
              className={
                "zernix-switch " + (settings.listDensity === "compact" ? "is-on" : "") + " zernix-btn-press"
              }
              onClick={() => {
                patchSettings({ listDensity: settings.listDensity === "compact" ? "comfortable" : "compact" });
                console.debug("[ZERNIX] compact toggle");
                showToast("Настройки сохранены");
              }}
            >
              <span className="zernix-switch__knob" />
            </button>
          </label>
        </div>
      </div>

      <div className="zernix-premium-panel zernix-panel-pad" style={{ marginTop: 22 }}>
        <div className="zernix-panel-heading">Профиль</div>`;

const p = "src/zernix/ZernixViews.tsx";
let s = fs.readFileSync(p, "utf8");
if (!s.includes("Режим отображения (MVP)")) {
  if (!s.includes(NEEDLE)) throw new Error("needle not found");
  s = s.replace(NEEDLE, NEEDLE.replace(`      </div>

      <div className="zernix-premium-panel`, INSERT));
}
// Fix: above logic wrong — replaced wrong
