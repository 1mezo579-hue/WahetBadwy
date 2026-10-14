import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    console.error("Session check error (DB might be offline):", error);
  }

  if (session) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
