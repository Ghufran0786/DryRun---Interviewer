"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refetch server session list when the tab regains focus (e.g. after another browser). */
export function DashboardLiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      router.refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    });
    return () => {
      window.removeEventListener("focus", refresh);
    };
  }, [router]);

  return null;
}
