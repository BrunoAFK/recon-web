import { useState, useCallback } from "react";

export type GroupBy = "none" | "category" | "status";
export type SortBy = "name-asc" | "name-desc";
export type StatusOrder = "ok-first" | "issues-first";

interface Preferences {
  defaultGroupBy: GroupBy;
  defaultSortBy: SortBy;
  defaultStatusOrder: StatusOrder;
}

const STORAGE_KEY = "recon-web-preferences";

const DEFAULTS: Preferences = {
  defaultGroupBy: "none",
  defaultSortBy: "name-asc",
  defaultStatusOrder: "ok-first",
};

function load(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function save(prefs: Preferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage unavailable
  }
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(load);

  const update = useCallback((patch: Partial<Preferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }, []);

  return { prefs, update };
}

export function getDefaultGroupBy(): GroupBy {
  return load().defaultGroupBy;
}

export function getDefaultSortBy(): SortBy {
  return load().defaultSortBy;
}

export function getDefaultStatusOrder(): StatusOrder {
  return load().defaultStatusOrder;
}
