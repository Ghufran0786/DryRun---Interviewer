"use client";

import { Button } from "@/components/ui/Button";
import { FieldInput, FieldLabel, FieldTextarea } from "@/components/ui/Field";
import {
  STRICTNESS_LEVELS,
  TARGET_LEVELS,
  type Strictness,
  type TargetLevel,
} from "@/lib/types";
import type { Settings } from "@prisma/client";
import { useState } from "react";

type SettingsFormProps = {
  initial: Settings;
};

export function SettingsForm({ initial }: SettingsFormProps) {
  const [candidateName, setCandidateName] = useState(initial.candidateName);
  const [defaultTargetLevel, setDefaultTargetLevel] = useState<TargetLevel>(
    TARGET_LEVELS.includes(initial.defaultTargetLevel as TargetLevel)
      ? (initial.defaultTargetLevel as TargetLevel)
      : "SDE-2",
  );
  const [interviewerModel, setInterviewerModel] = useState(
    initial.interviewerModel,
  );
  const [interviewerVisionWarning, setInterviewerVisionWarning] = useState(
    initial.interviewerVisionWarning,
  );
  const [classifierModel, setClassifierModel] = useState(
    initial.classifierModel,
  );
  const [evaluatorModel, setEvaluatorModel] = useState(initial.evaluatorModel);
  const [ttsEnabled, setTtsEnabled] = useState(initial.ttsEnabled);
  const [ttsModel, setTtsModel] = useState(initial.ttsModel);
  const [ttsVoice, setTtsVoice] = useState(initial.ttsVoice);
  const [usingHeadphones, setUsingHeadphones] = useState(
    initial.usingHeadphones,
  );
  const [interviewDurationMin, setInterviewDurationMin] = useState(
    initial.interviewDurationMin,
  );
  const [keyterms, setKeyterms] = useState(initial.keyterms);
  const [strictness, setStrictness] = useState<Strictness>(
    STRICTNESS_LEVELS.includes(initial.strictness as Strictness)
      ? (initial.strictness as Strictness)
      : "Standard",
  );
  const [resumeText, setResumeText] = useState(initial.resumeText);
  const [localEvaluationEnabled, setLocalEvaluationEnabled] = useState(
    initial.localEvaluationEnabled,
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingVoice, setTestingVoice] = useState(false);
  const [voiceResult, setVoiceResult] = useState<string | null>(null);
  const [modelResults, setModelResults] = useState<
    {
      role: string;
      model: string;
      ok: boolean;
      latencyMs: number;
      error?: string;
    }[]
  >([]);

  const inputClass =
    "w-full rounded-[6px] border border-border bg-white px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-foreground";

  async function saveSettings(): Promise<boolean> {
    const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName,
          defaultTargetLevel,
          classifierModel,
          interviewerModel,
          evaluatorModel,
          ttsEnabled,
          ttsModel,
          ttsVoice,
          usingHeadphones,
          interviewDurationMin,
          keyterms,
          strictness,
          resumeText,
          localEvaluationEnabled,
        }),
      });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Failed to save");
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      if (!(await saveSettings())) return;
      setSaved(true);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTestModels() {
    setError(null);
    setSaved(false);
    setModelResults([]);
    setTesting(true);
    try {
      if (!(await saveSettings())) return;
      const response = await fetch("/api/settings/test-models", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to test models");
      }
      const payload = (await response.json()) as {
        results: typeof modelResults;
        interviewerVisionWarning: string;
      };
      setModelResults(payload.results);
      setInterviewerVisionWarning(payload.interviewerVisionWarning);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to test models");
    } finally {
      setTesting(false);
    }
  }

  async function handleTestVoice() {
    setError(null);
    setSaved(false);
    setVoiceResult(null);
    setTestingVoice(true);
    try {
      if (!(await saveSettings())) return;
      const startedAt = performance.now();
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Hello. I am your DryRun interviewer. Let us begin.",
        }),
      });
      if (!response.ok) {
        const payload: unknown = await response.json();
        const message =
          payload &&
          typeof payload === "object" &&
          typeof (payload as Record<string, unknown>).error === "string"
            ? String((payload as Record<string, unknown>).error)
            : `Voice request failed (HTTP ${response.status})`;
        throw new Error(message);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.addEventListener("ended", () => URL.revokeObjectURL(url), {
        once: true,
      });
      audio.addEventListener("error", () => URL.revokeObjectURL(url), {
        once: true,
      });
      await audio.play();
      setVoiceResult(`OK (${Math.round(performance.now() - startedAt)}ms)`);
      setSaved(true);
    } catch (cause) {
      setVoiceResult(
        cause instanceof Error ? cause.message : "Failed to test voice",
      );
    } finally {
      setTestingVoice(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FieldInput
        label="Candidate name"
        name="candidateName"
        value={candidateName}
        onChange={(e) => setCandidateName(e.target.value)}
      />
      <div>
        <FieldLabel label="Default target level" htmlFor="defaultTargetLevel" />
        <select
          id="defaultTargetLevel"
          className={inputClass}
          value={defaultTargetLevel}
          onChange={(e) =>
            setDefaultTargetLevel(e.target.value as TargetLevel)
          }
        >
          {TARGET_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </div>
      <FieldInput
        label="Classifier model"
        name="classifierModel"
        value={classifierModel}
        onChange={(e) => setClassifierModel(e.target.value)}
        hint="Cheap OpenRouter model used to decide whether the interviewer should speak."
      />
      <FieldInput
        label="Interviewer model"
        name="interviewerModel"
        value={interviewerModel}
        onChange={(e) => setInterviewerModel(e.target.value)}
        hint="Any OpenRouter model ID; interviewer model must support image input."
      />
      {interviewerVisionWarning ? (
        <p className="text-sm font-medium text-foreground">
          {interviewerVisionWarning}
        </p>
      ) : null}
      <label className="flex items-start gap-3 text-sm text-foreground">
        <input
          type="checkbox"
          checked={localEvaluationEnabled}
          onChange={(event) => setLocalEvaluationEnabled(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-foreground"
        />
        <span>
          Local evaluation (uses OpenRouter credits)
          <span className="block text-xs text-muted">
            Off = evaluate externally by giving the exported PDF to a strong
            model.
          </span>
        </span>
      </label>
      <FieldInput
        label="Evaluator model"
        name="evaluatorModel"
        value={evaluatorModel}
        onChange={(e) => setEvaluatorModel(e.target.value)}
        hint="Any OpenRouter model ID; used when local evaluation is enabled."
      />
      <fieldset className="space-y-4 rounded-[6px] border border-border bg-background p-4">
        <legend className="px-1 text-[11px] font-semibold uppercase tracking-wider text-foreground">
          Interviewer voice
        </legend>
        <label className="flex items-start gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={ttsEnabled}
            onChange={(event) => setTtsEnabled(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-foreground"
          />
          <span>
            Enable voice
            <span className="block text-xs text-muted">
              Interviewer text always appears first; audio follows asynchronously.
            </span>
          </span>
        </label>
        <FieldInput
          label="TTS model"
          name="ttsModel"
          value={ttsModel}
          onChange={(event) => setTtsModel(event.target.value)}
          hint="OpenRouter speech model ID."
        />
        <FieldInput
          label="TTS voice"
          name="ttsVoice"
          value={ttsVoice}
          onChange={(event) => setTtsVoice(event.target.value)}
          hint="Voice identifier supported by the selected TTS model."
        />
        <label className="flex items-start gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={usingHeadphones}
            onChange={(event) => setUsingHeadphones(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-foreground"
          />
          <span>
            I am using headphones
            <span className="block text-xs text-muted">
              Enables sustained-speech barge-in. Turn this off when using speakers.
            </span>
          </span>
        </label>
        <Button
          type="button"
          variant="secondary"
          disabled={submitting || testing || testingVoice}
          onClick={handleTestVoice}
        >
          {testingVoice ? "Testing voice…" : "Test voice"}
        </Button>
        {voiceResult ? (
          <p className="text-xs text-foreground">{voiceResult}</p>
        ) : null}
      </fieldset>
      <FieldInput
        label="Interview duration (minutes)"
        name="interviewDurationMin"
        type="number"
        min={2}
        max={180}
        value={interviewDurationMin}
        onChange={(e) => setInterviewDurationMin(Number(e.target.value))}
        hint="Controls phase budgets and the automatic wrap-up trigger."
      />
      <FieldTextarea
        label="Keyterms"
        name="keyterms"
        value={keyterms}
        onChange={(e) => setKeyterms(e.target.value)}
        rows={10}
        hint="Nova-3 recognition hints, one term or phrase per line. The first 40 unique terms are used."
      />
      <div>
        <FieldLabel label="Strictness" htmlFor="strictness" />
        <select
          id="strictness"
          className={inputClass}
          value={strictness}
          onChange={(e) => setStrictness(e.target.value as Strictness)}
        >
          {STRICTNESS_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </div>
      <FieldTextarea
        label="Resume text"
        name="resumeText"
        value={resumeText}
        onChange={(e) => setResumeText(e.target.value)}
        rows={12}
        hint="Optional context for the interviewer in later phases."
      />
      {error ? (
        <p className="text-sm font-medium text-foreground">{error}</p>
      ) : null}
      {saved ? (
        <p className="text-sm text-muted">Settings saved.</p>
      ) : null}
      {modelResults.length > 0 ? (
        <div className="space-y-2 rounded-[6px] border border-border bg-background p-3">
          {modelResults.map((result) => (
            <p key={result.role} className="text-xs text-foreground">
              <span className="font-semibold uppercase tracking-wider">
                {result.role}
              </span>{" "}
              — {result.ok ? `OK (${result.latencyMs}ms)` : result.error}
            </p>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={submitting || testing || testingVoice}>
          {submitting ? "Saving…" : "Save settings"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={submitting || testing || testingVoice}
          onClick={handleTestModels}
        >
          {testing ? "Testing…" : "Test models"}
        </Button>
      </div>
    </form>
  );
}
