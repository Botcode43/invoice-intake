import { z } from "zod";

const MONEY_REGEX = /^\d+(\.\d{1,2})?$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const signupSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  tenantId: z.string().trim().min(1, "Company / Tenant ID is required"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const invoiceLineSchema = z.object({
  description: z.string().trim().min(1, "Line item description cannot be empty"),
  amount: z.string().trim().regex(MONEY_REGEX, "Line item amount must be a non-negative money string (e.g. 10.50)"),
});

export const createInvoiceSchema = z.object({
  vendorCode: z.string().trim().min(1, "Vendor code cannot be empty"),
  invoiceNumber: z.string().trim().min(1, "Invoice number cannot be empty"),
  invoiceDate: z
    .string()
    .trim()
    .regex(DATE_REGEX, "Invoice date must be in YYYY-MM-DD format")
    .refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime()) && val === date.toISOString().slice(0, 10);
    }, "Invoice date must be a valid calendar date"),
  lines: z.array(invoiceLineSchema).min(1, "At least one line item is required"),
  total: z.string().trim().regex(MONEY_REGEX, "Total must be a non-negative money string (e.g. 10.50)"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type InvoiceLineInput = z.infer<typeof invoiceLineSchema>;
