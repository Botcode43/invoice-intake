import { NextResponse } from "next/server";
import { createSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Dev login is disabled in production" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { userId, tenantId } = body;

    if (!userId || !tenantId || typeof userId !== "string" || typeof tenantId !== "string") {
      return NextResponse.json(
        { error: "userId and tenantId are required strings" },
        { status: 400 }
      );
    }

    const cookieValue = createSessionCookie(userId.trim(), tenantId.trim());

    return new NextResponse(
      JSON.stringify({ ok: true, session: { userId: userId.trim(), tenantId: tenantId.trim() } }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": cookieValue,
        },
      }
    );
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
