import { SiteChrome } from "@/components/layout/SiteChrome";
import { prisma } from "@/lib/db";

const COLOR_TOKENS = [
  {
    name: "Background",
    hex: "#FAFAFA",
    role: "Base canvas layer",
    token: "bg-background",
  },
  {
    name: "Surfaces / Cards",
    hex: "#FFFFFF",
    role: "Panels, modals, whiteboard chrome",
    token: "bg-white",
  },
  {
    name: "Primary text & solid",
    hex: "#0A0A0A",
    role: "Buttons, headlines, active elements",
    token: "text-foreground / bg-foreground",
  },
  {
    name: "Secondary text",
    hex: "#6B6B6B",
    role: "Labels, metrics, supporting copy",
    token: "text-muted",
  },
  {
    name: "Structural fill",
    hex: "#E5E5E5",
    role: "Borders, dividers, hairlines",
    token: "border-border",
  },
  {
    name: "Hover surface",
    hex: "#F2F2F2",
    role: "Row hover, secondary button hover",
    token: "hover:bg-hover",
  },
  {
    name: "Primary hover",
    hex: "#1A1A1A",
    role: "Hover state of black primary buttons only",
    token: "hover:bg-primary-hover",
  },
];

export default async function DocsPage() {
  const [activeSession, latestReport] = await Promise.all([
    prisma.session.findFirst({
      where: { status: "active" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.session.findFirst({
      where: { status: "completed" },
      orderBy: { endedAt: "desc" },
    }),
  ]);

  return (
    <SiteChrome
      interviewHref={
        activeSession ? `/interview/${activeSession.id}` : undefined
      }
      reportHref={latestReport ? `/report/${latestReport.id}` : undefined}
    >
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10 px-6 py-10">
        <header className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-[0.6875rem] font-medium uppercase tracking-widest text-muted">
            Specification // DryRun mockups (Stitch)
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            Design system & component engineering spec
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Canonical tokens for the DryRun workstation shell. Excalidraw canvas
            UI remains exempt per PROJECT.md. Source mockups: Google Stitch
            project{" "}
            <span className="font-mono text-foreground">1511067814848469165</span>
            .
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-foreground">
            01 · Color tokens
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {COLOR_TOKENS.map((token) => (
              <div
                key={token.name}
                className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm"
              >
                <div
                  className="flex h-20 w-full items-center justify-center rounded-lg border border-border"
                  style={{ backgroundColor: token.hex }}
                >
                  <span className="font-mono text-[0.8125rem] text-foreground">
                    {token.hex}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-foreground">{token.name}</p>
                  <p className="mt-1 text-sm text-muted">{token.role}</p>
                  <p className="mt-2 font-mono text-[0.8125rem] font-semibold text-foreground">
                    {token.token}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-foreground">
            02 · Typography & chrome
          </h2>
          <div className="rounded-xl bg-white p-6 text-sm text-muted shadow-sm">
            <ul className="list-disc space-y-2 pl-5">
              <li>Display: Geist (via next/font)</li>
              <li>Counters & timers: JetBrains Mono</li>
              <li>Section labels: 11px uppercase, 0.08em tracking</li>
              <li>Global nav: fixed header, LOCAL-FIRST badge, runtime status chip</li>
              <li>Background: low-opacity Material glyph drift (18s loop)</li>
            </ul>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-foreground">
            03 · Screen inventory
          </h2>
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-hover font-mono text-[0.8125rem] uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Screen</th>
                  <th className="px-4 py-3">Route / component</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ["Dashboard & Sessions", "/"],
                  ["Settings & Engine", "/settings"],
                  ["Interview room", "/interview/[id]"],
                  ["Interview report", "/report/[id]"],
                  ["Delete confirmation", "SessionList modal"],
                  ["Design spec", "/docs"],
                ].map(([screen, route]) => (
                  <tr key={screen}>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {screen}
                    </td>
                    <td className="px-4 py-3 font-mono text-[0.8125rem] text-muted">
                      {route}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </SiteChrome>
  );
}
