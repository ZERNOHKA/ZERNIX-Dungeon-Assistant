import { useEffect } from "react";

import { isElectron } from "../lib/isElectron";

/** В Electron: фиксируем viewport, отключаем прокрутку страницы. */
export function useElectronShell(): boolean {
  const desktop = isElectron();

  useEffect(() => {
    const root = document.documentElement;
    if (desktop) {
      root.classList.add("zernix-electron");
    } else {
      root.classList.remove("zernix-electron");
    }
    return () => root.classList.remove("zernix-electron");
  }, [desktop]);

  return desktop;
}
