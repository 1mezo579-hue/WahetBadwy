import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { error: "هذه النقطة معطلة ومغلقة أمنياً للحفاظ على سلامة البيانات." },
    { status: 403 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "هذه النقطة معطلة ومغلقة أمنياً للحفاظ على سلامة البيانات." },
    { status: 403 }
  );
}