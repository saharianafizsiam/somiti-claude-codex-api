import { NextResponse, type NextRequest } from "next/server";
export function proxy(request: NextRequest) {
  if (/^\/v[12]\//.test(request.nextUrl.pathname)) {
    // Public API uses explicit API keys, never browser session cookies.
    const response =
      request.method === "OPTIONS"
        ? new NextResponse(null, { status: 204 })
        : NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, x-api-key, anthropic-version, anthropic-beta, anthropic-dangerous-direct-browser-access, x-stainless-lang, x-stainless-package-version, x-stainless-os, x-stainless-arch, x-stainless-runtime, x-stainless-runtime-version, x-stainless-retry-count, x-stainless-timeout",
    );
    response.headers.set(
      "Access-Control-Expose-Headers",
      "X-Request-Id, Retry-After",
    );
    response.headers.set("Access-Control-Max-Age", "600");
    return response;
  }
  const nonce = btoa(crypto.randomUUID());
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`;
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: ["/dashboard/:path*", "/login", "/v1/:path*", "/v2/:path*"],
};
