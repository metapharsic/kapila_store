import { z } from "zod";
import { CLIENT_UNITS } from "./stockValidation";

export const indentItemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  qty: z.number().positive("Quantity must be positive"),
  unit: z.enum(CLIENT_UNITS, { errorMap: () => ({ message: "Invalid unit" }) }),
  itemCode: z.string().min(1, "Item code is required").max(20),
});

export const indentSchema = z.object({
  dept: z.string().min(1, "Department name is required").max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  indentType: z.enum(["routine", "adhoc"]).optional().default("routine"),
  items: z.array(indentItemSchema).min(1, "At least one item is required to raise an indent"),
});

export type IndentItemInput = z.infer<typeof indentItemSchema>;
export type IndentInput = z.infer<typeof indentSchema>;
