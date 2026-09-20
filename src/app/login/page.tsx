import { LoginForm } from "@/components/auth/LoginForm";
import { isHostedMode } from "@/lib/appMode";
import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (!isHostedMode()) {
    redirect("/");
  }

  const params = await searchParams;
  const nextPath =
    typeof params.next === "string" && params.next.startsWith("/")
      ? params.next
      : "/";

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <p className="text-[0.6875rem] font-medium uppercase tracking-widest text-muted">
            DryRun hosted
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Sign in
          </h1>
          <p className="text-sm text-muted">
            Email and password for the deployment owner only.
          </p>
        </div>
        <LoginForm nextPath={nextPath} />
      </div>
    </div>
  );
}
