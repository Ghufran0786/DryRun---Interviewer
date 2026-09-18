import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[6px] border border-dashed border-[#E5E5E5] bg-[#FAFAFA] px-6 py-12 text-center">
      <span
        className="mb-3 inline-block h-2 w-2 rounded-full border border-[#0A0A0A] bg-transparent"
        aria-hidden
      />
      <h3 className="text-sm font-semibold text-[#0A0A0A]">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-[#6B6B6B]">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
