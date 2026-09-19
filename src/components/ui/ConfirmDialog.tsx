"use client";

import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useEffect, useId, useRef } from "react";

export type ConfirmDialogMeta = {
  sessionId: string;
  level: string;
  durationLabel?: string;
  snapshotCount?: number;
};

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirming?: boolean;
  meta?: ConfirmDialogMeta;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  confirming = false,
  meta,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !confirming) {
        onCancel();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, confirming, onCancel]);

  if (!open) {
    return null;
  }

  const shortId =
    meta && meta.sessionId.length > 8
      ? meta.sessionId.slice(0, 8)
      : meta?.sessionId;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        aria-label="Close dialog"
        disabled={confirming}
        onClick={() => {
          if (!confirming) {
            onCancel();
          }
        }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative z-10 flex w-full max-w-[480px] flex-col rounded-xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-3 flex w-full items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded bg-hover px-2 py-0.5 text-foreground">
            <MaterialIcon name="warning" className="text-[15px]" filled />
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wider">
              Destructive Action
            </span>
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            disabled={confirming}
            className="flex h-7 w-7 items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground"
            onClick={() => {
              if (!confirming) {
                onCancel();
              }
            }}
          >
            <MaterialIcon name="close" className="text-[18px]" />
          </button>
        </div>
        <h2
          id={titleId}
          className="text-lg font-semibold text-foreground"
        >
          {title}
        </h2>
        <p
          id={descriptionId}
          className="mt-2 text-[0.8125rem] leading-relaxed text-muted"
        >
          {description}
        </p>
        {meta ? (
          <div className="my-4 flex flex-col gap-1.5 rounded bg-hover p-3">
            <div className="flex items-center justify-between font-mono text-[0.8125rem] text-foreground">
              <span className="flex items-center gap-1">
                <MaterialIcon name="fingerprint" className="text-[13px] text-muted" />
                ID: {shortId}
              </span>
              <span className="text-muted">LEVEL: {meta.level}</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[0.8125rem] text-muted">
              {meta.durationLabel ? (
                <span className="flex items-center gap-1">
                  <MaterialIcon name="timer" className="text-[13px]" />
                  {meta.durationLabel}
                </span>
              ) : (
                <span />
              )}
              {meta.snapshotCount !== undefined ? (
                <span className="flex items-center gap-1">
                  <MaterialIcon name="burst_mode" className="text-[13px]" />
                  {meta.snapshotCount} whiteboard snapshots
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            ref={cancelRef}
            type="button"
            disabled={confirming}
            className="rounded bg-white px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={confirming}
            className="inline-flex items-center gap-2 rounded bg-foreground px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50"
            onClick={onConfirm}
          >
            <MaterialIcon name="delete" className="text-[16px]" />
            <span>{confirming ? "Deleting…" : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
