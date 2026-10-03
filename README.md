# Tenant-Safe Multi-Tenant Invoice Intake Service

A secure, multi-tenant invoice intake service built with Next.js 16 (App Router), TypeScript, PostgreSQL (`pg` driver with plain SQL, no ORM), Zod, and Vitest.

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


---

## ⚠️ What I did not finish or am unsure about

- **Dev-only Authentication**: Authentication uses a simple signed session cookie via HMAC-SHA256 and a development route (`POST /api/dev-login`). A production service would integrate an Identity Provider (OIDC / OAuth / Auth0 / Clerk / NextAuth) or password hash verification with session revocation.
- **No Row-Level Security (RLS)**: Tenant isolation is enforced at the application query level via parameterized SQL `WHERE tenant_id = $1`. In higher security environments, PostgreSQL Row Level Security (RLS) with session settings (`SET LOCAL app.current_tenant = ...`) could provide defense-in-depth at the DB engine layer.
- **No Negative Amounts or Credit Notes**: All line items and totals are strictly validated as non-negative amounts. Supporting refunds, discounts, or credit adjustments would require explicit credit note schema handling.
- **No Pagination / Filtering**: `listInvoices` returns all invoices for a tenant ordered by creation date without cursor-based or offset pagination or date range filtering.
- **No Rate Limiting / Abuse Protection**: The endpoints do not include rate limiting (e.g., Redis token bucket) or request payload size limits.

---

## AI usage
I used Antigravity (AI coding agent) to scaffold the project and write most of the code and tests. I reviewed the tenant isolation, money handling and schema myself and ran the tests and `next build` locally. Commits it helped with carry a Co-Authored-By trailer.
