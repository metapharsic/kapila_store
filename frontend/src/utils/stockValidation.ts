import { z } from "zod";

export const CLIENT_UNITS = [
  "kg", "g", "L", "ml", "pcs", "dozen", "box",
  "bottle", "pkt", "tin", "jar", "bulk",
  "plates", "portions",
] as const;

export const stockSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  qty: z.number().positive("Quantity must be positive"),
  unit: z.enum(CLIENT_UNITS, { errorMap: () => ({ message: "Invalid unit" }) }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  price: z.number().positive().optional().nullable(),
  supplier: z.string().max(100).optional().nullable(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").optional().nullable(),
  minAlertQty: z.number().positive().optional().nullable(),
  itemCode: z.string().min(1).max(20).optional().nullable(),
  category: z.string().max(60).optional().nullable(),
});

export type StockInput = z.infer<typeof stockSchema>;
