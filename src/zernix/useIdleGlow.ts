import { useCallback, useEffect, useRef, useState } from "react";

/** Короткая подсветка после паузы ввода (ощущение автосохранения). */
export function useIdleGlow(delayMs = 520, glowMs = 480) {
  const [glow, setGlow] = useState(false);
  const idleT = useRef<ReturnType<typeof setTimeout> | undefined>();
  const offT = useRef<ReturnType<typeof setTimeout> | undefined>();

  const bump = useCallback(() => {
    if (idleT.current) clearTimeout(idleT.current);
    if (offT.current) clearTimeout(offT.current);
    idleT.current = setTimeout(() => {
      setGlow(true);
      offT.current = setTimeout(() => setGlow(false), glowMs);
    }, delayMs);
  }, [delayMs, glowMs]);

  useEffect(
    () => () => {
      if (idleT.current) clearTimeout(idleT.current);
      if (offT.current) clearTimeout(offT.current);
    },
    [],
  );

  return { glow, bump };
}
