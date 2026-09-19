import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { Session, Settings } from "@prisma/client";

type DashboardStatsProps = {
  sessions: Session[];
  settings: Settings;
};

export function DashboardStats({ sessions, settings }: DashboardStatsProps) {
  const active = sessions.filter((s) => s.status === "active").length;
  const completed = sessions.filter((s) => s.status === "completed").length;
  const levelLabel = settings.defaultTargetLevel.replace("-", " ");

  return (
    <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        label="Active Runtimes"
        value={String(active).padStart(2, "0")}
        icon="play_circle"
      />
      <StatCard
        label="Completed Rubrics"
        value={String(completed).padStart(2, "0")}
        icon="fact_check"
      />
      <StatCard
        label="Target Architecture Level"
        value={levelLabel}
        icon="architecture"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="flex items-center justify-between rounded bg-white p-4 shadow-sm">
      <div>
        <p className="text-[0.6875rem] font-medium uppercase tracking-widest text-muted">
          {label}
        </p>
        <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-foreground">
          {value}
        </p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded bg-hover text-foreground">
        <MaterialIcon name={icon} className="text-[20px]" />
      </div>
    </div>
  );
}
