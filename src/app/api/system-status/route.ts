import { NextResponse } from "next/server";
import { getSystemLockState, lockSystem, unlockSystem, forceLogoutAllDevices } from "@/lib/system-lock";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const state = await getSystemLockState();
    const isAdmin = (session?.user as any)?.role === "ADMIN";

    return NextResponse.json({
      success: true,
      isLocked: state.isLocked,
      lockedBy: session ? state.lockedBy : null,
      lockedAt: session ? state.lockedAt : null,
      sessionCutoff: state.sessionCutoff,
      logs: isAdmin ? state.logs.slice(0, 20) : [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch status" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const userName = session.user.name || (session.user as any).username || "المدير";

    if (userRole !== "ADMIN") {
      return NextResponse.json(
        { error: "هذه العملية مخصصة للمدير المصرح له فقط" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action } = body;

    if (action === "LOCK") {
      const res = await lockSystem(userName);
      return NextResponse.json(res);
    } else if (action === "UNLOCK") {
      const res = await unlockSystem(userName);
      return NextResponse.json(res);
    } else if (action === "FORCE_LOGOUT") {
      const res = await forceLogoutAllDevices(userName);
      return NextResponse.json(res);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to execute security action" },
      { status: 500 }
    );
  }
}
