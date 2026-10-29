'use client';
import { useEffect, useState } from 'react';

export class PlayerRequestError extends Error {
  constructor(public status: number) { super('Player request failed'); }
}
export async function playerRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...options, credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new PlayerRequestError(response.status);
  const result = await response.json();
  return result.data as T;
}

type Resource<T> = { key: string; data?: T; error?: number };
export function usePlayerResource<T>(path: string | null, delay = 0) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Resource<T> | null>(null);
  const key = `${path}:${attempt}`;
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      playerRequest<T>(path, { signal: controller.signal }).then(data => {
        if (!controller.signal.aborted) setResult({ key, data });
      }).catch(error => {
        if (!controller.signal.aborted) setResult({ key, error: error instanceof PlayerRequestError ? error.status : 503 });
      });
    }, delay);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [path, delay, key]);
  const current = path && result?.key === key ? result : null;
  return { data: current?.data, error: current?.error, loading: !!path && !current, retry: () => setAttempt(value => value + 1) };
}
