import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createInvoiceSchema } from "@/lib/schemas";
import { parseToCents, sumCents, formatCents } from "@/lib/money";
import { createInvoice, listInvoices } from "@/lib/invoices-repo";

export async function GET(request: Request) {
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // TENANT ISOLATION POINT (ROUTE): Always use session.tenantId, never from query or headers.
    const invoices = await listInvoices(session.tenantId);
    return NextResponse.json({ invoices }, { status: 200 });
  } catch (error) {
    console.error("Failed to list invoices:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // 1. Authenticate via signed session cookie
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 2. Validate input schema with Zod (tenantId is stripped if present in payload)
  const parseResult = createInvoiceSchema.safeParse(rawBody);
  if (!parseResult.success) {
    const errorMessages = parseResult.error.errors.map((e) => e.message).join("; ");
    return NextResponse.json({ error: errorMessages }, { status: 400 });
  }

  const invoiceData = parseResult.data;

  // 3. Money calculations & exact cent reconciliation
  try {
    const lineCentsList = invoiceData.lines.map((l) => parseToCents(l.amount));
    const linesSumCents = sumCents(lineCentsList);
    const totalCents = parseToCents(invoiceData.total);

    if (linesSumCents !== totalCents) {
      const sumFormatted = formatCents(linesSumCents);
      const totalFormatted = formatCents(totalCents);
      return NextResponse.json(
        {
          error: `Line items add up to ${sumFormatted} but total is ${totalFormatted}`,
        },
        { status: 422 }
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid money calculation";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 4. Create invoice with lines in a single database transaction
  // TENANT ISOLATION POINT (MUTATION): tenantId is strictly taken from verified session
  try {
    const createdInvoice = await createInvoice(session.tenantId, session.userId, invoiceData);
    return NextResponse.json(createdInvoice, { status: 201 });
  } catch (error: any) {
    // 5. Unique violation (Postgres error code 23505) -> 409 Conflict
    if (error && (error.code === "23505" || error.constraint === "uq_invoices_tenant_vendor_invoice_number")) {
      return NextResponse.json(
        { error: "Invoice already exists for this vendor and invoice number" },
        { status: 409 }
      );
    }

    console.error("Failed to create invoice:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
