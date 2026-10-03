"use client";

import { useState, useEffect, FormEvent } from "react";

interface LineItem {
  description: string;
  amount: string;
}

interface Invoice {
  id: string;
  tenantId: string;
  vendorCode: string;
  invoiceNumber: string;
  invoiceDate: string;
  total: string;
  createdBy: string;
  createdAt: string;
  lines: Array<{ id: string; description: string; amount: string }>;
}

interface UserSession {
  id: string;
  email: string;
  tenantId: string;
}

export default function InvoiceForm() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Auth form state
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authTenantId, setAuthTenantId] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Invoice form state
  const [vendorCode, setVendorCode] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<LineItem[]>([{ description: "", amount: "" }]);
  const [total, setTotal] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Check current session on mount
  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    setCheckingAuth(true);
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setCurrentUser(data.user);
          loadInvoices();
        } else {
          setCurrentUser(null);
        }
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setCheckingAuth(false);
    }
  }

  async function loadInvoices() {
    setLoadingInvoices(true);
    try {
      const res = await fetch("/api/invoices");
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
      }
    } catch {
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  }

  async function handleAuthSubmit(e: FormEvent) {
    e.preventDefault();
    setAuthSubmitting(true);
    setAuthError(null);

    const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
    const payload =
      authMode === "signup"
        ? { email: authEmail, password: authPassword, tenantId: authTenantId }
        : { email: authEmail, password: authPassword };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setAuthError(data.error || `Authentication failed (${res.status})`);
        return;
      }

      setCurrentUser(data.user);
      setAuthPassword("");
      setError(null);
      setSuccess(null);
      loadInvoices();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Network error");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setCurrentUser(null);
      setInvoices([]);
      setError(null);
      setSuccess(null);
    }
  }

  // Quick preset demo login
  async function quickDemoAuth(email: string, pass: string, tenant: string) {
    setAuthSubmitting(true);
    setAuthError(null);
    try {
      // Try login first
      let res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass }),
      });

      if (!res.ok) {
        // If login failed, sign up the demo user
        res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: pass, tenantId: tenant }),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.user) {
        setCurrentUser(data.user);
        setError(null);
        setSuccess(null);
        loadInvoices();
      } else {
        setAuthError(data.error || "Quick demo authentication failed");
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Network error");
    } finally {
      setAuthSubmitting(false);
    }
  }

  function addLine() {
    setLines([...lines, { description: "", amount: "" }]);
  }

  function removeLine(i: number) {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, field: keyof LineItem, value: string) {
    const updated = [...lines];
    updated[i] = { ...updated[i], [field]: value };
    setLines(updated);
  }

  async function handleSubmitInvoice(e: FormEvent) {
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
      setSuccess(`Invoice ${data.invoiceNumber} created successfully for tenant ${currentUser?.tenantId}.`);
      setVendorCode("");
      setInvoiceNumber("");
      setLines([{ description: "", amount: "" }]);
      setTotal("");
      loadInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingAuth) {
    return (
      <div style={{ maxWidth: 720, margin: "3rem auto", fontFamily: "system-ui, sans-serif", padding: "0 1rem" }}>
        <p>Loading session…</p>
      </div>
    );
  }

  // Not logged in -> Show Login / Signup Screen
  if (!currentUser) {
    return (
      <div style={{ maxWidth: 520, margin: "3rem auto", fontFamily: "system-ui, sans-serif", padding: "0 1rem" }}>
        <h1 style={{ marginBottom: "0.25rem" }}>Multi-Tenant Invoice Intake</h1>
        <p style={{ color: "#666", marginBottom: "1.5rem" }}>
          Sign in to your company account or create a new tenant.
        </p>

        {/* Quick Demo Switcher Buttons */}
        <div style={{ background: "#f5f7fa", border: "1px solid #e2e8f0", borderRadius: 8, padding: "1rem", marginBottom: "1.5rem" }}>
          <strong style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
            ⚡ 1-Click Demo Accounts (for testing tenant isolation):
          </strong>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              id="demo-tenant-a-btn"
              onClick={() => quickDemoAuth("alice@acme.com", "password123", "company-a")}
              disabled={authSubmitting}
              style={{ padding: "6px 12px", cursor: "pointer", background: "#2563eb", color: "#fff", border: "none", borderRadius: 4 }}
            >
              Sign In as Acme Corp (Tenant A)
            </button>
            <button
              type="button"
              id="demo-tenant-b-btn"
              onClick={() => quickDemoAuth("bob@globex.com", "password123", "company-b")}
              disabled={authSubmitting}
              style={{ padding: "6px 12px", cursor: "pointer", background: "#475569", color: "#fff", border: "none", borderRadius: 4 }}
            >
              Sign In as Globex Corp (Tenant B)
            </button>
          </div>
        </div>

        {/* Tab switch */}
        <div style={{ display: "flex", borderBottom: "2px solid #e2e8f0", marginBottom: "1.25rem" }}>
          <button
            type="button"
            onClick={() => { setAuthMode("login"); setAuthError(null); }}
            style={{
              flex: 1,
              padding: "0.5rem",
              background: "none",
              border: "none",
              borderBottom: authMode === "login" ? "2px solid #2563eb" : "none",
              fontWeight: authMode === "login" ? "bold" : "normal",
              cursor: "pointer",
            }}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode("signup"); setAuthError(null); }}
            style={{
              flex: 1,
              padding: "0.5rem",
              background: "none",
              border: "none",
              borderBottom: authMode === "signup" ? "2px solid #2563eb" : "none",
              fontWeight: authMode === "signup" ? "bold" : "normal",
              cursor: "pointer",
            }}
          >
            Sign Up (New Tenant / User)
          </button>
        </div>

        {/* Auth form */}
        <form onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div>
            <label htmlFor="auth-email" style={{ display: "block", fontSize: "0.85rem", marginBottom: 2 }}>
              Email address
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="user@company.com"
              style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label htmlFor="auth-password" style={{ display: "block", fontSize: "0.85rem", marginBottom: 2 }}>
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder={authMode === "signup" ? "At least 6 characters" : "Enter password"}
              style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
            />
          </div>

          {authMode === "signup" && (
            <div>
              <label htmlFor="auth-tenant" style={{ display: "block", fontSize: "0.85rem", marginBottom: 2 }}>
                Company / Tenant ID
              </label>
              <input
                id="auth-tenant"
                type="text"
                required
                value={authTenantId}
                onChange={(e) => setAuthTenantId(e.target.value)}
                placeholder="e.g. acme-corp, stark-industries"
                style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
              />
              <small style={{ color: "#666", fontSize: "0.75rem" }}>
                All users with this Tenant ID share company invoices.
              </small>
            </div>
          )}

          <button
            type="submit"
            id="auth-submit-btn"
            disabled={authSubmitting}
            style={{
              padding: "10px",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              fontWeight: "bold",
              cursor: "pointer",
              marginTop: "0.5rem",
            }}
          >
            {authSubmitting
              ? "Processing…"
              : authMode === "signup"
              ? "Create Account & Sign In"
              : "Log In"}
          </button>
        </form>

        {authError && (
          <p id="auth-error" style={{ color: "red", marginTop: "1rem", background: "#fee2e2", padding: "8px", borderRadius: 4 }}>
            {authError}
          </p>
        )}
      </div>
    );
  }

  // Logged in -> Invoice Intake Service
  return (
    <div style={{ maxWidth: 760, margin: "2rem auto", fontFamily: "system-ui, sans-serif", padding: "0 1rem" }}>
      {/* Top User Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 6,
          padding: "0.75rem 1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <span style={{ fontSize: "0.9rem", color: "#64748b" }}>Logged in as: </span>
          <strong>{currentUser.email}</strong>
          <span style={{ marginLeft: "1rem", background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: 4, fontSize: "0.85rem", fontWeight: 600 }}>
            Tenant: {currentUser.tenantId}
          </span>
        </div>
        <button
          type="button"
          id="logout-btn"
          onClick={handleLogout}
          style={{ padding: "4px 10px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 4, cursor: "pointer" }}
        >
          Sign Out
        </button>
      </div>

      <h1>Invoice Intake</h1>
      <p style={{ color: "#64748b", marginTop: "-0.5rem", marginBottom: "1.25rem" }}>
        Submit extracted invoice JSON. Line items are validated to exact cents.
      </p>

      {/* Invoice Intake Form */}
      <form onSubmit={handleSubmitInvoice}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="vendor-code" style={{ display: "block", fontSize: "0.8rem", marginBottom: 2 }}>
              Vendor Code
            </label>
            <input
              id="vendor-code"
              placeholder="e.g. ACME-001"
              required
              value={vendorCode}
              onChange={(e) => setVendorCode(e.target.value)}
              style={{ width: "100%", padding: "6px 8px", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="invoice-number" style={{ display: "block", fontSize: "0.8rem", marginBottom: 2 }}>
              Invoice Number
            </label>
            <input
              id="invoice-number"
              placeholder="e.g. INV-2026-001"
              required
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              style={{ width: "100%", padding: "6px 8px", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label htmlFor="invoice-date" style={{ display: "block", fontSize: "0.8rem", marginBottom: 2 }}>
              Invoice Date
            </label>
            <input
              id="invoice-date"
              type="date"
              required
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              style={{ padding: "6px 8px" }}
            />
          </div>
        </div>

        <fieldset style={{ marginBottom: "0.75rem", border: "1px solid #cbd5e1", borderRadius: 4, padding: "0.75rem" }}>
          <legend style={{ fontWeight: 600, fontSize: "0.9rem" }}>Line Items</legend>
          {lines.map((line, i) => (
            <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.35rem" }}>
              <input
                placeholder="Description"
                required
                value={line.description}
                onChange={(e) => updateLine(i, "description", e.target.value)}
                style={{ flex: 3, padding: "6px 8px" }}
              />
              <input
                placeholder="Amount (e.g. 0.10)"
                required
                value={line.amount}
                onChange={(e) => updateLine(i, "amount", e.target.value)}
                style={{ flex: 1, padding: "6px 8px" }}
              />
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  style={{ padding: "0 8px", cursor: "pointer", background: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b" }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addLine}
            style={{ marginTop: "0.25rem", padding: "4px 8px", cursor: "pointer", fontSize: "0.85rem" }}
          >
            + Add Line Item
          </button>
        </fieldset>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}>
          <label htmlFor="total" style={{ fontWeight: 600 }}>
            Declared Total ($):
          </label>
          <input
            id="total"
            placeholder="e.g. 0.30"
            required
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            style={{ width: 130, padding: "6px 8px" }}
          />
        </div>

        <button
          id="submit-btn"
          type="submit"
          disabled={submitting}
          style={{
            padding: "8px 18px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          {submitting ? "Submitting Invoice…" : "Submit Invoice"}
        </button>
      </form>

      {/* Error — shown strictly when !res.ok */}
      {error && (
        <div
          id="error-msg"
          style={{
            color: "#b91c1c",
            background: "#fee2e2",
            border: "1px solid #f87171",
            borderRadius: 4,
            padding: "0.75rem",
            marginTop: "1rem",
            fontWeight: 500,
          }}
        >
          ⚠️ Error: {error}
        </div>
      )}

      {/* Success — shown strictly when res.ok */}
      {success && (
        <div
          id="success-msg"
          style={{
            color: "#15803d",
            background: "#dcfce7",
            border: "1px solid #86efac",
            borderRadius: 4,
            padding: "0.75rem",
            marginTop: "1rem",
            fontWeight: 500,
          }}
        >
          ✅ {success}
        </div>
      )}

      <hr style={{ margin: "2rem 0", borderColor: "#e2e8f0" }} />

      {/* Invoices List for Current Tenant */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
        <h2>Invoices for Tenant &ldquo;{currentUser.tenantId}&rdquo;</h2>
        <button
          type="button"
          onClick={loadInvoices}
          disabled={loadingInvoices}
          style={{ fontSize: "0.8rem", padding: "2px 8px", cursor: "pointer" }}
        >
          {loadingInvoices ? "Refreshing…" : "🔄 Refresh"}
        </button>
      </div>

      {invoices.length === 0 ? (
        <p style={{ color: "#64748b", fontStyle: "italic" }}>
          No invoices submitted for {currentUser.tenantId} yet. Submit one above!
        </p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.5rem" }}>
          <thead>
            <tr style={{ background: "#f1f5f9", textAlign: "left", fontSize: "0.85rem" }}>
              <th style={{ padding: "8px", border: "1px solid #e2e8f0" }}>Invoice #</th>
              <th style={{ padding: "8px", border: "1px solid #e2e8f0" }}>Vendor</th>
              <th style={{ padding: "8px", border: "1px solid #e2e8f0" }}>Date</th>
              <th style={{ padding: "8px", border: "1px solid #e2e8f0" }}>Lines</th>
              <th style={{ padding: "8px", border: "1px solid #e2e8f0", textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} style={{ borderBottom: "1px solid #e2e8f0", fontSize: "0.9rem" }}>
                <td style={{ padding: "8px", border: "1px solid #e2e8f0", fontWeight: 600 }}>{inv.invoiceNumber}</td>
                <td style={{ padding: "8px", border: "1px solid #e2e8f0" }}>{inv.vendorCode}</td>
                <td style={{ padding: "8px", border: "1px solid #e2e8f0" }}>{inv.invoiceDate}</td>
                <td style={{ padding: "8px", border: "1px solid #e2e8f0" }}>
                  {inv.lines ? inv.lines.length : 0} items
                </td>
                <td style={{ padding: "8px", border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600 }}>
                  ${inv.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
