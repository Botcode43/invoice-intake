import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invoice Intake",
  description: "Multi-tenant invoice intake service",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
