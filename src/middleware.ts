import { withAuth } from "next-auth/middleware";

export default withAuth({
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/pos/:path*",
    "/dashboard/:path*",
    "/orders/:path*",
    "/menu/:path*",
    "/tables/:path*",
    "/settings/:path*",
    "/users/:path*",
  ],
};
