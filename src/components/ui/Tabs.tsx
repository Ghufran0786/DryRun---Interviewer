"use client";

import type { ReactNode } from "react";

export type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
};

type TabsProps = {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
};

export function Tabs({ tabs, activeId, onChange }: TabsProps) {
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="flex shrink-0 border-b border-[#E5E5E5]"
        role="tablist"
        aria-label="Panel tabs"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`flex-1 px-3 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0A0A0A] ${
                isActive
                  ? "border-b-2 border-[#0A0A0A] text-[#0A0A0A]"
                  : "text-[#6B6B6B] hover:bg-[#F2F2F2] hover:text-[#0A0A0A]"
              }`}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4" role="tabpanel">
        {active?.content}
      </div>
    </div>
  );
}
