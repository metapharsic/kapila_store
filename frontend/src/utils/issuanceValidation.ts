import { z } from "zod";
import { CLIENT_UNITS } from "./stockValidation";

export const issuanceItemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  qty: z.number().positive("Requested quantity must be positive"),
  issued: z.number().nonnegative("Issued quantity cannot be negative"),
  unit: z.enum(CLIENT_UNITS, { errorMap: () => ({ message: "Invalid unit" }) }),
  itemCode: z.string().min(1).max(20).optional().nullable(),
  unitPrice: z.number().nonnegative().optional().nullable(),
});

export const issuanceSchema = z.object({
  indentId: z.number().int().nullable().optional(),
  dept: z.string().min(1, "Department name is required").max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  scanned: z.boolean().optional(),
  items: z.array(issuanceItemSchema).min(1, "At least one item is required for issuance"),
});

export type IssuanceItemInput = z.infer<typeof issuanceItemSchema>;
export type IssuanceInput = z.infer<typeof issuanceSchema>;
