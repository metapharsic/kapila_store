import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { CANONICAL_UNITS } from "../utils/units";

// Single source of truth — mirrors normalizeUnit() output so scan-canonicalized
// units (bottle/pkt/tin/jar/bulk) pass validation instead of throwing.
export const UNITS = CANONICAL_UNITS as [string, ...string[]];

const schemas: Record<string, z.ZodObject<any> | z.ZodEffects<any>> = {
  stock: z.object({
    name: z.string().min(1).max(100),
    qty: z.number().positive(),
    unit: z.enum(UNITS),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    price: z.number().positive().optional().nullable(),
    supplier: z.string().max(100).optional().nullable(),
    expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    min_alert_qty: z.number().positive().optional().nullable(),
    item_code: z.string().min(1).max(20).optional().nullable(),
    category: z.string().max(60).optional().nullable(),
  }),
  indent: z.object({
    dept: z.string().min(1).max(100),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    indent_type: z.enum(["routine", "adhoc"]).optional().default("routine"),
    items: z.array(z.object({ name: z.string().min(1), qty: z.number().positive(), unit: z.enum(UNITS), item_code: z.string().min(1).max(20) })).min(1),
  }),
  issuance: z.object({
    indent_id: z.number().int().nullable().optional(),
    dept: z.string().min(1).max(100),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    scanned: z.boolean().optional(),
    items: z.array(z.object({
      name: z.string().min(1),
      qty: z.number().positive(),
      issued: z.number().nonnegative(),
      unit: z.enum(UNITS),
      item_code: z.string().min(1).max(20).optional().nullable(),
      unit_price: z.number().nonnegative().optional().nullable(),
    })).min(1),
  }),
  production: z.object({
    dept: z.string().min(1).max(100),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    item_name: z.string().min(1).max(100),
    plates: z.number().int().nonnegative(),
    notes: z.string().max(500).optional(),
  }),
  leftover: z.object({
    dept: z.string().min(1).max(100),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    item: z.string().min(1).max(100),
    qty: z.number().positive(),
    unit: z.enum(UNITS),
    carried_forward: z.boolean().optional().default(true),
  }),
  supplier: z.object({
    name: z.string().min(1).max(100),
    contact_name: z.string().max(100).optional().nullable(),
    phone: z.string().max(20).optional().nullable(),
    email: z.string().email().or(z.string().length(0)).optional().nullable(),
    gstin: z.string().max(20).optional().nullable(),
    address: z.string().optional().nullable(),
  }),
  department: z.object({
    name: z.string().min(1).max(100),
    code: z.string().min(1).max(20),
    chef_name: z.string().max(100).optional().nullable(),
  }),
  purchase_order: z.object({
    supplier_id: z.number().int().positive(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(["Draft", "Pending", "Approved", "Rejected", "Sent", "Received", "Cancelled"]).optional(),
    notes: z.string().optional().nullable(),
    items: z.array(z.object({
      item_code: z.string().min(1).max(20),
      name: z.string().min(1).max(100),
      qty: z.number().positive(),
      unit: z.enum(UNITS),
      unit_price: z.number().nonnegative(),
    })).min(1),
  }),
  grn: z.object({
    po_id: z.number().int().positive().optional().nullable(),
    supplier_id: z.number().int().positive(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    invoice_no: z.string().max(50).optional().nullable(),
    received_by: z.string().max(100).optional().nullable(),
    remarks: z.string().optional().nullable(),
    items: z.array(z.object({
      item_code: z.string().min(1).max(20),
      name: z.string().min(1).max(100),
      qty_ordered: z.number().optional().nullable(),
      qty_received: z.number().nonnegative(),
      qty_accepted: z.number().nonnegative(),
      qty_rejected: z.number().nonnegative(),
      unit: z.enum(UNITS),
      unit_price: z.number().nonnegative(),
      landed_cost: z.number().nonnegative(),
      batch_no: z.string().max(50).optional().nullable(),
      expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    })).min(1),
  }),
  audit: z.object({
    reference: z.string().min(1).max(100),
    auditor_name: z.string().min(1).max(100),
    department_id: z.number().int().nullable().optional(),
    notes: z.string().max(1000).optional().nullable(),
  }),
  auditItemUpdate: z.object({
    physical_qty: z.number().nonnegative(),
  }),
  auditFinalise: z.object({
    items: z.array(z.object({
      audit_item_id: z.number().int().positive(),
      discrepancy_reason: z.string().max(500).optional().nullable(),
      action: z.enum(["adjust_db", "recount", "investigate"]).nullable().optional(),
    })).min(1),
  }),
};

export const validate = (schemaName: string) => (req: Request, res: Response, next: NextFunction) => {
  try {
    req.body = schemas[schemaName].parse(req.body);
    next();
  } catch (err) {
    next(err);
  }
};
