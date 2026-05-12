import { useEffect, useState } from "react";
import type { AppContentJson } from "../types/content";

function contentJsonUrl(): string {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}data/app-content.json`;
}

async function fetchContent(): Promise<AppContentJson> {
  const res = await fetch(contentJsonUrl());
  if (!res.ok) throw new Error(`Failed to load content (${res.status})`);
  return (await res.json()) as AppContentJson;
}

export function useAppContent() {
  const [data, setData] = useState<AppContentJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchContent()
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось загрузить контент.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, error };
}
