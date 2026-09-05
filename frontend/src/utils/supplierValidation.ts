import { z } from "zod";

export const supplierUpdateSchema = z.object({
  name: z.string().min(1, "Supplier name is required").max(100),
  contactName: z.string().max(100).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email("Invalid email address").or(z.string().length(0)).optional().nullable(),
  gstNumber: z.string().max(20).optional().nullable(),
  address: z.string().optional().nullable(),
  rating: z.number().min(1.0).max(5.0).optional().nullable(),
});

export type SupplierUpdateInput = z.infer<typeof supplierUpdateSchema>;
