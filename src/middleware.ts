import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
    const role = (token as any)?.role || "CASHIER";

    // Cashier lockdown: strictly forbid access to /dashboard and admin pages
    if (pathname.startsWith("/dashboard")) {
      if (role === "CASHIER") {
        return NextResponse.redirect(new URL("/pos", req.url));
      }
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/pos/:path*",
    "/kitchen/:path*",
    "/dashboard/:path*",
    "/orders/:path*",
    "/menu/:path*",
    "/tables/:path*",
    "/settings/:path*",
    "/users/:path*",
  ],
};
