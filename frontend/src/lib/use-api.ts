"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { api } from "./api";

interface Result<T> {
  key: string;
  data?: T;
  error: string | null;
}

/**
 * Loads a GET endpoint. Pass null to skip. `loading` is derived rather than stored: it is
 * true while the last settled response belongs to a different request than the current one.
 */
export function useApi<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<Result<T>>({ key: "", error: null });
  const key = path === null ? "" : `${version}:${path}`;

  useEffect(() => {
    if (path === null) return;
    let cancelled = false;
    api<T>(path)
      .then((data) => !cancelled && setResult({ key, data, error: null }))
      .catch(
        (e: Error) =>
          !cancelled && setResult((prev) => ({ key, data: prev.data, error: e.message })),
      );
    return () => {
      cancelled = true;
    };
  }, [path, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData: Dispatch<SetStateAction<T | undefined>> = useCallback(
    (update) =>
      setResult((prev) => ({
        ...prev,
        data:
          typeof update === "function"
            ? (update as (p: T | undefined) => T | undefined)(prev.data)
            : update,
      })),
    [],
  );

  const settled = result.key === key;
  return {
    // Keep showing the previous data while a reload is in flight, but never data for another path.
    data:
      path === null
        ? undefined
        : settled || result.key.endsWith(`:${path}`)
          ? result.data
          : undefined,
    error: settled ? result.error : null,
    loading: path !== null && !settled,
    reload,
    setData,
  };
}
