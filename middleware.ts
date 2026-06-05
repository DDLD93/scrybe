import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = new Set(["/login", "/setup", "/change-password"]);
const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/setup",
  "/api/auth/status",
  "/api/health",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const AUTH_PROBE_HEADER = "x-scrybe-auth-probe";

function internalOrigin(req: NextRequest): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  const host = req.headers.get("host");
  if (host) return `http://${host}`;
  const fallbackHost = process.env.HOST ?? "127.0.0.1";
  const port = process.env.PORT ?? "3000";
  return `http://${fallbackHost}:${port}`;
}

async function fetchAuthStatus(req: NextRequest) {
  try {
    const url = new URL("/api/auth/status", internalOrigin(req));
    const res = await fetch(url, {
      headers: {
        cookie: req.headers.get("cookie") ?? "",
        [AUTH_PROBE_HEADER]: "1",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      hasUsers: boolean;
      user: {
        mustChangePassword: boolean;
        status: string;
      } | null;
    };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  if (req.headers.get(AUTH_PROBE_HEADER) === "1") {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const status = await fetchAuthStatus(req);

  if (!status) {
    return NextResponse.next();
  }

  const { hasUsers, user } = status;

  if (!hasUsers) {
    if (pathname === "/setup" || pathname === "/api/auth/setup" || pathname === "/api/auth/status") {
      return NextResponse.next();
    }
    if (pathname.startsWith("/api/health")) {
      return NextResponse.next();
    }
    const setupUrl = req.nextUrl.clone();
    setupUrl.pathname = "/setup";
    return NextResponse.redirect(setupUrl);
  }

  if (pathname === "/setup" || pathname === "/api/auth/setup") {
    const dest = req.nextUrl.clone();
    dest.pathname = user ? "/transcribe" : "/login";
    return NextResponse.redirect(dest);
  }

  if (isPublicPath(pathname) || isPublicApi(pathname)) {
    if (user && (pathname === "/login" || pathname === "/setup")) {
      const dest = req.nextUrl.clone();
      dest.pathname = user.mustChangePassword ? "/change-password" : "/transcribe";
      return NextResponse.redirect(dest);
    }
    return NextResponse.next();
  }

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user.status === "suspended") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Account suspended" }, { status: 403 });
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("error", "suspended");
    return NextResponse.redirect(loginUrl);
  }

  if (user.mustChangePassword) {
    const allowed =
      pathname === "/change-password" ||
      pathname === "/api/auth/change-password" ||
      pathname === "/api/auth/logout" ||
      pathname === "/api/auth/me" ||
      pathname === "/api/auth/status";
    if (!allowed) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Password change required" }, { status: 403 });
      }
      const changeUrl = req.nextUrl.clone();
      changeUrl.pathname = "/change-password";
      return NextResponse.redirect(changeUrl);
    }
  }

  if (user && pathname === "/login") {
    const dest = req.nextUrl.clone();
    dest.pathname = "/transcribe";
    return NextResponse.redirect(dest);
  }

  return NextResponse.next();
}

function isPublicApi(pathname: string): boolean {
  if (pathname.startsWith("/api/health")) return true;
  return PUBLIC_API_PREFIXES.some((p) => pathname === p);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/auth/status).*)"],
};
