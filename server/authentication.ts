import type { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";

const AUTH_COOKIE_NAME = "mp_auth";
const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type AuthenticatedAccount = {
  id: string;
  role?: string | null;
  username: string;
  accountStatus?: string | null;
};

export interface AuthenticationStorage {
  getUser(id: string): Promise<AuthenticatedAccount | undefined>;
  isLoginSessionActive(loginSessionId: string, userId: string): Promise<boolean>;
  touchLoginSession(id: string): Promise<void>;
  endLoginSession(id: string): Promise<void>;
}

function authCookieSecret(): string {
  return process.env.SESSION_SECRET || "development-only-secret";
}

export function signAuthCookie(userId: string, loginSessionId: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + AUTH_COOKIE_MAX_AGE_SECONDS;
  const payload = Buffer.from(`${userId}|${loginSessionId}|${expiresAt}`, "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", authCookieSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readAuthCookie(req: Request): { userId: string; loginSessionId: string } | null {
  const raw = req.headers.cookie?.split(";").map(value => value.trim()).find(value => value.startsWith(`${AUTH_COOKIE_NAME}=`));
  if (!raw) return null;
  const token = raw.slice(AUTH_COOKIE_NAME.length + 1);
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", authCookieSecret()).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  const [userId, loginSessionId, expiresAt] = Buffer.from(payload, "base64url").toString("utf8").split("|");
  const expiration = Number(expiresAt);
  if (!userId || !loginSessionId || !Number.isSafeInteger(expiration) || expiration <= Math.floor(Date.now() / 1000)) return null;
  return { userId, loginSessionId };
}

export function setAuthCookie(res: Response, userId: string, loginSessionId: string): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${AUTH_COOKIE_NAME}=${signAuthCookie(userId, loginSessionId)}; Path=/; Max-Age=${AUTH_COOKIE_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure}`);
}

export function clearAuthCookie(res: Response): void {
  res.append("Set-Cookie", `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
}

/** Revoke every server-side login id represented by the current request. */
export async function endRequestLoginSessions(
  req: Request,
  storage: Pick<AuthenticationStorage, "endLoginSession">,
): Promise<void> {
  const sessionIds = new Set(
    [req.session?.loginSessionId, readAuthCookie(req)?.loginSessionId]
      .filter((id): id is string => Boolean(id)),
  );

  const ids = Array.from(sessionIds);
  for (let index = 0; index < ids.length; index += 1) {
    await storage.endLoginSession(ids[index]);
  }
}

export function createAuthenticate(storage: AuthenticationStorage) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let userId: string | undefined;
    let loginSessionId: string | undefined;
    let user: AuthenticatedAccount | undefined;

    try {
      const authCookie = readAuthCookie(req);
      // Prefer the signed cookie when present: it is the intended fallback when
      // PgStore cannot save or restore the Express session.
      userId = authCookie?.userId || req.session?.userId;
      loginSessionId = authCookie?.loginSessionId || req.session?.loginSessionId;

      if (!userId || !loginSessionId) {
        clearAuthCookie(res);
        res.clearCookie("connect.sid");
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!(await storage.isLoginSessionActive(loginSessionId, userId))) {
        clearAuthCookie(res);
        res.clearCookie("connect.sid");
        return res.status(401).json({ message: "Login session is no longer active" });
      }

      user = await storage.getUser(userId);
      if (!user) {
        clearAuthCookie(res);
        res.clearCookie("connect.sid");
        return res.status(401).json({ message: "User not found" });
      }

      if (user.accountStatus && user.accountStatus !== "active") {
        clearAuthCookie(res);
        res.clearCookie("connect.sid");
        return res.status(403).json({ message: "Доступ этой учетной записи заблокирован" });
      }
    } catch (error) {
      console.error("Authentication verification error:", error);
      return res.status(503).json({ message: "Авторизация временно недоступна. Повторите попытку." });
    }

    if (req.session && userId && loginSessionId) {
      req.session.userId = userId;
      req.session.loginSessionId = loginSessionId;
    }
    req.user = {
      id: user.id,
      role: user.role || "user",
      username: user.username,
    };

    const now = Date.now();
    if (
      req.session.loginSessionId &&
      (!req.session.lastActivityTrackedAt || now - req.session.lastActivityTrackedAt >= 60_000)
    ) {
      try {
        await storage.touchLoginSession(req.session.loginSessionId);
        req.session.lastActivityTrackedAt = now;
      } catch (error) {
        console.error("Login session activity tracking error:", error);
      }
    }
    next();
  };
}
