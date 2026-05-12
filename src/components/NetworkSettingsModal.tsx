import { useEffect, useState } from "react";
import type { NetworkSettingsState } from "../vite-env";
import { GoldButton } from "./GoldButton";

interface NetworkSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function NetworkSettingsModal({ open, onClose }: NetworkSettingsModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serveAsHost, setServeAsHost] = useState(false);
  const [serverPort, setServerPort] = useState(3000);
  const [remoteServerUrl, setRemoteServerUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<Partial<NetworkSettingsState> | null>(null);

  useEffect(() => {
    if (!open || !window.electronAPI?.getNetworkSettings) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    window.electronAPI
      .getNetworkSettings()
      .then((s) => {
        if (cancelled) return;
        setServeAsHost(Boolean(s.serveAsHost));
        setServerPort(typeof s.serverPort === "number" ? s.serverPort : 3000);
        setRemoteServerUrl(s.remoteServerUrl ?? "");
        setApiKey(s.apiKey ?? "");
        setStatus(s);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const save = async () => {
    if (!window.electronAPI?.setNetworkSettings) return;
    setError(null);
    try {
      const res = await window.electronAPI.setNetworkSettings({
        serveAsHost,
        serverPort: Number(serverPort) || 3000,
        remoteServerUrl: remoteServerUrl.trim(),
        apiKey,
      });
      if (res.ok && res.settings) {
        const next = res.settings as NetworkSettingsState;
        setStatus(next);
        if (!next.needsHostConnection) {
          onClose();
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (!open) return null;

  const lockedRemote = Boolean(status?.needsHostConnection);
  const blockBackdrop = loading || lockedRemote;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="net-settings-title"
      onClick={blockBackdrop ? undefined : onClose}
    >
      <div
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-gold/25 bg-[#0c0d12] p-6 shadow-[0_24px_80px_rgba(0,0,0,.65)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="net-settings-title" className="font-serif text-xl text-gold">
          Сеть ZERNIX
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Один .exe может быть сервером с вашей SQLite или клиентом к копии друга. Задайте общий секрет API-ключа на обеих
          сторонах.
        </p>

        {loading ? (
          <p className="mt-6 text-sm text-zinc-500">Загрузка…</p>
        ) : (
          <>
            {status?.envRemoteOverride ? (
              <p className="mt-4 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-100">
                Активна переменная окружения <code className="text-amber-50">REMOTE_SERVER_URL</code> — адрес из этого окна
                может игнорироваться.
              </p>
            ) : null}

            {lockedRemote ? (
              <p className="mt-4 rounded-lg border border-rose-500/45 bg-rose-950/50 px-3 py-3 text-[13px] leading-snug text-rose-50">
                <strong>{status?.clientRemoteRequiredMessage ?? "Подключитесь к серверу хоста"}.</strong> Укажите адрес и API-ключ
                ниже и нажмите «Сохранить». Без соединения генерация лута и NPC недоступна.
              </p>
            ) : null}

            {serveAsHost && remoteServerUrl.trim() ? (
              <p className="mt-4 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-100">
                Заполнены и сервер, и адрес друга: запросы из приложения уйдут на <strong>удалённый</strong> URL (он имеет
                приоритет). Обычно сервер держит только хост, а клиент — только поле «Адрес друга».
              </p>
            ) : null}

            {status?.serving ? (
              <p className="mt-4 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-100">
                HTTP API запущен на порту <strong>{serverPort}</strong> (0.0.0.0).
              </p>
            ) : serveAsHost && apiKey.trim() ? (
              <p className="mt-4 text-[13px] text-zinc-500">После «Сохранить» сервер поднимется, если указан ключ.</p>
            ) : null}

            <label className="mt-6 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={serveAsHost}
                onChange={(e) => setServeAsHost(e.target.checked)}
                className="mt-1 size-4 rounded border-gold/40 text-gold focus:ring-gold/40"
              />
              <span>
                <span className="font-medium text-zinc-200">Стать сервером</span>
                <span className="mt-1 block text-[13px] text-zinc-500">
                  Встроенный HTTP на порту ниже; друг подключается как клиент к вашему адресу / туннелю.
                </span>
              </span>
            </label>

            <label className="mt-4 block">
              <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Порт сервера</span>
              <input
                type="number"
                min={1}
                max={65535}
                value={serverPort}
                onChange={(e) => setServerPort(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-gold/20 bg-black/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-gold/45"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">API-ключ (общий секрет)</span>
              <input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Одинаковый ключ у сервера и у клиента"
                className="mt-1 w-full rounded-xl border border-gold/20 bg-black/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-gold/45"
              />
              <span className="mt-1 block text-[12px] text-zinc-600">
                Заголовок <code className="text-zinc-400">X-Zernix-Api-Key</code> или Bearer. Без ключа сервер не стартует.
              </span>
            </label>

            <label className="mt-6 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={Boolean(remoteServerUrl.trim())}
                onChange={(e) => {
                  if (!e.target.checked) setRemoteServerUrl("");
                }}
                className="mt-1 size-4 rounded border-gold/40 text-gold focus:ring-gold/40"
              />
              <span>
                <span className="font-medium text-zinc-200">Подключиться к другу</span>
                <span className="mt-1 block text-[13px] text-zinc-500">
                  Запросы лута и NPC идут на удалённый URL вместо локальной SQLite.
                </span>
              </span>
            </label>

            <label className="mt-4 block">
              <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Адрес сервера друга</span>
              <input
                type="text"
                value={remoteServerUrl}
                onChange={(e) => setRemoteServerUrl(e.target.value)}
                placeholder="https://xyz.loca.lt или домен без схемы"
                className="mt-1 w-full rounded-xl border border-gold/20 bg-black/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-gold/45"
              />
              {status?.effectiveRemoteUrl ? (
                <span className="mt-1 block text-[12px] text-zinc-500">
                  Эффективный адрес: <code className="text-zinc-400">{status.effectiveRemoteUrl}</code>
                </span>
              ) : null}
            </label>

            {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

            <div className="mt-8 flex flex-wrap gap-3">
              <GoldButton type="button" className="!w-auto px-6" onClick={save}>
                Сохранить
              </GoldButton>
              {!lockedRemote ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-zinc-600 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                >
                  Отмена
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
