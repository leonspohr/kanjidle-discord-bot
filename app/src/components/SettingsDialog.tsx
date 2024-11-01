import {
  Button,
  Checkbox,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Radio,
  RadioGroup,
} from "@headlessui/react";
import { produce } from "immer";
import { useContext } from "react";
import { flushSync } from "react-dom";
import {
  BiCheckbox,
  BiCheckboxChecked,
  BiDesktop,
  BiMoon,
  BiSun,
  BiX,
} from "react-icons/bi";

import { useJSONLocalStorage } from "../hooks/useLocalStorage";
import SettingsContext from "../providers/SettingsContext";
import { updateTheme } from "../util/theme";

export interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsDialog({
  isOpen,
  onClose,
}: SettingsDialogProps) {
  const [theme, setTheme] = useJSONLocalStorage("theme", "system");
  const [settings, setSettings] = useContext(SettingsContext);

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-20">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/30 backdrop-blur-md duration-200 data-[closed]:backdrop-blur-none"
        onClick={() => onClose()}
      />
      <div className="fixed inset-0 w-screen overflow-y-auto p-4">
        <div className="z-20 flex min-h-full items-center justify-center">
          <DialogPanel
            transition
            className="z-10 flex max-w-[500px] flex-col items-center justify-center gap-4 rounded-lg border border-zinc-600 bg-zinc-100 p-4 text-2xl text-zinc-900 shadow-lg transition-opacity duration-200 ease-out data-[closed]:opacity-0 lg:text-3xl xl:text-4xl dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-zinc-800"
          >
            <div className="flex w-full items-center justify-between">
              <DialogTitle>設定</DialogTitle>
              <Button
                className="rounded-lg border border-zinc-600 p-1 hover:bg-zinc-600 hover:text-zinc-200 active:bg-zinc-600"
                onClick={() => onClose()}
              >
                <BiX />
              </Button>
            </div>
            <div className="flex w-full flex-col items-center justify-start gap-4 text-base lg:text-lg xl:text-xl">
              <div className="flex w-full flex-row items-center justify-start gap-4">
                <span className="min-w-[12ch]">ページの配色</span>
                <RadioGroup
                  className="flex flex-col"
                  value={theme}
                  onChange={(theme) => {
                    flushSync(() => {
                      setTheme(theme);
                    });
                    updateTheme();
                  }}
                >
                  <Radio
                    value="dark"
                    as="button"
                    className="flex h-[3ch] flex-row items-center justify-start gap-2 rounded-md rounded-b-none border border-zinc-600 px-2 text-center hover:bg-zinc-600 hover:text-zinc-200 active:bg-zinc-600 data-[checked]:bg-zinc-600 data-[checked]:text-zinc-200"
                  >
                    <BiSun />
                    <span>ダークモード</span>
                  </Radio>
                  <Radio
                    value="light"
                    as="button"
                    className="flex h-[3ch] flex-row items-center justify-start gap-2 rounded-md rounded-b-none rounded-t-none border border-b-0 border-t-0 border-zinc-600 px-2 text-center hover:bg-zinc-600 hover:text-zinc-200 active:bg-zinc-600 data-[checked]:bg-zinc-600 data-[checked]:text-zinc-200"
                  >
                    <BiMoon />
                    <span>ライトモード</span>
                  </Radio>
                  <Radio
                    value="system"
                    as="button"
                    className="flex h-[3ch] flex-row items-center justify-start gap-2 rounded-md rounded-t-none border border-zinc-600 px-2 text-center hover:bg-zinc-600 hover:text-zinc-200 active:bg-zinc-600 data-[checked]:bg-zinc-600 data-[checked]:text-zinc-200"
                  >
                    <BiDesktop />
                    <span>システム</span>
                  </Radio>
                </RadioGroup>
              </div>
              <div className="flex w-full flex-row items-center justify-start gap-4">
                <span className="min-w-[12ch]">ゲーム設定</span>
                <div className="flex flex-row items-center justify-start gap-2">
                  <Checkbox
                    as="button"
                    className="flex min-h-[3ch] flex-row items-center justify-start gap-2 rounded-md border border-zinc-600 px-2 text-center hover:bg-zinc-600 hover:text-zinc-200 active:bg-zinc-600 data-[checked]:bg-zinc-600 data-[checked]:text-zinc-200"
                    checked={settings.showWords}
                    onChange={(v) => {
                      setSettings(
                        produce(settings, (t) => {
                          t.showWords = v;
                        }),
                      );
                    }}
                  >
                    <span className="scale-150">
                      {settings.showWords ? (
                        <BiCheckboxChecked />
                      ) : (
                        <BiCheckbox />
                      )}
                    </span>
                    <span>ヒントに熟語を表示</span>
                  </Checkbox>
                </div>
              </div>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
