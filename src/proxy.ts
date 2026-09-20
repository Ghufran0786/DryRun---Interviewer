import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function appModeFromEnv(): "local" | "hosted" {
  const raw = process.env.APP_MODE;
  if (raw === "hosted") {
    return "hosted";
  }
  return "local";
}

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") {
    return true;
  }
  if (pathname.startsWith("/api/auth/")) {
    return true;
  }
  return false;
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export async function proxy(request: NextRequest) {
  if (appModeFromEnv() !== "hosted") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const ownerId = process.env.DRYRUN_OWNER_USER_ID;

  if (!supabaseUrl || !supabaseAnonKey || !ownerId) {
    if (isApiPath(pathname)) {
      return NextResponse.json(
        { error: "Server authentication is not configured." },
        { status: 500 },
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // High-frequency API routes: cookie session only (no Auth server round-trip).
  if (isApiPath(pathname)) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.id !== ownerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return response;
  }

  // App navigations: validate JWT from cookies locally (refresh only when expired).
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user.id !== ownerId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
