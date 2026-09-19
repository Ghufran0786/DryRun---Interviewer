import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[6px] border border-dashed border-border bg-background px-6 py-12 text-center">
      <span
        className="mb-3 inline-block h-2 w-2 rounded-full border border-foreground bg-transparent"
        aria-hidden
      />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
