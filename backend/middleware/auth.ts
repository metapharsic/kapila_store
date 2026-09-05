import { Request, Response, NextFunction } from "express";
const { verifyAccessToken, isStoreSessionValid } = require("../services/authService");
const { getUserAuthContext } = require("../services/permissionService");

export async function authenticate(req: any, res: Response, next: NextFunction) {
  try {
    const header = req.get("authorization") || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ success: false, error: "Authentication required" });

    const payload = verifyAccessToken(match[1]);
    const sessionId = req.get("x-session-id") || payload.sessionId;
    if (sessionId) {
      const validSession = await isStoreSessionValid(sessionId);
      if (!validSession) {
        return res.status(401).json({ success: false, error: "Session has been terminated by administrator" });
      }
    }

    const user = await getUserAuthContext(parseInt(payload.sub, 10));
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, error: "User inactive or not found" });
    }

    req.user = { ...user, permissions: new Set(user.permissions || []), sessionId };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}
