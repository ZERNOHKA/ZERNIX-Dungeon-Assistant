import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";

import { useZernixUserData } from "../context/ZernixUserDataContext";
import type { ZernixUiSettings } from "../lib/zernixUserStorage";

function useFocusTrap(enabled: boolean, rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!enabled || !rootRef.current) return;
    const root = rootRef.current;
    const prev = document.activeElement as HTMLElement | null;

    const focusable = root.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    first?.focus();

    function onKey(ev: KeyboardEvent) {
      if (ev.key !== "Tab" || focusable.length === 0) return;
      const list = [...focusable];
      const i = list.indexOf(document.activeElement as HTMLElement);
      if (!ev.shiftKey && i === list.length - 1) {
        ev.preventDefault();
        list[0]?.focus();
      } else if (ev.shiftKey && (i <= 0 || i === -1)) {
        ev.preventDefault();
        list[list.length - 1]?.focus();
      }
    }
    root.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [enabled, rootRef]);
}

type TrapProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

function ModalShell({ open, title, onClose, children }: TrapProps) {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, panelRef);

  if (!open) return null;

  return (
    <div
      className="zernix-modal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="zernix-modal-panel zernix-premium-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="zernix-modal-head">
          <h2 id={id} className="zernix-modal-title">
            {title}
          </h2>
          <button type="button" className="zernix-modal-close zernix-btn-press" aria-label="Закрыть" onClick={onClose}>
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <div className="zernix-modal-body">{children}</div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="zernix-toggle-row-mvp">
      <div>
        <div className="zernix-toggle-row-mvp__label">{label}</div>
        <div className="zernix-toggle-row-mvp__hint">{hint}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`zernix-switch ${checked ? "is-on" : ""} zernix-btn-press`}
        onClick={() => {
          console.debug("[ZERNIX] toggle", label, !checked);
          onChange(!checked);
        }}
      >
        <span className="zernix-switch__knob" />
      </button>
    </label>
  );
}

export function ZernixProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useZernixUserData();

  return (
    <ModalShell open={open} title="Профиль" onClose={onClose}>
      <div className="zernix-profile-mvp">
        <div className="zernix-profile-mvp__avatar" aria-hidden>
          {profile.avatarDataUrl ? (
            <img src={profile.avatarDataUrl} alt="" />
          ) : (
            <span>{(profile.displayName || "Z").trim().slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div>
          <div className="zernix-profile-mvp__name">{profile.displayName?.trim() || "ZERNOHKA"}</div>
          <div className="zernix-profile-mvp__meta">
            {(profile.affiliation && profile.affiliation.trim()) || "Student · Hexlet College"}
          </div>
          <p className="zernix-codex__prose zernix-profile-mvp__note">
            Учебный режим MVP — данные профиля сохраняются в <code className="zernix-inline-code">localStorage</code>.
            Полное редактирование: раздел <strong>Настройки</strong> слева в меню.
          </p>
        </div>
      </div>
      <button type="button" className="zernix-btn-primary zernix-modal-foot-btn zernix-btn-press" onClick={onClose}>
        Понятно
      </button>
    </ModalShell>
  );
}

export function ZernixQuickSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, patchSettings, showToast } = useZernixUserData();

  function patch(p: Partial<ZernixUiSettings>) {
    patchSettings(p);
    showToast("Настройки сохранены");
  }

  return (
    <ModalShell open={open} title="Быстрые настройки" onClose={onClose}>
      <div className="zernix-quick-settings">
        <ToggleRow
          label="Тёмная тема"
          hint="Чуть глубже фон и контраст для вечерней сессии."
          checked={Boolean(settings.darkMode)}
          onChange={(v) => patch({ darkMode: v })}
        />
        <ToggleRow
          label="Автосохранение черновиков"
          hint="Заметки пишутся в хранилище при вводе (как и раньше); переключатель — для зачёта UI."
          checked={Boolean(settings.autoSaveNotes)}
          onChange={(v) => patch({ autoSaveNotes: v })}
        />
        <ToggleRow
          label="Компактный режим"
          hint="Плотнее списки и панели (как «Компактная» плотность)."
          checked={settings.listDensity === "compact"}
          onChange={(v) => patch({ listDensity: v ? "compact" : "comfortable" })}
        />
      </div>
      <button type="button" className="zernix-btn-secondary zernix-modal-foot-btn zernix-btn-press" onClick={onClose}>
        Закрыть
      </button>
    </ModalShell>
  );
}
