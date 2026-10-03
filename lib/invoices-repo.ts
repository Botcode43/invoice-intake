import { pool, withTransaction } from "./db";
import { parseToCents, formatCents } from "./money";
import { CreateInvoiceInput } from "./schemas";

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  description: string;
  amount: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  vendorCode: string;
  invoiceNumber: string;
  invoiceDate: string;
  total: string;
  createdBy: string;
  createdAt: string;
  lines: InvoiceLine[];
}

interface InvoiceDbRow {
  id: string;
  tenant_id: string;
  vendor_code: string;
  invoice_number: string;
  invoice_date: Date | string;
  total_cents: string | number | bigint;
  created_by: string;
  created_at: Date | string;
}

interface LineDbRow {
  id: string;
  invoice_id: string;
  description: string;
  amount_cents: string | number | bigint;
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
    // 1. Insert invoice header
    const invoiceRes = await client.query<InvoiceDbRow>(
      `INSERT INTO invoices (tenant_id, vendor_code, invoice_number, invoice_date, total_cents, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, tenant_id, vendor_code, invoice_number, invoice_date, total_cents, created_by, created_at`,
      [tenantId, data.vendorCode, data.invoiceNumber, data.invoiceDate, totalCents.toString(), userId]
    );

    const invoiceRow = invoiceRes.rows[0];

    // 2. Insert line items
    const lines: InvoiceLine[] = [];
    for (const line of data.lines) {
      const lineCents = parseToCents(line.amount);
      const lineRes = await client.query<LineDbRow>(
        `INSERT INTO invoice_lines (invoice_id, description, amount_cents)
         VALUES ($1, $2, $3)
         RETURNING id, invoice_id, description, amount_cents`,
        [invoiceRow.id, line.description, lineCents.toString()]
      );
      const lineRow = lineRes.rows[0];
      lines.push({
        id: lineRow.id,
        invoiceId: lineRow.invoice_id,
        description: lineRow.description,
        amount: formatCents(BigInt(lineRow.amount_cents)),
      });
    }

    const invoiceDateStr =
      invoiceRow.invoice_date instanceof Date
        ? invoiceRow.invoice_date.toISOString().slice(0, 10)
        : String(invoiceRow.invoice_date).slice(0, 10);

    return {
      id: invoiceRow.id,
      tenantId: invoiceRow.tenant_id,
      vendorCode: invoiceRow.vendor_code,
      invoiceNumber: invoiceRow.invoice_number,
      invoiceDate: invoiceDateStr,
      total: formatCents(BigInt(invoiceRow.total_cents)),
      createdBy: invoiceRow.created_by,
      createdAt: new Date(invoiceRow.created_at).toISOString(),
      lines,
    };
  });
}

/**
 * Lists all invoices and their associated lines belonging to a specific tenant.
 */
export async function listInvoices(tenantId: string): Promise<Invoice[]> {
  // TENANT ISOLATION POINT (READS): All queries are strictly scoped by tenant_id from the session.
  const invoicesRes = await pool.query<InvoiceDbRow>(
    `SELECT id, tenant_id, vendor_code, invoice_number, invoice_date, total_cents, created_by, created_at
     FROM invoices
     WHERE tenant_id = $1
     ORDER BY created_at DESC`,
    [tenantId]
  );

  if (invoicesRes.rows.length === 0) {
    return [];
  }

  const invoiceIds = invoicesRes.rows.map((r) => r.id);

  const linesRes = await pool.query<LineDbRow>(
    `SELECT id, invoice_id, description, amount_cents
     FROM invoice_lines
     WHERE invoice_id = ANY($1::uuid[])
     ORDER BY id ASC`,
    [invoiceIds]
  );

  const linesByInvoiceId = new Map<string, InvoiceLine[]>();
  for (const lineRow of linesRes.rows) {
    const list = linesByInvoiceId.get(lineRow.invoice_id) || [];
    list.push({
      id: lineRow.id,
      invoiceId: lineRow.invoice_id,
      description: lineRow.description,
      amount: formatCents(BigInt(lineRow.amount_cents)),
    });
    linesByInvoiceId.set(lineRow.invoice_id, list);
  }

  return invoicesRes.rows.map((row) => {
    const invoiceDateStr =
      row.invoice_date instanceof Date
        ? row.invoice_date.toISOString().slice(0, 10)
        : String(row.invoice_date).slice(0, 10);

    return {
      id: row.id,
      tenantId: row.tenant_id,
      vendorCode: row.vendor_code,
      invoiceNumber: row.invoice_number,
      invoiceDate: invoiceDateStr,
      total: formatCents(BigInt(row.total_cents)),
      createdBy: row.created_by,
      createdAt: new Date(row.created_at).toISOString(),
      lines: linesByInvoiceId.get(row.id) || [],
    };
  });
}
