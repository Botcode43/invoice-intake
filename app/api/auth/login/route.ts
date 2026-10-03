import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/schemas";
import { verifyPassword } from "@/lib/auth";
import { findUserByEmail } from "@/lib/auth-repo";
import { createSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = loginSchema.safeParse(rawBody);
  if (!parseResult.success) {
    const errorMessages = parseResult.error.errors.map((e) => e.message).join("; ");
    return NextResponse.json({ error: errorMessages }, { status: 400 });
  }

  const { email, password } = parseResult.data;

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const sessionCookie = createSessionCookie(user.id, user.tenantId);

    return new NextResponse(
      JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          tenantId: user.tenantId,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": sessionCookie,
        },
      }
    );
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
