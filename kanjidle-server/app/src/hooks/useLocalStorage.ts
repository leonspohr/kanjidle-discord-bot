import { useCallback, useState } from "react";

export default function useLocalStorage<T extends string>(
  key: string,
  initial: T,
): [T, (newValue: T) => void, () => void] {
  return useParsedLocalStorage(
    key,
    initial,
    (x) => x as T,
    (x) => x,
  );
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
  let first;
  if (localStorage.getItem(key)) {
    try {
      first = parse(localStorage.getItem(key)!);
    } catch (err) {
      console.log("Error on parsing", err);
      localStorage.setItem(key, stringify(initial));
      first = initial;
    }
  } else {
    localStorage.setItem(key, stringify(initial));
    first = initial;
  }
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
