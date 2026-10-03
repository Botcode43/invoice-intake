import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findUserById } from "@/lib/auth-repo";

export async function GET(request: Request) {
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  try {
    const user = await findUserById(session.userId);
    if (!user) {
      // If user was deleted or dev-login session
      return NextResponse.json(
        { user: { id: session.userId, email: session.userId, tenantId: session.tenantId } },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          tenantId: user.tenantId,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to get current user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
