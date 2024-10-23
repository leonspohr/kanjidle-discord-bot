import clsx from "clsx";
import { ReactNode } from "react";
import {
  BsCheckCircleFill,
  BsExclamationTriangleFill,
  BsFillXSquareFill,
  BsInfoSquareFill,
} from "react-icons/bs";

export interface CustomToastProps {
  children: ReactNode;
  type: "success" | "error" | "warn" | "info";
}

export default function CustomToast({ children, type }: CustomToastProps) {
  return (
    <div
      className={clsx(
        "rounded-lg border bg-zinc-200 text-lg shadow-md lg:text-xl xl:text-2xl dark:bg-zinc-900 dark:shadow-zinc-800",
        "grid grid-cols-[auto_1fr] items-center gap-2 p-2",
        type === "success" && "border-emerald-600 text-emerald-600",
        type === "error" && "border-rose-600 text-rose-600",
        type === "warn" && "border-amber-600 text-amber-600",
        type === "info" && "border-zinc-600 text-zinc-600",
      )}
    >
      {
        {
          success: <BsCheckCircleFill />,
          error: <BsFillXSquareFill />,
          warn: <BsExclamationTriangleFill />,
          info: <BsInfoSquareFill />,
        }[type]
      }
      <div>{children}</div>
    </div>
  );
}
