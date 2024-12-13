import { createContext } from "react";

const StatsContext = createContext<[() => void]>(null!);

export default StatsContext;
