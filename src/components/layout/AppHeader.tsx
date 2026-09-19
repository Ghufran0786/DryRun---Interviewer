import Link from "next/link";

type AppHeaderProps = {
  title?: string;
  trailing?: React.ReactNode;
};

export function AppHeader({ title = "DryRun", trailing }: AppHeaderProps) {
  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          {title}
        </Link>
        {trailing}
      </div>
    </header>
  );
}
