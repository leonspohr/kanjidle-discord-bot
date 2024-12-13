import { Button } from "@headlessui/react";
import { useMediaQuery } from "@react-hook/media-query";
import { useEffect, useState } from "react";
import { BiBarChartAlt2, BiCog, BiLogoGithub } from "react-icons/bi";

import Puzzle from "./components/Puzzle";
import SettingsDialog from "./components/SettingsDialog";
import StatsDialog from "./components/StatsDialog";
import { useJSONLocalStorage } from "./hooks/useLocalStorage";
import SettingsContext, {
  defaultSettings,
  Settings,
} from "./providers/SettingsContext";
import StatsContext from "./providers/StatsContext";
import { Difficulty, Mode, Seed } from "./query/api";
import { updateTheme } from "./util/theme";

export default function App() {
  const [settingsDialogIsOpen, setSettingsDialogIsOpen] = useState(false);
  const [settings, setSettings] = useJSONLocalStorage<Settings>(
    "settings",
    defaultSettings,
  );

  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  useEffect(() => {
    updateTheme();
  }, [prefersDark]);

  const [statsDialogIsOpen, setStatsDialogIsOpen] = useState(false);

  const [mode, setMode] = useJSONLocalStorage<Mode>("mode", Mode.Hidden);

  const [seed, setSeed] = useState<Seed>(Seed.Today);

  const [difficulty, setDifficulty] = useJSONLocalStorage<Difficulty>(
    "difficulty",
    Difficulty.Normal,
  );

  return (
    <SettingsContext.Provider value={[settings, setSettings]}>
      <StatsContext.Provider
        value={[
          () => {
            setStatsDialogIsOpen(true);
          },
        ]}
      >
        <div className="h-screen w-screen overflow-y-scroll bg-zinc-100 text-2xl text-zinc-900 lg:text-3xl xl:text-4xl dark:bg-zinc-900 dark:text-zinc-100">
          <div className="flex min-h-[100vh] w-full flex-col items-center justify-between gap-4">
            <div className="container flex flex-col items-center justify-center gap-4">
              <div className="grid w-full grid-cols-[1fr,auto,1fr] grid-rows-1 place-items-center border-b border-stone-600 p-4 grid-areas-[._title_buttons]">
                <h1 className="grid-in-[title]">
                  漢字
                  <ruby className="text-sm lg:text-base xl:text-lg">
                    dle
                    <rt className="-mb-1">パズル</rt>
                  </ruby>
                </h1>
                <div className="flex flex-row gap-2 place-self-end grid-in-[buttons]">
                  <Button
                    className="rounded-lg border border-zinc-600 p-1 hover:bg-zinc-600 hover:text-zinc-200 active:bg-zinc-600"
                    onClick={() => {
                      setStatsDialogIsOpen(true);
                    }}
                  >
                    <BiBarChartAlt2 />
                  </Button>
                  <StatsDialog
                    mode={mode}
                    isOpen={statsDialogIsOpen}
                    onClose={() => setStatsDialogIsOpen(false)}
                  />
                  <Button
                    className="rounded-lg border border-zinc-600 p-1 hover:bg-zinc-600 hover:text-zinc-200 active:bg-zinc-600"
                    onClick={() => {
                      setSettingsDialogIsOpen(true);
                    }}
                  >
                    <BiCog />
                  </Button>
                  <SettingsDialog
                    isOpen={settingsDialogIsOpen}
                    onClose={() => setSettingsDialogIsOpen(false)}
                  />
                </div>
              </div>
              <Puzzle
                mode={mode}
                onModeChange={setMode}
                seed={seed}
                onSeedChange={setSeed}
                difficulty={difficulty}
                onDifficultyChange={setDifficulty}
              />
            </div>
            <div className="container flex h-[4ch] flex-row items-center justify-between border-t border-stone-600 px-2 text-xs text-stone-600 lg:text-sm xl:text-base">
              <span>スコアの記録はブラウザにローカルに保存されます</span>
              <a
                className="scale-150"
                href="https://github.com/1Computer1/kanjidle"
                target="_blank"
                rel="noopener noreferrer"
              >
                <BiLogoGithub />
              </a>
            </div>
          </div>
        </div>
      </StatsContext.Provider>
    </SettingsContext.Provider>
  );
}
