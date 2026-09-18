import {
  INTERVIEW_PHASES,
  PHASE_LABELS,
  type InterviewPhase,
} from "@/lib/interviewPhases";

export function PhaseStepper({
  currentPhase,
  onChange,
  disabled = false,
}: {
  currentPhase: InterviewPhase;
  onChange: (phase: InterviewPhase) => void;
  disabled?: boolean;
}) {
  return (
    <nav
      aria-label="Interview phases"
      className="hidden lg:flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#6B6B6B]"
    >
      {INTERVIEW_PHASES.map((phase, index) => {
        const isActive = phase === currentPhase;
        return (
          <span key={phase} className="flex items-center gap-1">
            {index > 0 ? <span className="text-[#E5E5E5]">/</span> : null}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(phase)}
              aria-current={isActive ? "step" : undefined}
              className={
                isActive
                  ? "text-[#0A0A0A] underline decoration-2 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A]"
                  : "hover:text-[#0A0A0A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A] disabled:pointer-events-none"
              }
            >
              {PHASE_LABELS[phase]}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
