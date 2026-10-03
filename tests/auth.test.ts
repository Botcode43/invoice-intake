import { describe, it, expect, beforeEach } from "vitest";
import { POST as signupPOST } from "@/app/api/auth/signup/route";
import { POST as loginPOST } from "@/app/api/auth/login/route";
import { POST as invoicesPOST, GET as invoicesGET } from "@/app/api/invoices/route";
import { buildRequest, truncateTables } from "./helpers";

describe("Authentication & Multi-Tenant User Tests", () => {
  beforeEach(async () => {
    await truncateTables();
  });

  it("User signup: successfully creates user and returns 201 with session cookie", async () => {
    const req = buildRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      body: {
        email: "alice@acme.com",
        password: "securepassword123",
        tenantId: "acme-corp",
      },
    });

    const res = await signupPOST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.user.email).toBe("alice@acme.com");
    expect(data.user.tenantId).toBe("acme-corp");

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("session=");
  });

  it("Duplicate signup: registering the same email returns 409 Conflict", async () => {
    const signupBody = {
      email: "duplicate@example.com",
      password: "password123",
      tenantId: "tenant-1",
    };

    // First signup -> 201
    const req1 = buildRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      body: signupBody,
    });
    const res1 = await signupPOST(req1);
    expect(res1.status).toBe(201);

    // Second signup with same email -> 409
    const req2 = buildRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      body: signupBody,
    });
    const res2 = await signupPOST(req2);
    expect(res2.status).toBe(409);
    const data2 = await res2.json();
    expect(data2.error).toBe("A user with this email already exists");
  });

  it("User login: authenticates valid credentials and returns session cookie", async () => {
    // 1. Sign up user
    const signupReq = buildRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      body: {
        email: "bob@globex.com",
        password: "secretpassword",
        tenantId: "globex-corp",
      },
    });
    await signupPOST(signupReq);

    // 2. Login with correct password
    const loginReq = buildRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: {
        email: "bob@globex.com",
        password: "secretpassword",
      },
    });
    const loginRes = await loginPOST(loginReq);
    expect(loginRes.status).toBe(200);
    const data = await loginRes.json();
    expect(data.user.email).toBe("bob@globex.com");
    expect(data.user.tenantId).toBe("globex-corp");
    expect(loginRes.headers.get("set-cookie")).toContain("session=");

    // 3. Login with incorrect password -> 401
    const badPassReq = buildRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: {
        email: "bob@globex.com",
        password: "wrongpassword",
      },
    });
    const badPassRes = await loginPOST(badPassReq);
    expect(badPassRes.status).toBe(401);
  });

  it("Multi-tenant end-to-end: Two distinct users submit invoices; each tenant sees only their own invoices", async () => {
    // 1. Sign up User A (Acme Corp)
    const signupReqA = buildRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      body: { email: "alice@acme.com", password: "password123", tenantId: "acme-corp" },
    });
    const resA = await signupPOST(signupReqA);
    const userA = (await resA.json()).user;

    // 2. Sign up User B (Globex Corp)
    const signupReqB = buildRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      body: { email: "bob@globex.com", password: "password123", tenantId: "globex-corp" },
    });
    const resB = await signupPOST(signupReqB);
    const userB = (await resB.json()).user;

    // 3. User A submits invoice INV-001
    const invoiceA = buildRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      session: { userId: userA.id, tenantId: userA.tenantId },
      body: {
        vendorCode: "SUPPLIER-1",
        invoiceNumber: "INV-001",
        invoiceDate: "2026-03-01",
        lines: [{ description: "Acme Widgets", amount: "150.00" }],
        total: "150.00",
      },
    });
    const createResA = await invoicesPOST(invoiceA);
    expect(createResA.status).toBe(201);

    // 4. User B submits invoice with the EXACT SAME invoice number INV-001
    const invoiceB = buildRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      session: { userId: userB.id, tenantId: userB.tenantId },
      body: {
        vendorCode: "SUPPLIER-1",
        invoiceNumber: "INV-001",
        invoiceDate: "2026-03-02",
        lines: [{ description: "Globex Gadgets", amount: "300.00" }],
        total: "300.00",
      },
    });
    const createResB = await invoicesPOST(invoiceB);
    expect(createResB.status).toBe(201); // Allowed because they are in different tenants!

    // 5. User A queries invoices -> returns ONLY Acme's invoice
    const getReqA = buildRequest("http://localhost:3000/api/invoices", {
      method: "GET",
      session: { userId: userA.id, tenantId: userA.tenantId },
    });
    const getResA = await invoicesGET(getReqA);
    const dataA = await getResA.json();
    expect(dataA.invoices).toHaveLength(1);
    expect(dataA.invoices[0].lines[0].description).toBe("Acme Widgets");
    expect(dataA.invoices[0].total).toBe("150.00");

    // 6. User B queries invoices -> returns ONLY Globex's invoice
    const getReqB = buildRequest("http://localhost:3000/api/invoices", {
      method: "GET",
      session: { userId: userB.id, tenantId: userB.tenantId },
    });
    const getResB = await invoicesGET(getReqB);
    const dataB = await getResB.json();
    expect(dataB.invoices).toHaveLength(1);
    expect(dataB.invoices[0].lines[0].description).toBe("Globex Gadgets");
    expect(dataB.invoices[0].total).toBe("300.00");
  });
});
