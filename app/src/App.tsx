import { Button } from "@headlessui/react";
import { useState } from "react";
import { BiCog } from "react-icons/bi";

import Puzzle from "./components/Puzzle";
import SettingsDialog from "./components/SettingsDialog";
import { useJSONLocalStorage } from "./hooks/useLocalStorage";
import SettingsContext, {
  defaultSettings,
  Settings,
} from "./providers/SettingsContext";

export default function App() {
  const [settingsDialogIsOpen, setSettingsDialogIsOpen] = useState(false);
  const [settings, setSettings] = useJSONLocalStorage<Settings>(
    "settings",
    defaultSettings,
  );

  return (
    <SettingsContext.Provider value={[settings, setSettings]}>
      <div className="h-screen w-screen overflow-y-scroll bg-zinc-100 text-2xl text-zinc-900 lg:text-3xl xl:text-4xl dark:bg-zinc-900 dark:text-zinc-100">
        <div className="grid w-full grid-cols-[1fr,auto,1fr] grid-rows-1 place-items-center p-4 grid-areas-[._title_buttons]">
          <h1 className="grid-in-[title]">Kanjidle・漢字パズル</h1>
          <div className="place-self-end grid-in-[buttons]">
            <Button
              className="rounded-lg border border-zinc-600 p-1 hover:bg-zinc-600 hover:text-zinc-200 active:bg-zinc-600"
              onClick={() => setSettingsDialogIsOpen(true)}
            >
              <BiCog />
            </Button>
            <SettingsDialog
              isOpen={settingsDialogIsOpen}
              onClose={() => setSettingsDialogIsOpen(false)}
            />
          </div>
        </div>
        <Puzzle />
      </div>
    </SettingsContext.Provider>
  );
}
