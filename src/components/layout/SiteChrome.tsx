"use client";

import { FloatingBackground } from "@/components/layout/FloatingBackground";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type SiteChromeProps = {
  children: ReactNode;
  /** Header status chip, e.g. STANDBY or LISTENING */
  runtimeStatus?: string;
  /** When set, interview nav links here; otherwise dashboard with hint */
  interviewHref?: string | null;
  reportHref?: string | null;
  /** Full viewport content below header (interview room) */
  immersive?: boolean;
};

const NAV: {
  id: string;
  label: string;
  href: (ctx: { interviewHref?: string | null; reportHref?: string | null }) => string;
  match: (pathname: string) => boolean;
}[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: () => "/",
    match: (p) => p === "/",
  },
  {
    id: "interview-room",
    label: "Interview Room",
    href: ({ interviewHref }) => interviewHref ?? "/",
    match: (p) => p.startsWith("/interview/"),
  },
  {
    id: "report",
    label: "Report",
    href: ({ reportHref }) => reportHref ?? "/",
    match: (p) => p.startsWith("/report/"),
  },
  {
    id: "settings",
    label: "Settings",
    href: () => "/settings",
    match: (p) => p === "/settings",
  },
  {
    id: "docs",
    label: "Docs & Specs",
    href: () => "/docs",
    match: (p) => p === "/docs",
  },
];

export function SiteChrome({
  children,
  runtimeStatus = "STANDBY",
  interviewHref,
  reportHref,
  immersive = false,
}: SiteChromeProps) {
  const pathname = usePathname();

  return (
    <div
      className={`relative flex flex-col overflow-x-clip bg-background text-foreground ${
        immersive
          ? "h-dvh max-h-dvh overflow-hidden"
          : "min-h-[100dvh]"
      }`}
    >
      {!immersive ? <FloatingBackground /> : null}
      <header
        className="fixed top-0 z-50 w-full border-b border-border/80 bg-background/90 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-md"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="text-base font-bold tracking-tight text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              >
                DryRun
              </Link>
              <span className="rounded bg-hover px-1.5 py-0.5 font-mono text-[0.6875rem] font-medium uppercase tracking-widest text-foreground">
                LOCAL-FIRST
              </span>
            </div>
            <div className="hidden items-center gap-1.5 pl-2 font-mono text-[0.8125rem] text-muted sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
              <span>{runtimeStatus}</span>
            </div>
          </div>
          <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main">
            {NAV.map((item) => {
              const active = item.match(pathname);
              const href = item.href({ interviewHref, reportHref });
              return (
                <Link
                  key={item.id}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded px-3 py-1.5 text-[0.8125rem] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
                    active
                      ? "bg-hover font-bold text-foreground"
                      : "text-muted hover:bg-hover hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-1 font-mono text-[0.8125rem] text-muted md:flex">
              <MaterialIcon name="lock" className="text-[16px]" />
              <span>OFFLINE ENGINE</span>
            </div>
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground"
              title="Local profile"
            >
              <MaterialIcon
                name="person"
                className="text-[18px] text-white"
              />
            </div>
          </div>
        </div>
      </header>
      <div
        className={`relative z-10 flex flex-1 flex-col ${
          immersive ? "min-h-0 overflow-hidden pt-16" : "pt-16"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
