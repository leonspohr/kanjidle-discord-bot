import { useCallback, useState } from "react";

export default function useLocalStorage(
  key: string,
  initial: string,
): [string, (newValue: string) => void, () => void] {
  const first =
    localStorage.getItem(key) ??
    (() => {
      localStorage.setItem(key, initial);
      return initial;
    })();
  const [value, setValue_] = useState(first);
  const setValue = useCallback(
    (newValue: string) => {
      localStorage.setItem(key, newValue);
      setValue_(newValue);
    },
    [key],
  );
  return [value, setValue, () => localStorage.removeItem(key)];
}

export function useJSONLocalStorage<T>(
  key: string,
  initial: T,
): [T, (newValue: T) => void, () => void] {
  return useParsedLocalStorage(
    key,
    initial,
    JSON.parse as (s: string) => T,
    JSON.stringify,
  );
}

export function useParsedLocalStorage<T>(
  key: string,
  initial: T,
  parse: (s: string) => T,
  stringify: (v: T) => string,
): [T, (newValue: T) => void, () => void] {
  const first = localStorage.getItem(key)
    ? parse(localStorage.getItem(key)!)
    : (() => {
        localStorage.setItem(key, stringify(initial));
        return initial;
      })();
  const [value, setValue_] = useState<T>(first);
  const setValue = useCallback(
    (newValue: T) => {
      localStorage.setItem(key, stringify(newValue));
      setValue_(newValue);
    },
    [key, stringify],
  );
  return [value, setValue, () => localStorage.removeItem(key)];
}
