import Dexie, { EntityTable } from "dexie";

import { Difficulty, Mode } from "../query/api";
import { Result } from "./Result";

export interface GameState {
  mode: Mode;
  difficulty: Difficulty;
  date: number | null;
  attempts: (string | null)[];
  result: Result;
}

export type GameStateKey = Pick<GameState, "mode" | "difficulty" | "date">;

export const db = new Dexie("kanjidle") as Dexie & {
  game_states: EntityTable<GameState>;
};

db.version(1).stores({
  game_states: "[mode+difficulty+date], attempts, result",
});
