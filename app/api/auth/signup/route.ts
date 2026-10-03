import { NextResponse } from "next/server";
import { signupSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/auth";
import { createUser, findUserByEmail } from "@/lib/auth-repo";
import { createSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = signupSchema.safeParse(rawBody);
  if (!parseResult.success) {
    const errorMessages = parseResult.error.errors.map((e) => e.message).join("; ");
    return NextResponse.json({ error: errorMessages }, { status: 400 });
  }

  const { email, password, tenantId } = parseResult.data;

  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = hashPassword(password);
    const user = await createUser(email, passwordHash, tenantId);

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
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": sessionCookie,
        },
      }
    );
  } catch (error) {
    console.error("Signup failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
