"use client";

import { useState, useEffect, FormEvent } from "react";

interface LineItem {
  description: string;
  amount: string;
}

interface Invoice {
  id: string;
  vendorCode: string;
  invoiceNumber: string;
  invoiceDate: string;
  total: string;
  createdBy: string;
  lines: Array<{ id: string; description: string; amount: string }>;
}

export default function InvoiceForm() {
  const [vendorCode, setVendorCode] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<LineItem[]>([{ description: "", amount: "" }]);
  const [total, setTotal] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  async function login(userId: string, tenantId: string) {
    await fetch("/api/dev-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, tenantId }),
    });
    loadInvoices();
  }

  async function loadInvoices() {
    const res = await fetch("/api/invoices");
    if (res.ok) {
      const data = await res.json();
      setInvoices(data.invoices);
    }
  }

  useEffect(() => {
    login("user-1", "company-a");
  }, []);

  function addLine() {
    setLines([...lines, { description: "", amount: "" }]);
  }

  function removeLine(i: number) {
    if (lines.length <= 1) return; // keep at least one line
    setLines(lines.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, field: keyof LineItem, value: string) {
    const updated = [...lines];
    updated[i] = { ...updated[i], [field]: value };
    setLines(updated);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorCode, invoiceNumber, invoiceDate, lines, total }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`);
        return;
      }

      // Show success ONLY when res.ok is true
      setSuccess(`Invoice ${data.invoiceNumber} created.`);
      loadInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: "2rem auto", fontFamily: "system-ui, sans-serif", padding: "0 1rem" }}>
      <h1>Invoice Intake</h1>

      {/* Dev tenant switcher */}
      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem" }}>
        <button type="button" onClick={() => login("user-a", "company-a")}>Login as Tenant A</button>
        <button type="button" onClick={() => login("user-b", "company-b")}>Login as Tenant B</button>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <input
            id="vendor-code"
            placeholder="Vendor code"
            required
            value={vendorCode}
            onChange={e => setVendorCode(e.target.value)}
            style={{ flex: 1 }}
          />
          <input
            id="invoice-number"
            placeholder="Invoice number"
            required
            value={invoiceNumber}
            onChange={e => setInvoiceNumber(e.target.value)}
            style={{ flex: 1 }}
          />
          <input
            id="invoice-date"
            type="date"
            required
            value={invoiceDate}
            onChange={e => setInvoiceDate(e.target.value)}
          />
        </div>

        <fieldset style={{ marginBottom: "0.5rem", border: "1px solid #ccc", padding: "0.5rem" }}>
          <legend>Line items</legend>
          {lines.map((line, i) => (
            <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <input
                placeholder="Description"
                required
                value={line.description}
                onChange={e => updateLine(i, "description", e.target.value)}
                style={{ flex: 3 }}
              />
              <input
                placeholder="Amount (e.g. 10.20)"
                required
                value={line.amount}
                onChange={e => updateLine(i, "amount", e.target.value)}
                style={{ flex: 1 }}
              />
              {lines.length > 1 && (
                <button type="button" onClick={() => removeLine(i)}>✕</button>
              )}
            </div>
          ))}
          <button type="button" onClick={addLine}>+ Add line</button>
        </fieldset>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
          <label htmlFor="total"><strong>Total:</strong></label>
          <input
            id="total"
            placeholder="e.g. 10.50"
            required
            value={total}
            onChange={e => setTotal(e.target.value)}
            style={{ width: 120 }}
          />
        </div>

        <button id="submit-btn" type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit invoice"}
        </button>
      </form>

      {/* Error — shown only when !res.ok */}
      {error && (
        <p id="error-msg" style={{ color: "red", marginTop: "0.75rem" }}>Error: {error}</p>
      )}

      {/* Success — shown only when res.ok */}
      {success && (
        <p id="success-msg" style={{ color: "green", marginTop: "0.75rem" }}>{success}</p>
      )}

      <hr style={{ margin: "1.5rem 0" }} />
      <h2>Invoices for this tenant</h2>
      {invoices.length === 0 ? (
        <p>No invoices yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Invoice #</th>
              <th style={{ textAlign: "left" }}>Vendor</th>
              <th style={{ textAlign: "left" }}>Date</th>
              <th style={{ textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id} style={{ borderTop: "1px solid #eee" }}>
                <td>{inv.invoiceNumber}</td>
                <td>{inv.vendorCode}</td>
                <td>{inv.invoiceDate}</td>
                <td style={{ textAlign: "right" }}>${inv.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
