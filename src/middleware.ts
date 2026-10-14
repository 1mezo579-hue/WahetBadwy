import { withAuth } from "next-auth/middleware";

export default withAuth({
  secret: process.env.NEXTAUTH_SECRET || "wahet-badawy-pos-secret-key-2026",
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/orders/:path*",
    "/menu/:path*",
    "/tables/:path*",
    "/settings/:path*",
    "/users/:path*",
  ],
};
