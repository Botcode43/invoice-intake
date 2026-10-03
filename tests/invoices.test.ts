import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/invoices/route";
import { buildRequest, truncateTables } from "./helpers";

describe("Invoices API Integration Tests", () => {
  beforeEach(async () => {
    await truncateTables();
  });

  it("Tenant isolation on read: Tenant A creates an invoice; Tenant B's GET does not contain it", async () => {
    const sessionA = { userId: "user-a", tenantId: "tenant-a" };
    const sessionB = { userId: "user-b", tenantId: "tenant-b" };

    // 1. Tenant A creates an invoice
    const createReq = buildRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      session: sessionA,
      body: {
        vendorCode: "VEND-100",
        invoiceNumber: "INV-001",
        invoiceDate: "2026-03-15",
        lines: [
          { description: "Item 1", amount: "50.00" },
          { description: "Item 2", amount: "50.00" },
        ],
        total: "100.00",
      },
    });

    const createRes = await POST(createReq);
    expect(createRes.status).toBe(201);
    const createdData = await createRes.json();
    expect(createdData.invoiceNumber).toBe("INV-001");
    expect(createdData.tenantId).toBe("tenant-a");

    // 2. Tenant A fetches invoices -> invoice is present
    const getReqA = buildRequest("http://localhost:3000/api/invoices", {
      method: "GET",
      session: sessionA,
    });
    const getResA = await GET(getReqA);
    expect(getResA.status).toBe(200);
    const dataA = await getResA.json();
    expect(dataA.invoices).toHaveLength(1);
    expect(dataA.invoices[0].invoiceNumber).toBe("INV-001");

    // 3. Tenant B fetches invoices -> empty list (cannot see Tenant A's data)
    const getReqB = buildRequest("http://localhost:3000/api/invoices", {
      method: "GET",
      session: sessionB,
    });
    const getResB = await GET(getReqB);
    expect(getResB.status).toBe(200);
    const dataB = await getResB.json();
    expect(dataB.invoices).toHaveLength(0);
  });

  it("Tenant spoofing resistance: body/header tenantId is ignored and saved strictly under authenticated tenant", async () => {
    const sessionA = { userId: "user-a", tenantId: "tenant-a" };
    const sessionB = { userId: "user-b", tenantId: "tenant-b" };

    // Tenant A attempts to spoof and create invoice under tenant B via body and headers
    const spoofReq = buildRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      session: sessionA,
      headers: {
        "x-tenant-id": "tenant-b",
      },
      body: {
        tenantId: "tenant-b", // Attempted override in body
        vendorCode: "VEND-SPOOF",
        invoiceNumber: "INV-999",
        invoiceDate: "2026-03-20",
        lines: [{ description: "Spoof Line", amount: "15.00" }],
        total: "15.00",
      },
    });

    const res = await POST(spoofReq);
    expect(res.status).toBe(201);
    const created = await res.json();

    // Must be saved under tenant-a, NOT tenant-b
    expect(created.tenantId).toBe("tenant-a");

    // Confirm tenant B cannot see it
    const getReqB = buildRequest("http://localhost:3000/api/invoices", {
      method: "GET",
      session: sessionB,
    });
    const resB = await GET(getReqB);
    const dataB = await resB.json();
    expect(dataB.invoices).toHaveLength(0);

    // Confirm tenant A owns it
    const getReqA = buildRequest("http://localhost:3000/api/invoices", {
      method: "GET",
      session: sessionA,
    });
    const resA = await GET(getReqA);
    const dataA = await resA.json();
    expect(dataA.invoices).toHaveLength(1);
    expect(dataA.invoices[0].invoiceNumber).toBe("INV-999");
  });

  it("Money validation: 0.10 + 0.20 with total 0.30 returns 201; total 0.31 returns 422", async () => {
    const session = { userId: "user-a", tenantId: "tenant-a" };

    // 1. Correct sum: 0.10 + 0.20 == 0.30 -> 201
    const validReq = buildRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      session,
      body: {
        vendorCode: "VEND-CALC",
        invoiceNumber: "INV-VALID-SUM",
        invoiceDate: "2026-03-22",
        lines: [
          { description: "Line 1", amount: "0.10" },
          { description: "Line 2", amount: "0.20" },
        ],
        total: "0.30",
      },
    });

    const validRes = await POST(validReq);
    expect(validRes.status).toBe(201);

    // 2. Mismatched sum: 0.10 + 0.20 with declared total 0.31 -> 422
    const invalidReq = buildRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      session,
      body: {
        vendorCode: "VEND-CALC",
        invoiceNumber: "INV-INVALID-SUM",
        invoiceDate: "2026-03-22",
        lines: [
          { description: "Line 1", amount: "0.10" },
          { description: "Line 2", amount: "0.20" },
        ],
        total: "0.31",
      },
    });

    const invalidRes = await POST(invalidReq);
    expect(invalidRes.status).toBe(422);
    const errorData = await invalidRes.json();
    expect(errorData.error).toBe("Line items add up to 0.30 but total is 0.31");
  });

  it("Duplicate detection: same vendor+number in same tenant returns 409; in different tenant returns 201", async () => {
    const sessionA = { userId: "user-a", tenantId: "tenant-a" };
    const sessionB = { userId: "user-b", tenantId: "tenant-b" };

    const invoicePayload = {
      vendorCode: "VEND-DUP",
      invoiceNumber: "INV-DUP-100",
      invoiceDate: "2026-03-25",
      lines: [{ description: "Service", amount: "10.00" }],
      total: "10.00",
    };

    // 1. First insert for Tenant A -> 201
    const req1 = buildRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      session: sessionA,
      body: invoicePayload,
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(201);

    // 2. Duplicate insert for Tenant A -> 409 Conflict
    const req2 = buildRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      session: sessionA,
      body: invoicePayload,
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(409);
    const res2Data = await res2.json();
    expect(res2Data.error).toBe("Invoice already exists for this vendor and invoice number");

    // 3. Same vendor + invoice number for Tenant B -> 201 Created (allowed in different tenant)
    const req3 = buildRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      session: sessionB,
      body: invoicePayload,
    });
    const res3 = await POST(req3);
    expect(res3.status).toBe(201);
  });

  it("Unauthorized access: missing or invalid session returns 401", async () => {
    // 1. Missing session on GET
    const getReq = buildRequest("http://localhost:3000/api/invoices", {
      method: "GET",
    });
    const getRes = await GET(getReq);
    expect(getRes.status).toBe(401);
    const getData = await getRes.json();
    expect(getData.error).toBe("Unauthorized");

    // 2. Missing session on POST
    const postReq = buildRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      body: {
        vendorCode: "VEND-1",
        invoiceNumber: "INV-1",
        invoiceDate: "2026-03-25",
        lines: [{ description: "Item", amount: "10.00" }],
        total: "10.00",
      },
    });
    const postRes = await POST(postReq);
    expect(postRes.status).toBe(401);
    const postData = await postRes.json();
    expect(postData.error).toBe("Unauthorized");

    // 3. Tampered cookie on GET
    const tamperedReq = new Request("http://localhost:3000/api/invoices", {
      method: "GET",
      headers: {
        cookie: "session=invalid.payload.and.signature",
      },
    });
    const tamperedRes = await GET(tamperedReq);
    expect(tamperedRes.status).toBe(401);
  });
});
