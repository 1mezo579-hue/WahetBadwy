"use client";

import { SessionProvider } from "next-auth/react";
import AmoBasionyWidget from "@/components/ai/amo-basiony-widget";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <AmoBasionyWidget />
    </SessionProvider>
  );
}
