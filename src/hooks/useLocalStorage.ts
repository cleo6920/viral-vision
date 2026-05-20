import { useEffect } from 'react';

export function useLocalStorage(key: string, state: any) {
  useEffect(() => {
    if (state) {
      localStorage.setItem(key, JSON.stringify(state));
    }
  }, [key, state]);
}

export function getSavedState<T>(key: string): T | null {
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error(`Failed to parse saved state for key ${key}`, e);
    }
  }
  return null;
}
