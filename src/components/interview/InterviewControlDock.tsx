"use client";

import { AiVoiceOrb } from "@/components/interview/AiVoiceOrb";
import { HeroMicFab } from "@/components/interview/HeroMicFab";
import { Button } from "@/components/ui/Button";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { DeepgramState } from "@/hooks/useDeepgramLive";

type InterviewControlDockProps = {
  micState: DeepgramState;
  micError: string | null;
  micBusy: boolean;
  interviewerSpeaking: boolean;
  ttsEnabled: boolean;
  interviewerModel: string;
  snapshotCount: number;
  onStartMic: () => void;
  onStopMic: () => void;
  onToggleVoice: () => void;
  voicePreferenceError: string | null;
};

export function InterviewControlDock({
  micState,
  micError,
  micBusy,
  interviewerSpeaking,
  ttsEnabled,
  interviewerModel,
  snapshotCount,
  onStartMic,
  onStopMic,
  onToggleVoice,
  voicePreferenceError,
}: InterviewControlDockProps) {
  return (
    <footer
      className="relative z-30 grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 overflow-hidden border-t border-border bg-white/95 px-2 py-1.5 shadow-[0_-2px_10px_rgba(0,0,0,0.03)] backdrop-blur-sm sm:gap-2 sm:px-4 sm:py-2"
    >
      <div className="hidden min-w-0 flex-col gap-0.5 font-mono text-[0.75rem] text-muted md:flex">
        <div className="flex items-center gap-2 truncate">
          <MaterialIcon name="collections" className="shrink-0 text-[16px]" />
          <span className="tabular-nums">
            Snapshots:{" "}
            <span className="font-medium text-foreground">{snapshotCount}</span>
          </span>
        </div>
        {micError ? (
          <span className="truncate text-foreground" title={micError}>
            {micError}
          </span>
        ) : null}
      </div>

      <div className="col-start-2 justify-self-center">
        <HeroMicFab
          state={micState}
          busy={micBusy}
          onStart={onStartMic}
          onStop={onStopMic}
        />
      </div>

      <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
        <AiVoiceOrb active={interviewerSpeaking} />
        <Button
          type="button"
          variant={ttsEnabled ? "secondary" : "primary"}
          className="shrink-0 text-xs"
          onClick={() => onToggleVoice()}
          title={
            voicePreferenceError ??
            (ttsEnabled
              ? "Mute interviewer voice"
              : "Enable interviewer text-to-speech")
          }
        >
          {ttsEnabled ? "Voice on" : "Turn on voice"}
        </Button>
        <span
          className="hidden max-w-[8rem] truncate font-mono text-[0.7rem] text-muted lg:inline"
          title={interviewerModel}
        >
          {interviewerModel}
        </span>
      </div>
    </footer>
  );
}
