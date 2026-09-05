import { Request, Response, NextFunction } from "express";

export default (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  if (err.name === "ZodError") {
    // Build a human-readable string so the client never renders "[object Object]".
    const message = (err.errors || [])
      .map((e: any) => {
        const path = (e.path || []).join(".");
        return path ? `${path}: ${e.message}` : e.message;
      })
      .join("; ");
    return res.status(400).json({
      success: false,
      error: message || "Validation failed",
      details: err.errors, // structured issues kept for debugging
    });
  }
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
};
