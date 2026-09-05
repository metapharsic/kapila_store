import crypto from "crypto";
import jwt from "jsonwebtoken";
import db from "../db";
import { getUserAuthContext } from "./permissionService";

const ACCESS_TTL = process.env.JWT_ACCESS_TTL || "15m";
const REFRESH_DAYS = parseInt(process.env.REFRESH_TOKEN_DAYS || "7", 10);

function jwtSecret(): string {
  if (!process.env.JWT_SECRET) {
    throw new Error("FATAL: JWT_SECRET environment variable is missing.");
  }
  return process.env.JWT_SECRET;
}

export function signAccessToken(user: any, sessionId?: number | string): string {
  const payload: any = {
    sub: String(user.id),
    email: user.email,
    roles: user.roles.map((role: any) => role.key),
  };
  if (sessionId) {
    payload.sessionId = String(sessionId);
  }
  return jwt.sign(
    payload,
    jwtSecret(),
    { expiresIn: ACCESS_TTL } as jwt.SignOptions
  );
}

export async function isStoreSessionValid(sessionId: number | string): Promise<boolean> {
  if (!sessionId) return true;
  const session = await db("store_sessions").where("id", sessionId).first();
  if (!session) return true;
  return session.status !== "TERMINATED_BY_ADMIN" && session.status !== "CLOSED";
}

export function verifyAccessToken(token: string): any {
  return jwt.verify(token, jwtSecret());
}

export function createOpaqueToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

interface IssuedToken {
  token: string;
  expiresAt: Date;
}

export async function issueRefreshToken(userId: number, req: any): Promise<IssuedToken> {
  // DB-03: Cleanup expired tokens periodically to prevent unbound growth
  if (Math.random() < 0.1) {
    await db("refresh_tokens").where("expires_at", "<", new Date()).delete().catch(() => {});
  }

  const token = createOpaqueToken();
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  await db("refresh_tokens").insert({
    user_id: userId,
    token_hash: hashToken(token),
    expires_at: expiresAt,
    created_ip: req.ip || null,
    user_agent: req.get?.("user-agent") || null,
  });
  return { token, expiresAt };
}

interface RotatedSession {
  user: any;
  accessToken: string;
  refreshToken: string;
}

export async function rotateRefreshToken(token: string, req: any): Promise<RotatedSession> {
  const tokenHash = hashToken(token);
  const existing = await db("refresh_tokens")
    .where("token_hash", tokenHash)
    .whereNull("revoked_at")
    .where("expires_at", ">", new Date())
    .first();

  if (!existing) {
    throw Object.assign(new Error("Invalid refresh token."), { status: 401 });
  }

  await db("refresh_tokens").where("id", existing.id).update({ revoked_at: db.fn.now() });
  const user = await getUserAuthContext(existing.user_id);
  if (!user || !user.is_active) {
    throw Object.assign(new Error("User inactive."), { status: 401 });
  }
  const refresh = await issueRefreshToken(user.id, req);
  return { user, accessToken: signAccessToken(user), refreshToken: refresh.token };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  if (!token) return;
  await db("refresh_tokens")
    .where("token_hash", hashToken(token))
    .whereNull("revoked_at")
    .update({ revoked_at: db.fn.now() });
}

export async function revokeUserRefreshTokens(userId: number): Promise<void> {
  await db("refresh_tokens")
    .where("user_id", userId)
    .whereNull("revoked_at")
    .update({ revoked_at: db.fn.now() });
}

interface CookieSettings {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict" | "lax" | "none";
  path: string;
}

export function cookieOptions(): CookieSettings {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth",
  };
}

export function publicUser(user: any): any {
  return {
    id: user.id,
    employee_code: user.employee_code,
    name: user.name,
    email: user.email,
    phone: user.phone,
    is_active: user.is_active,
    must_change_password: user.must_change_password,
    last_login_at: user.last_login_at,
    roles: user.roles,
    permissions: user.permissions,
    departments: user.departments,
  };
}
