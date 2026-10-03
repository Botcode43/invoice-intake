# Tenant-Safe Multi-Tenant Invoice Intake Service

A secure, multi-tenant invoice intake service built with Next.js 15 (App Router), TypeScript, PostgreSQL (`pg` driver with plain SQL, no ORM), Zod, and Vitest.

---

## 🚀 Quick Setup & Run Instructions

### 1. Start PostgreSQL with Docker
```bash
docker run -d --name pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16-alpine
```

### 2. Create Dev and Test Databases
```bash
docker exec -it pg psql -U postgres -c "CREATE DATABASE invoices;"
docker exec -it pg psql -U postgres -c "CREATE DATABASE invoices_test;"
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure your `.env` contains:
```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/invoices
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/invoices_test
SESSION_SECRET=change-me-to-a-long-random-string
```

### 4. Install Dependencies & Run Database Migrations
```bash
npm install
npm run db:migrate
```
*`npm run db:migrate` applies `db/schema.sql` to both `DATABASE_URL` (dev) and `TEST_DATABASE_URL` (test).*

### 5. Run Tests
```bash
npm test
```

### 6. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔒 Where Tenant Isolation is Enforced

Tenant isolation is strictly enforced at two key locations in the backend and cannot be overridden by user payloads or request headers:

1. **Read Operations (`GET /api/invoices`)**:
   - **File**: `lib/invoices-repo.ts`
   - **Function**: `listInvoices(tenantId: string)`
   - **Line / Query**:
     ```sql
     SELECT id, tenant_id, vendor_code, invoice_number, invoice_date, total_cents, created_by, created_at
     FROM invoices
     WHERE tenant_id = $1
     ORDER BY created_at DESC;
     ```
     The authenticated session's `tenantId` is passed directly from `getSession(request)` in `app/api/invoices/route.ts` into `listInvoices(session.tenantId)`.

2. **Write / Ingestion Operations (`POST /api/invoices`)**:
   - **File**: `app/api/invoices/route.ts` & `lib/invoices-repo.ts`
   - **Functions**: `POST(request: Request)` & `createInvoice(tenantId: string, userId: string, data: CreateInvoiceInput)`
   - The Zod validation schema (`createInvoiceSchema` in `lib/schemas.ts`) does not contain `tenantId` and strips unknown fields. The database `INSERT` takes `tenant_id` exclusively from the verified session:
     ```sql
     INSERT INTO invoices (tenant_id, vendor_code, invoice_number, invoice_date, total_cents, created_by)
     VALUES ($1, $2, $3, $4, $5, $6);
     ```

3. **Duplicate Prevention**:
   - Database constraint: `CONSTRAINT uq_invoices_tenant_vendor_invoice_number UNIQUE (tenant_id, vendor_code, invoice_number)` in `db/schema.sql`.
   - In `app/api/invoices/route.ts`, duplicate insertion catches Postgres error code `23505` and returns HTTP `409 Conflict`.

4. **Safe Money Handling**:
   - `lib/money.ts` parses amounts into integer cents (`bigint`) using strict regular expression parsing (`/^\d+(\.\d{1,2})?$/`) without floating-point math.

---

## ⚠️ What I did not finish or am unsure about

- **Dev-only Authentication**: Authentication uses a simple signed session cookie via HMAC-SHA256 and a development route (`POST /api/dev-login`). A production service would integrate an Identity Provider (OIDC / OAuth / Auth0 / Clerk / NextAuth) or password hash verification with session revocation.
- **No Row-Level Security (RLS)**: Tenant isolation is enforced at the application query level via parameterized SQL `WHERE tenant_id = $1`. In higher security environments, PostgreSQL Row Level Security (RLS) with session settings (`SET LOCAL app.current_tenant = ...`) could provide defense-in-depth at the DB engine layer.
- **No Negative Amounts or Credit Notes**: All line items and totals are strictly validated as non-negative amounts. Supporting refunds, discounts, or credit adjustments would require explicit credit note schema handling.
- **No Pagination / Filtering**: `listInvoices` returns all invoices for a tenant ordered by creation date without cursor-based or offset pagination or date range filtering.
- **No Rate Limiting / Abuse Protection**: The endpoints do not include rate limiting (e.g., Redis token bucket) or request payload size limits.

---

## 🤖 AI usage

AI assisted (antigravity) with scaffolding the project structure, typing boilerplate, and writing unit/integration test suites. All business logic, tenant isolation boundaries, money handling logic, and database schemas were carefully reviewed and validated against live PostgreSQL and Next.js builds.
