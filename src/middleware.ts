export { default } from "next-auth/middleware";

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
