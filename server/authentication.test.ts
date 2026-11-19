import assert from "node:assert/strict";
import { after, test } from "node:test";
import type { Request, Response } from "express";
import {
  createAuthenticate,
  endRequestLoginSessions,
  signAuthCookie,
  type AuthenticationStorage,
} from "./authentication";

const originalSessionSecret = process.env.SESSION_SECRET;
process.env.SESSION_SECRET = "managerplanner-auth-test-secret";
after(() => {
  if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = originalSessionSecret;
});

type TestUser = {
  id: string;
  username: string;
  role: string;
  accountStatus: string;
};

type TestLoginSession = {
  id: string;
  userId: string;
  logoutAt: number | null;
};

class MemoryAuthStorage implements AuthenticationStorage {
  readonly users = new Map<string, TestUser>();
  readonly sessions = new Map<string, TestLoginSession>();
  failSessionCheck = false;
  failSessionEnd = false;

  async getUser(id: string): Promise<TestUser | undefined> {
    return this.users.get(id);
  }

  async isLoginSessionActive(id: string, userId: string): Promise<boolean> {
    if (this.failSessionCheck) throw new Error("temporary test outage");
    const loginSession = this.sessions.get(id);
    return Boolean(loginSession && loginSession.userId === userId && loginSession.logoutAt === null);
  }

  async touchLoginSession(_id: string): Promise<void> {}

  async endLoginSession(id: string): Promise<void> {
    if (this.failSessionEnd) throw new Error("temporary test outage");
    const loginSession = this.sessions.get(id);
    if (loginSession) loginSession.logoutAt = Date.now();
  }
}

function makeStorage(accountStatus = "active"): MemoryAuthStorage {
  const storage = new MemoryAuthStorage();
  storage.users.set("user-1", {
    id: "user-1",
    username: "test.user",
    role: "manager",
    accountStatus,
  });
  storage.sessions.set("login-1", { id: "login-1", userId: "user-1", logoutAt: null });
  return storage;
}

function makeRequest(
  cookie?: string,
  session: { userId?: string; loginSessionId?: string; lastActivityTrackedAt?: number } = {},
) {
  return {
    headers: { cookie },
    session: { ...session },
    user: undefined,
  } as unknown as Request;
}

function makeResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    appendedHeaders: [] as Array<[string, string]>,
    clearedCookies: [] as string[],
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    append(name: string, value: string) {
      this.appendedHeaders.push([name, value]);
      return this;
    },
    setHeader(name: string, value: string) {
      this.appendedHeaders.push([name, value]);
      return this;
    },
    clearCookie(name: string) {
      this.clearedCookies.push(name);
      return this;
    },
  };
  return response as unknown as Response & typeof response;
}

function signedCookie(userId = "user-1", loginSessionId = "login-1"): string {
  return `mp_auth=${signAuthCookie(userId, loginSessionId)}`;
}

async function authenticate(storage: AuthenticationStorage, req: Request) {
  const res = makeResponse();
  let nextCalled = false;
  await createAuthenticate(storage)(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled, req };
}

test("accepts the signed cookie when the Express session store has no session", async () => {
  const storage = makeStorage();
  const result = await authenticate(storage, makeRequest(signedCookie()));

  assert.equal(result.nextCalled, true);
  assert.equal(result.req.user?.id, "user-1");
});

test("logout revokes a cookie-only session so a copied cookie cannot be reused", async () => {
  const storage = makeStorage();
  const req = makeRequest(signedCookie());

  await endRequestLoginSessions(req, storage);
  const result = await authenticate(storage, makeRequest(signedCookie()));

  assert.equal(storage.sessions.get("login-1")?.logoutAt === null, false);
  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 401);
});

test("a blocked account cannot reuse an otherwise active signed cookie", async () => {
  const storage = makeStorage("blocked");
  const result = await authenticate(storage, makeRequest(signedCookie()));

  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 403);
});

test("an administrator-ended login session rejects the copied cookie", async () => {
  const storage = makeStorage();
  await storage.endLoginSession("login-1");
  const result = await authenticate(storage, makeRequest(signedCookie()));

  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 401);
});

test("does not accept an active session id when it belongs to another user", async () => {
  const storage = makeStorage();
  storage.sessions.set("login-1", { id: "login-1", userId: "somebody-else", logoutAt: null });
  const result = await authenticate(storage, makeRequest(signedCookie()));

  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 401);
});

test("a valid signed cookie overrides stale Express session data after regeneration trouble", async () => {
  const storage = makeStorage();
  storage.users.set("old-user", {
    id: "old-user",
    username: "old.user",
    role: "manager",
    accountStatus: "active",
  });
  storage.sessions.set("old-login", { id: "old-login", userId: "old-user", logoutAt: null });
  const req = makeRequest(signedCookie(), { userId: "old-user", loginSessionId: "old-login" });

  const result = await authenticate(storage, req);

  assert.equal(result.nextCalled, true);
  assert.equal(result.req.user?.id, "user-1");
});

test("uses the normal server-side Express session when no signed cookie is present", async () => {
  const storage = makeStorage();
  const result = await authenticate(
    storage,
    makeRequest(undefined, { userId: "user-1", loginSessionId: "login-1" }),
  );

  assert.equal(result.nextCalled, true);
  assert.equal(result.req.user?.id, "user-1");
});

test("fails closed with 503 when the session store cannot verify revocation state", async () => {
  const storage = makeStorage();
  storage.failSessionCheck = true;
  const result = await authenticate(storage, makeRequest(signedCookie()));

  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 503);
});

test("does not report logout as successful when revocation cannot be saved", async () => {
  const storage = makeStorage();
  storage.failSessionEnd = true;

  await assert.rejects(endRequestLoginSessions(makeRequest(signedCookie()), storage));
  assert.equal(storage.sessions.get("login-1")?.logoutAt, null);
});
