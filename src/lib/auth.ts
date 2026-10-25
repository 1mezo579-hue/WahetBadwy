import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { getSystemLockState } from "./system-lock";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "اسم المستخدم", type: "text" },
        password: { label: "كلمة المرور", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("يرجى إدخال اسم المستخدم وكلمة المرور");
        }

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
        });

        if (!user || !user.active) {
          throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isValid) {
          throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
        }

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.username = (user as any).username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).username = token.username;
        (session.user as any).iat = token.iat;

        // Check if session was revoked by global force logout
        try {
          const lockState = await getSystemLockState();
          if (token.iat && lockState.sessionCutoff > 0) {
            const tokenIssuedAtMs = (token.iat as number) * 1000;
            if (tokenIssuedAtMs < lockState.sessionCutoff) {
              (session.user as any).revoked = true;
            }
          }
        } catch (e) {
          // Fallback if db temporarily busy
        }
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {}
      return baseUrl;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours — typical POS shift duration
  },
  secret: process.env.NEXTAUTH_SECRET,
};
