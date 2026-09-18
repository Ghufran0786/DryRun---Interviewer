import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  filled?: boolean;
};

export function Badge({ children, filled = false }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[6px] border border-[#E5E5E5] px-2 py-0.5 text-xs font-medium text-[#0A0A0A] ${
        filled ? "bg-[#0A0A0A] text-white border-[#0A0A0A]" : "bg-white"
      }`}
    >
      {children}
    </span>
  );
}
