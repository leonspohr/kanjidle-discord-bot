import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <div className="overflow-y-scroll h-screen bg-zinc-200 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
        <App />
      </div>
    </QueryClientProvider>
  </StrictMode>
);
