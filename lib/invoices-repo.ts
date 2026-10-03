import { pool, withTransaction } from "./db";
import { parseToCents, formatCents } from "./money";
import { CreateInvoiceInput } from "./schemas";

export interface InvoiceLine {
  id: string;
  description: string;
  amount: string; // formatted cents, e.g. "10.20"
}

export interface Invoice {
  id: string;
  tenantId: string;
  vendorCode: string;
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  total: string;       // formatted cents
  createdBy: string;
  createdAt: string;   // ISO string
  lines: InvoiceLine[];
}

/**
 * Creates an invoice and its line items inside a single database transaction.
 */
export async function createInvoice(
  tenantId: string,
  userId: string,
  data: CreateInvoiceInput
): Promise<Invoice> {
  const totalCents = parseToCents(data.total);

  return await withTransaction(async (client) => {
    // Insert invoice header
    const invoiceRes = await client.query(
      `INSERT INTO invoices (tenant_id, vendor_code, invoice_number, invoice_date, total_cents, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, tenant_id, vendor_code, invoice_number, invoice_date, total_cents, created_by, created_at`,
      [tenantId, data.vendorCode, data.invoiceNumber, data.invoiceDate, totalCents.toString(), userId]
    );

    const inv = invoiceRes.rows[0];

    // Insert line items
    const lines: InvoiceLine[] = [];
    for (const line of data.lines) {
      const lineCents = parseToCents(line.amount);
      const lineRes = await client.query(
        `INSERT INTO invoice_lines (invoice_id, description, amount_cents)
         VALUES ($1, $2, $3)
         RETURNING id, description, amount_cents`,
        [inv.id, line.description, lineCents.toString()]
      );
      const l = lineRes.rows[0];
      lines.push({ id: l.id, description: l.description, amount: formatCents(BigInt(l.amount_cents)) });
    }

    return {
      id: inv.id,
      tenantId: inv.tenant_id,
      vendorCode: inv.vendor_code,
      invoiceNumber: inv.invoice_number,
      invoiceDate: String(inv.invoice_date).slice(0, 10),
      total: formatCents(BigInt(inv.total_cents)),
      createdBy: inv.created_by,
      createdAt: new Date(inv.created_at).toISOString(),
      lines,
    };
  });
}

/**
 * Lists all invoices belonging to a specific tenant, with their line items.
 */
export async function listInvoices(tenantId: string): Promise<Invoice[]> {
  // TENANT ISOLATION: tenant_id comes from the verified session — never from user input.
  const invoicesRes = await pool.query(
    `SELECT id, tenant_id, vendor_code, invoice_number, invoice_date, total_cents, created_by, created_at
     FROM invoices
     WHERE tenant_id = $1
     ORDER BY created_at DESC`,
    [tenantId]
  );

  if (invoicesRes.rows.length === 0) return [];

  const invoiceIds = invoicesRes.rows.map((r: { id: string }) => r.id);
  const linesRes = await pool.query(
    `SELECT id, invoice_id, description, amount_cents
     FROM invoice_lines
     WHERE invoice_id = ANY($1::uuid[])`,
    [invoiceIds]
  );

  // Group lines by invoice_id
  const linesByInvoice = new Map<string, InvoiceLine[]>();
  for (const l of linesRes.rows) {
    const list = linesByInvoice.get(l.invoice_id) ?? [];
    list.push({ id: l.id, description: l.description, amount: formatCents(BigInt(l.amount_cents)) });
    linesByInvoice.set(l.invoice_id, list);
  }

  return invoicesRes.rows.map((row: { id: string; tenant_id: string; vendor_code: string; invoice_number: string; invoice_date: unknown; total_cents: string; created_by: string; created_at: unknown }) => ({
    id: row.id,
    tenantId: row.tenant_id,
    vendorCode: row.vendor_code,
    invoiceNumber: row.invoice_number,
    invoiceDate: String(row.invoice_date).slice(0, 10),
    total: formatCents(BigInt(row.total_cents)),
    createdBy: row.created_by,
    createdAt: new Date(String(row.created_at)).toISOString(),
    lines: linesByInvoice.get(row.id) ?? [],
  }));
}
