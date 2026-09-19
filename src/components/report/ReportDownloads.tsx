"use client";

import { Button } from "@/components/ui/Button";
import { useState } from "react";

type ReportDownloadsProps = {
  sessionId: string;
  sessionStatus: string;
};

async function downloadFromResponse(response: Response, fallbackName: string) {
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => ({}));
    const message =
      payload &&
      typeof payload === "object" &&
      typeof (payload as Record<string, unknown>).error === "string"
        ? String((payload as Record<string, unknown>).error)
        : `Download failed (HTTP ${response.status})`;
    throw new Error(message);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ReportDownloads({
  sessionId,
  sessionStatus,
}: ReportDownloadsProps) {
  const [pdfState, setPdfState] = useState<"idle" | "loading" | "error">("idle");
  const [zipState, setZipState] = useState<"idle" | "loading" | "error">("idle");
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);

  const canDownload = sessionStatus === "completed";

  async function downloadPdf() {
    setPdfState("loading");
    setPdfError(null);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/report.pdf`);
      await downloadFromResponse(response, "dryrun-report.pdf");
      setPdfState("idle");
    } catch (error) {
      setPdfState("error");
      setPdfError(
        error instanceof Error ? error.message : "PDF download failed — retry",
      );
    }
  }

  async function downloadBundle() {
    setZipState("loading");
    setZipError(null);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/export`);
      await downloadFromResponse(response, "dryrun-bundle.zip");
      setZipState("idle");
    } catch (error) {
      setZipState("error");
      setZipError(
        error instanceof Error
          ? error.message
          : "Bundle download failed — retry",
      );
    }
  }

  if (!canDownload) {
    return (
      <p className="text-sm text-muted">
        Complete the interview to download the PDF or analysis bundle.
      </p>
    );
  }

  return (
    <div className="rounded-[6px] border border-border bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        Downloads
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() => void downloadPdf()}
          disabled={pdfState === "loading"}
        >
          {pdfState === "loading" ? "Preparing PDF…" : "Download PDF"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void downloadBundle()}
          disabled={zipState === "loading"}
        >
          {zipState === "loading"
            ? "Preparing bundle…"
            : "Download analysis bundle"}
        </Button>
      </div>
      <p className="mt-3 text-sm text-muted">
        Unzip the analysis bundle, paste ANALYSIS_PROMPT.md into a strong model,
        and attach the snapshots/ PNGs.
      </p>
      {pdfError ? (
        <p className="mt-2 text-sm text-foreground">{pdfError}</p>
      ) : null}
      {zipError ? (
        <p className="mt-2 text-sm text-foreground">{zipError}</p>
      ) : null}
    </div>
  );
}
