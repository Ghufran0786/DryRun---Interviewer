"use client";

import { FloatingBackground } from "@/components/layout/FloatingBackground";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ChromeAuth } from "@/lib/auth/types";
import { useEffect, useState, type ReactNode } from "react";

export type SiteChromeProps = {
  children: ReactNode;
  initialChromeAuth?: ChromeAuth;
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
  initialChromeAuth,
}: SiteChromeProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [authMode, setAuthMode] = useState<"local" | "hosted">(
    initialChromeAuth?.mode ?? "local",
  );
  const [signedIn, setSignedIn] = useState(
    initialChromeAuth?.signedIn ?? false,
  );

  useEffect(() => {
    if (initialChromeAuth) {
      return;
    }
    let cancelled = false;
    void fetch("/api/auth/status")
      .then((response) => response.json())
      .then((payload: { mode?: string; signedIn?: boolean }) => {
        if (cancelled) {
          return;
        }
        setAuthMode(payload.mode === "hosted" ? "hosted" : "local");
        setSignedIn(Boolean(payload.signedIn));
      })
      .catch(() => {
        if (!cancelled) {
          setAuthMode("local");
          setSignedIn(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initialChromeAuth]);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const modeLabel = authMode === "hosted" ? "HOSTED" : "LOCAL-FIRST";
  const engineLabel = authMode === "hosted" ? "SUPABASE AUTH" : "OFFLINE ENGINE";

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
                {modeLabel}
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
              <span>{engineLabel}</span>
            </div>
            {authMode === "hosted" && signedIn ? (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="hidden rounded px-2 py-1 text-[0.8125rem] text-muted hover:bg-hover hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground md:inline"
              >
                Sign out
              </button>
            ) : null}
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
      <main
        className={`relative z-10 flex flex-1 flex-col ${
          immersive ? "min-h-0 overflow-hidden pt-16" : "main-shell-fade pt-16"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
