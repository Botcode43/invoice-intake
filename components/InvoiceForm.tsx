"use client";

import { useState, useEffect, FormEvent } from "react";

interface LineItem {
  description: string;
  amount: string;
}

interface InvoiceResponse {
  id: string;
  tenantId: string;
  vendorCode: string;
  invoiceNumber: string;
  invoiceDate: string;
  total: string;
  createdBy: string;
  createdAt: string;
  lines: Array<{
    id: string;
    description: string;
    amount: string;
  }>;
}

export default function InvoiceForm() {
  // Session / Tenant State for Dev Testing
  const [currentUser, setCurrentUser] = useState("user-1");
  const [currentTenant, setCurrentTenant] = useState("company-a");
  const [sessionActive, setSessionActive] = useState(false);

  // Form State
  const [vendorCode, setVendorCode] = useState("ACME-CORP");
  const [invoiceNumber, setInvoiceNumber] = useState("INV-1001");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<LineItem[]>([
    { description: "Software Subscription", amount: "0.10" },
    { description: "Cloud Hosting", amount: "0.20" },
  ]);
  const [total, setTotal] = useState("0.30");

  // Status & List State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  // Quick dev login helper
  const handleDevLogin = async (user: string, tenant: string) => {
    try {
      const res = await fetch("/api/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user, tenantId: tenant }),
      });
      if (res.ok) {
        setCurrentUser(user);
        setCurrentTenant(tenant);
        setSessionActive(true);
        fetchInvoices();
      }
    } catch (err) {
      console.error("Dev login failed", err);
    }
  };

  const fetchInvoices = async () => {
    setIsLoadingInvoices(true);
    try {
      const res = await fetch("/api/invoices");
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
        setSessionActive(true);
      } else if (res.status === 401) {
        setSessionActive(false);
        setInvoices([]);
      }
    } catch (err) {
      console.error("Failed to load invoices", err);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  useEffect(() => {
    // Attempt dev-login on first load to seed session
    handleDevLogin(currentUser, currentTenant);
  }, []);

  const handleAddLine = () => {
    setLines([...lines, { description: "", amount: "" }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof LineItem, value: string) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload = {
      vendorCode,
      invoiceNumber,
      invoiceDate,
      lines,
      total,
    };

    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Show the server's exact error message
        setErrorMessage(data.error || `Request failed with status ${res.status}`);
        return;
      }

      // Show success ONLY when res.ok is true
      setSuccessMessage(`Invoice ${data.invoiceNumber || invoiceNumber} created successfully!`);
      // Refresh tenant invoice list
      fetchInvoices();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error occurred while submitting invoice";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* Dev Session Switcher */}
      <div
        style={{
          background: "#ffffff",
          padding: "1rem",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <strong style={{ fontSize: "0.9rem", color: "#334155" }}>Active Session: </strong>
            <span style={{ fontSize: "0.9rem", color: sessionActive ? "#15803d" : "#b91c1c", fontWeight: 600 }}>
              {sessionActive ? `Tenant: [${currentTenant}] | User: [${currentUser}]` : "No active session"}
            </span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => handleDevLogin("user-a", "company-a")}
              style={{
                padding: "0.35rem 0.75rem",
                fontSize: "0.85rem",
                borderRadius: "4px",
                border: "1px solid #cbd5e1",
                background: currentTenant === "company-a" ? "#e0f2fe" : "#ffffff",
                cursor: "pointer",
              }}
            >
              Switch to Tenant A
            </button>
            <button
              type="button"
              onClick={() => handleDevLogin("user-b", "company-b")}
              style={{
                padding: "0.35rem 0.75rem",
                fontSize: "0.85rem",
                borderRadius: "4px",
                border: "1px solid #cbd5e1",
                background: currentTenant === "company-b" ? "#e0f2fe" : "#ffffff",
                cursor: "pointer",
              }}
            >
              Switch to Tenant B
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Form */}
      <div
        style={{
          background: "#ffffff",
          padding: "1.5rem",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
          marginBottom: "2rem",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", margin: "0 0 1rem 0", color: "#1e293b" }}>Submit New Invoice</h2>

        {/* Success Alert */}
        {successMessage && (
          <div
            id="success-banner"
            style={{
              padding: "0.75rem 1rem",
              background: "#f0fdf4",
              color: "#166534",
              border: "1px solid #bbf7d0",
              borderRadius: "6px",
              marginBottom: "1rem",
              fontSize: "0.95rem",
            }}
          >
            ✓ {successMessage}
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div
            id="error-banner"
            style={{
              padding: "0.75rem 1rem",
              background: "#fef2f2",
              color: "#991b1b",
              border: "1px solid #fecaca",
              borderRadius: "6px",
              marginBottom: "1rem",
              fontSize: "0.95rem",
            }}
          >
            ✕ {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                Vendor Code *
              </label>
              <input
                id="input-vendor-code"
                type="text"
                required
                value={vendorCode}
                onChange={(e) => setVendorCode(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "4px", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                Invoice Number *
              </label>
              <input
                id="input-invoice-number"
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "4px", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                Invoice Date *
              </label>
              <input
                id="input-invoice-date"
                type="date"
                required
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "4px", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569" }}>Line Items *</label>
              <button
                type="button"
                onClick={handleAddLine}
                style={{
                  padding: "0.25rem 0.5rem",
                  fontSize: "0.8rem",
                  background: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                + Add Line
              </button>
            </div>

            {lines.map((line, idx) => (
              <div key={idx} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Item description"
                  required
                  value={line.description}
                  onChange={(e) => handleLineChange(idx, "description", e.target.value)}
                  style={{ flex: 3, padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                />
                <input
                  type="text"
                  placeholder="Amount (e.g. 0.10)"
                  required
                  value={line.amount}
                  onChange={(e) => handleLineChange(idx, "amount", e.target.value)}
                  style={{ flex: 1, padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                />
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(idx)}
                    style={{
                      padding: "0.5rem 0.75rem",
                      background: "#fee2e2",
                      color: "#dc2626",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
            <label style={{ fontSize: "0.95rem", fontWeight: 600, color: "#1e293b" }}>Total Amount ($):</label>
            <input
              id="input-total"
              type="text"
              required
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              style={{ width: "120px", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "4px", fontWeight: "bold" }}
            />
          </div>

          <button
            id="btn-submit-invoice"
            type="submit"
            disabled={isSubmitting}
            style={{
              width: "100%",
              padding: "0.75rem",
              background: isSubmitting ? "#94a3b8" : "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            {isSubmitting ? "Submitting Invoice..." : "Submit Invoice"}
          </button>
        </form>
      </div>

      {/* Tenant Invoices List */}
      <div
        style={{
          background: "#ffffff",
          padding: "1.5rem",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.25rem", margin: 0, color: "#1e293b" }}>
            Invoices for Tenant [{currentTenant}]
          </h2>
          <button
            type="button"
            onClick={fetchInvoices}
            disabled={isLoadingInvoices}
            style={{
              padding: "0.35rem 0.75rem",
              fontSize: "0.85rem",
              background: "#f1f5f9",
              border: "1px solid #cbd5e1",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            {isLoadingInvoices ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {invoices.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: "0.95rem", margin: "1rem 0" }}>
            No invoices found for this tenant.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "0.75rem" }}>Invoice #</th>
                  <th style={{ padding: "0.75rem" }}>Vendor</th>
                  <th style={{ padding: "0.75rem" }}>Date</th>
                  <th style={{ padding: "0.75rem" }}>Lines</th>
                  <th style={{ padding: "0.75rem" }}>Total</th>
                  <th style={{ padding: "0.75rem" }}>Created By</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.75rem", fontWeight: 600 }}>{inv.invoiceNumber}</td>
                    <td style={{ padding: "0.75rem" }}>{inv.vendorCode}</td>
                    <td style={{ padding: "0.75rem" }}>{inv.invoiceDate}</td>
                    <td style={{ padding: "0.75rem" }}>
                      {inv.lines.map((l) => `${l.description} ($${l.amount})`).join(", ")}
                    </td>
                    <td style={{ padding: "0.75rem", fontWeight: 600 }}>${inv.total}</td>
                    <td style={{ padding: "0.75rem", color: "#64748b" }}>{inv.createdBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
