import { useEffect, useState } from "react";

export function stored(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function persist(key: string, value: string) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

export function useStoredValue<T>(key: string, initial: T, decode: (raw: string) => T) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    function restore() {
      const raw = stored(key);
      if (raw !== null) {
        try { setValue(decode(raw)); } catch { setValue(initial); }
      } else setValue(initial);
    }
    restore();
    const sync = (event: StorageEvent) => { if (event.key === key || event.key === null) restore(); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key, initial, decode]);
  function update(next: T) {
    setValue(next);
    persist(key, String(next));
  }
  return [value, update] as const;
}

type HistoryEntry = {title: string; text: string; date: number};
const historyKey = "neurotype-reading-history-v1";
export function history(): HistoryEntry[] {
  try {
    const entries = JSON.parse(stored(historyKey) || "[]");
    return entries.filter((x: HistoryEntry) => typeof x?.text === "string" && typeof x.title === "string" && Number.isFinite(x.date)).slice(0,15);
  } catch { return []; }
}
export function rememberRead(text: string) {
  if (!text.trim()) return;
  const entry = {title:text.trim().split(/\n/)[0].slice(0,72),text,date:Date.now()};
  if (persist(historyKey, JSON.stringify([entry,...history().filter(x=>x.text!==text)].slice(0,15)))) {
    window.dispatchEvent(new Event("reading-history"));
  }
}
