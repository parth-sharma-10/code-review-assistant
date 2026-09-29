import { NextResponse, type NextRequest } from "next/server";

const AUTH_PAGES = ["/login", "/register"];

/** Must match proxyClientMaxBodySize in next.config.ts. Larger bodies would be truncated. */
const MAX_UPLOAD_BYTES = 21 * 1024 * 1024;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    // Only upload routes reach here (see matcher). Reject oversize bodies up front with a clear
    // 413 instead of letting Next truncate them, which leaves the backend waiting forever.
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          statusCode: 413,
          message: "The file is larger than the 20 MB upload limit.",
          error: "Payload Too Large",
        },
        { status: 413 },
      );
    }
    return NextResponse.next();
  }

  // UX-only route guard: visitors without a session cookie go to /login, signed-in users skip
  // the auth pages. The token is not verified here; the backend verifies it on every API call.
  const hasSession = request.cookies.has("access_token");
  const isAuthPage = AUTH_PAGES.includes(pathname);
  if (!hasSession && !isAuthPage) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (hasSession && (isAuthPage || pathname === "/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/projects/:id/upload", "/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
