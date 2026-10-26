import { NextResponse } from "next/server";
import { getActiveKitchenOrders } from "@/actions/kitchen";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await getActiveKitchenOrders();
    return NextResponse.json(res, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch kitchen orders", orders: [] },
      { status: 500 }
    );
  }
}
