const fs = require("node:fs");
const css = `
/* === MVP overlays: modals, dark theme accent, tactile buttons === */

html[data-zernix-dark="1"] {
  --zx-bg: #020308;
  --zx-panel: #080c14;
  --zx-panel-2: #0a101a;
}

.zernix-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(2, 3, 6, 0.72);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: zernix-modal-overlay-in 0.22s var(--zx-ease-out) forwards;
}

@keyframes zernix-modal-overlay-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.zernix-modal-panel {
  width: min(420px, 100%);
  border-radius: var(--zx-radius);
  padding: 0;
  max-height: min(560px, 86dvh);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(212, 169, 58, 0.35);
  box-shadow: var(--zx-float-shadow);
}

.zernix-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid rgba(212, 169, 58, 0.15);
}

.zernix-modal-title {
  margin: 0;
  font-family: var(--zx-font-display);
  font-size: 18px;
  font-weight: 600;
  color: var(--zx-gold-bright);
}

.zernix-modal-close {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid rgba(212, 169, 58, 0.25);
  background: rgba(5, 7, 11, 0.55);
  color: rgba(245, 230, 184, 0.88);
}

.zernix-modal-body {
  padding: 14px 18px 18px;
  overflow-y: auto;
}

.zernix-modal-foot-btn {
  width: 100%;
  margin-top: 14px;
}

.zernix-profile-mvp {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.zernix-profile-mvp__avatar {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: 16px;
  border: 1px solid rgba(212, 169, 58, 0.35);
  background: radial-gradient(circle at 30% 20%, rgba(212, 169, 58, 0.25), transparent 62%), #0a1018;
  display: grid;
  place-items: center;
  font-family: var(--zx-font-display);
  font-weight: 700;
  font-size: 26px;
  color: var(--zx-gold-bright);
}

.zernix-profile-mvp__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.zernix-profile-mvp__name {
  font-family: var(--zx-font-display);
  font-weight: 600;
  font-size: 22px;
  color: var(--zx-text);
}

.zernix-profile-mvp__meta {
  margin-top: 6px;
  font-size: 13px;
  color: rgba(245, 230, 184, 0.58);
}

.zernix-profile-mvp__note {
  margin: 14px 0 0 !important;
  font-size: 12px !important;
  color: rgba(245, 230, 184, 0.55);
}

.zernix-inline-code {
  font-family: ui-monospace, monospace;
  font-size: 0.92em;
  padding: 1px 5px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(212, 169, 58, 0.12);
}

.zernix-quick-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.zernix-toggle-row-mvp {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(212, 169, 58, 0.12);
  background: rgba(5, 7, 11, 0.45);
}

.zernix-toggle-row-mvp__label {
  font-weight: 600;
  font-size: 13px;
  color: rgba(245, 230, 184, 0.92);
}

.zernix-toggle-row-mvp__hint {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.42;
  color: rgba(245, 230, 184, 0.48);
}

.zernix-switch {
  flex-shrink: 0;
  position: relative;
  width: 48px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid rgba(212, 169, 58, 0.28);
  background: rgba(2, 3, 6, 0.75);
}

.zernix-switch.is-on {
  background: linear-gradient(145deg, rgba(212, 169, 58, 0.35), rgba(241, 208, 122, 0.16));
}

.zernix-switch__knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.4), transparent 62%), rgba(245, 230, 184, 0.9);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
  transition: transform var(--zx-dur) var(--zx-ease-out);
}

.zernix-switch.is-on .zernix-switch__knob {
  transform: translateX(20px);
}

.zernix-home-codex-tips {
  margin: 10px 0 0;
  padding-left: 1.05rem;
  color: rgba(245, 230, 184, 0.72);
  font-size: 12px;
  line-height: 1.52;
}

.zernix-home-codex-tips li {
  margin-bottom: 6px;
}

.zernix-btn-press:active {
  transform: scale(0.98);
}

.zernix-icon-btn:active,
.zernix-nav-btn:active,
.zernix-avatar-btn:active {
  transform: translateY(0.5px) scale(0.99);
}

@media (prefers-reduced-motion: reduce) {
  .zernix-switch__knob,
  .zernix-btn-press:active,
  .zernix-icon-btn:active,
  .zernix-nav-btn:active,
  .zernix-avatar-btn:active {
    transition: none;
    transform: none;
  }
}
`;

fs.appendFileSync("src/ZernixTheme.css", css);
