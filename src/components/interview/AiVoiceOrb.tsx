"use client";

import { MaterialIcon } from "@/components/ui/MaterialIcon";

type AiVoiceOrbProps = {
  active: boolean;
};

/** Compact interviewer speech indicator — fixed footprint to avoid dock layout shift. */
export function AiVoiceOrb({ active }: AiVoiceOrbProps) {
  if (!active) {
    return (
      <div className="flex h-8 w-[6.5rem] shrink-0 items-center gap-1.5 font-mono text-[0.65rem] text-muted sm:text-[0.75rem]">
        <MaterialIcon name="graphic_eq" className="text-[18px] opacity-40" />
        <span className="uppercase tracking-wider">Evaluator idle</span>
      </div>
    );
  }

  return (
    <div className="flex h-8 w-[6.5rem] shrink-0 items-center gap-1.5 sm:w-[7.5rem]">
      <div
        className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden"
        aria-hidden
      >
        <span className="ai-orb-ring absolute inset-0 rounded-full bg-border/60" />
        <div
          className="relative flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-white"
        >
          <MaterialIcon name="graphic_eq" className="text-[16px]" />
        </div>
      </div>
      <span className="font-mono text-[0.75rem] font-bold uppercase tracking-wider text-foreground">
        AI speaking
      </span>
    </div>
  );
}
