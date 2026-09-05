import { Request, Response, NextFunction } from "express";

export function requirePermission(permissionKey: string) {
  return (req: any, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, error: "Authentication required" });
    if (req.user.isAdmin || req.user.permissions.has(permissionKey)) {
      req.requiredPermission = permissionKey;
      return next();
    }
    return res.status(403).json({ success: false, error: "Forbidden" });
  };
}

export function requireAnyPermission(permissionKeys: string[]) {
  return (req: any, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, error: "Authentication required" });
    if (req.user.isAdmin || permissionKeys.some((key) => req.user.permissions.has(key))) {
      req.requiredPermission = permissionKeys.join("|");
      return next();
    }
    return res.status(403).json({ success: false, error: "Forbidden" });
  };
}

export function requirePermissionForPurchaseOrderUpdate(req: any, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ success: false, error: "Authentication required" });
  if (req.user.isAdmin) return next();

  const hasStatus = req.body.status !== undefined;
  const hasOtherFields = Object.keys(req.body).some((key) => key !== "status");

  if (hasStatus && !req.user.permissions.has("purchase_orders.approve")) {
    return res.status(403).json({ success: false, error: "Forbidden: You do not have permission to change status of purchase orders." });
  }
  if (hasOtherFields && !req.user.permissions.has("purchase_orders.edit")) {
    return res.status(403).json({ success: false, error: "Forbidden: You do not have permission to edit purchase orders." });
  }
  next();
}
