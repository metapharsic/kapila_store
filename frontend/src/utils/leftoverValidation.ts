import { z } from "zod";
import { CLIENT_UNITS } from "./stockValidation";

export const leftoverSchema = z.object({
  dept: z.string().min(1, "Department name is required").max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  item: z.string().min(1, "Item name is required").max(100),
  qty: z.number().positive("Quantity must be positive"),
  unit: z.enum(CLIENT_UNITS, { errorMap: () => ({ message: "Invalid unit" }) }),
  carriedForward: z.boolean().optional().default(true),
});

export type LeftoverInput = z.infer<typeof leftoverSchema>;
