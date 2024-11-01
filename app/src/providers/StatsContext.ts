import { createContext } from "react";

import { Mode } from "../query/api";

const StatsContext = createContext<
  [(mode: Mode) => void, (copyText: string) => void, () => void]
>(null!);

export default StatsContext;
