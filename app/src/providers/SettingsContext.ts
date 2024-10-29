import { createContext } from "react";

export interface Settings {
  showWords: boolean;
}

export const defaultSettings: Settings = {
  showWords: false,
};

const SettingsContext = createContext<[Settings, (newValue: Settings) => void]>(
  null!,
);

export default SettingsContext;
