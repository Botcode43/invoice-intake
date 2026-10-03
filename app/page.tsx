import InvoiceForm from "@/components/InvoiceForm";

export default function Page() {
  return (
    <main style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1rem" }}>
      <header style={{ marginBottom: "2rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "1rem" }}>
        <h1 style={{ margin: "0 0 0.5rem 0", fontSize: "1.75rem", color: "#1e293b" }}>
          Invoice Intake Service
        </h1>
        <p style={{ margin: 0, color: "#64748b", fontSize: "0.95rem" }}>
          Multi-tenant secure invoice intake with exact cent reconciliation.
        </p>
      </header>
      <InvoiceForm />
    </main>
  );
}
