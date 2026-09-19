import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  filled?: boolean;
};

export function Badge({ children, filled = false }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[6px] border border-border px-2 py-0.5 text-xs font-medium text-foreground ${
        filled ? "bg-foreground text-white border-foreground" : "bg-white"
      }`}
    >
      {children}
    </span>
  );
}
