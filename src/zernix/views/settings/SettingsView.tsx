import { useZernixUserData } from "../../../context/ZernixUserDataContext";

export function SettingsView() {
  const { settings, patchSettings, profile, patchProfile, showToast } = useZernixUserData();

  return (
    <div className="zernix-page">
      <div className="zernix-premium-panel zernix-panel-pad">
        <div className="zernix-panel-heading">Интерфейс</div>
        <label className="zernix-field">
          <span className="zernix-field-label">Плотность списков</span>
          <select
            className="zernix-input zernix-select"
            value={settings.listDensity}
            onChange={(e) => patchSettings({ listDensity: e.target.value as "comfortable" | "compact" })}
          >
            <option value="comfortable">Комфортная</option>
            <option value="compact">Компактная</option>
          </select>
        </label>
        <label className="zernix-field">
          <span className="zernix-field-label">Язык справочников</span>
          <select
            className="zernix-input zernix-select"
            value={settings.catalogLang}
            onChange={(e) => patchSettings({ catalogLang: e.target.value as "ru" | "en" })}
          >
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>

      <div className="zernix-premium-panel zernix-panel-pad" style={{ marginTop: 22 }}>
        <div className="zernix-panel-heading">Режим отображения (MVP)</div>
        <div className="zernix-quick-settings" style={{ marginTop: 10 }}>
          <label className="zernix-toggle-row-mvp">
            <div>
              <div className="zernix-toggle-row-mvp__label">Тёмная тема</div>
              <div className="zernix-toggle-row-mvp__hint">Глубже фон — удобно для демонстрации.</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.darkMode}
              className={`zernix-switch ${settings.darkMode ? "is-on" : ""} zernix-btn-press`}
              onClick={() => {
                patchSettings({ darkMode: !settings.darkMode });
                console.debug("[ZERNIX] settings dark", !settings.darkMode);
                showToast("Настройки сохранены");
              }}
            >
              <span className="zernix-switch__knob" />
            </button>
          </label>
          <label className="zernix-toggle-row-mvp">
            <div>
              <div className="zernix-toggle-row-mvp__label">Автосохранение</div>
              <div className="zernix-toggle-row-mvp__hint">Флажок для зачёта; заметки всё равно пишутся в bundle.</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoSaveNotes}
              className={`zernix-switch ${settings.autoSaveNotes ? "is-on" : ""} zernix-btn-press`}
              onClick={() => {
                patchSettings({ autoSaveNotes: !settings.autoSaveNotes });
                showToast("Настройки сохранены");
              }}
            >
              <span className="zernix-switch__knob" />
            </button>
          </label>
          <label className="zernix-toggle-row-mvp">
            <div>
              <div className="zernix-toggle-row-mvp__label">Компактный режим</div>
              <div className="zernix-toggle-row-mvp__hint">Синхронизирован с «Компактная» плотность выше.</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.listDensity === "compact"}
              className={`zernix-switch ${settings.listDensity === "compact" ? "is-on" : ""} zernix-btn-press`}
              onClick={() => {
                patchSettings({ listDensity: settings.listDensity === "compact" ? "comfortable" : "compact" });
                showToast("Настройки сохранены");
              }}
            >
              <span className="zernix-switch__knob" />
            </button>
          </label>
        </div>
      </div>

      <div className="zernix-premium-panel zernix-panel-pad" style={{ marginTop: 22 }}>
        <div className="zernix-panel-heading">Профиль</div>
        <label className="zernix-field">
          <span className="zernix-field-label">Имя на столе</span>
          <input
            className="zernix-input"
            value={profile.displayName}
            onChange={(e) => patchProfile({ displayName: e.target.value })}
            autoComplete="nickname"
          />
        </label>
        <label className="zernix-field">
          <span className="zernix-field-label">Подпись (учебный профиль)</span>
          <input
            className="zernix-input"
            value={profile.affiliation ?? ""}
            onChange={(e) => patchProfile({ affiliation: e.target.value })}
            placeholder="Student · Hexlet College"
          />
        </label>
        <label className="zernix-field">
          <span className="zernix-field-label">Аватар (файл)</span>
          <input
            className="zernix-input"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const url = String(reader.result ?? "");
                if (url.length > 400_000) {
                  window.alert("Файл слишком большой для локального сохранения.");
                  return;
                }
                patchProfile({ avatarDataUrl: url });
              };
              reader.readAsDataURL(file);
              e.target.value = "";
            }}
          />
        </label>
        {profile.avatarDataUrl ? (
          <button
            type="button"
            className="zernix-btn-secondary zernix-mt-lg"
            onClick={() => patchProfile({ avatarDataUrl: "" })}
          >
            Убрать аватар
          </button>
        ) : null}
      </div>
    </div>
  );
}
