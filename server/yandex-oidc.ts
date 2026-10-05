import crypto from "node:crypto";

type OidcConfig = {
  clientId: string;
  clientSecret: string;
  issuer: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
  jwksUrl: string;
  redirectUri: string;
  scope: string;
};

type OidcClaims = {
  sub: string;
  email: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  middle_name?: string;
  nonce?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
};

const base64Url = (value: Buffer | string) =>
  Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

function stateSigningKey(): string {
  return process.env.SESSION_SECRET || "development-only-secret";
}

type OidcStatePayload = {
  nonce: string;
  verifier: string;
  returnTo: string;
  exp: number;
};

function encryptStatePayload(payload: OidcStatePayload): string {
  const key = crypto.createHash("sha256").update(stateSigningKey()).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return `${base64Url(iv)}.${base64Url(ciphertext)}.${base64Url(cipher.getAuthTag())}`;
}

export function readSignedOidcState(value: string): OidcStatePayload | null {
  const [ivEncoded, ciphertextEncoded, tagEncoded] = value.split(".");
  if (!ivEncoded || !ciphertextEncoded || !tagEncoded) return null;
  try {
    const key = crypto.createHash("sha256").update(stateSigningKey()).digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivEncoded, "base64url"));
    decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
    const payload = JSON.parse(Buffer.concat([
      decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
      decipher.final(),
    ]).toString("utf8")) as OidcStatePayload;
    if (!payload.nonce || !payload.verifier || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing OIDC configuration: ${name}`);
  return value;
}

export function isYandexOidcEnabled(): boolean {
  return Boolean(process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET && process.env.OIDC_REDIRECT_URI);
}

async function getConfig(): Promise<OidcConfig> {
  const issuer = (process.env.OIDC_ISSUER || "https://auth.yandex.cloud").replace(/\/$/, "");
  let metadata: Record<string, string> = {};
  const needsDiscovery = !process.env.OIDC_AUTHORIZATION_URL || !process.env.OIDC_TOKEN_URL || !process.env.OIDC_JWKS_URL;
  if (needsDiscovery) {
    try {
      const discovery = await fetch(`${issuer}/.well-known/openid-configuration`);
      if (discovery.ok) metadata = (await discovery.json()) as Record<string, string>;
    } catch (error) {
      // Some Yandex Cloud container networks cannot reach the discovery endpoint.
      // The documented endpoints below allow login to proceed without discovery.
      console.warn("OIDC discovery unavailable; using configured Yandex endpoints", error);
    }
  }
  const authorizationUrl = process.env.OIDC_AUTHORIZATION_URL || metadata.authorization_endpoint || `${issuer}/oauth/authorize`;
  const tokenUrl = process.env.OIDC_TOKEN_URL || metadata.token_endpoint || `${issuer}/oauth/token`;
  const userInfoUrl = process.env.OIDC_USERINFO_URL || metadata.userinfo_endpoint || `${issuer}/oauth/userinfo`;
  const jwksUrl = process.env.OIDC_JWKS_URL || metadata.jwks_uri || `${issuer}/oauth/jwks`;
  return {
    clientId: required("OIDC_CLIENT_ID"),
    clientSecret: required("OIDC_CLIENT_SECRET"),
    issuer,
    authorizationUrl,
    tokenUrl,
    userInfoUrl,
    jwksUrl,
    redirectUri: required("OIDC_REDIRECT_URI"),
    scope: process.env.OIDC_SCOPE || "openid email profile",
  };
}

export function createOidcTransaction() {
  const nonce = base64Url(crypto.randomBytes(32));
  const verifier = base64Url(crypto.randomBytes(48));
  const challenge = base64Url(crypto.createHash("sha256").update(verifier).digest());
  const state = encryptStatePayload({
    nonce,
    verifier,
    returnTo: "/",
    exp: Math.floor(Date.now() / 1000) + 10 * 60,
  });
  return { state, nonce, verifier, challenge };
}

export async function buildAuthorizationUrl(transaction: ReturnType<typeof createOidcTransaction>): Promise<string> {
  const config = await getConfig();
  const url = new URL(config.authorizationUrl);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope,
    state: transaction.state,
    nonce: transaction.nonce,
    code_challenge: transaction.challenge,
    code_challenge_method: "S256",
    ...(process.env.OIDC_PROMPT ? { prompt: process.env.OIDC_PROMPT } : {}),
  }).toString();
  return url.toString();
}

function decodePart(part: string): Record<string, any> {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

async function verifyIdToken(token: string, config: OidcConfig, nonce: string): Promise<OidcClaims> {
  const pieces = token.split(".");
  if (pieces.length !== 3) throw new Error("Invalid OIDC ID token");
  const header = decodePart(pieces[0]);
  const claims = decodePart(pieces[1]) as OidcClaims;
  const jwksResponse = await fetch(config.jwksUrl);
  if (!jwksResponse.ok) throw new Error(`OIDC JWKS request failed: ${jwksResponse.status}`);
  const jwks = (await jwksResponse.json()) as { keys: JsonWebKey[] };
  const jwk = jwks.keys.find((key: any) => key.kid === header.kid);
  if (!jwk) throw new Error("OIDC signing key not found");
  const publicKey = crypto.createPublicKey({ key: jwk as any, format: "jwk" });
  const signature = Buffer.from(pieces[2], "base64url");
  const algorithm = header.alg === "PS256" ? "RSA-SHA256" : header.alg === "ES256" ? "sha256" : "RSA-SHA256";
  const valid = crypto.verify(algorithm, Buffer.from(`${pieces[0]}.${pieces[1]}`), {
    key: publicKey,
    ...(header.alg === "ES256" ? { dsaEncoding: "der" as const } : {}),
  }, signature);
  if (!valid) throw new Error("Invalid OIDC ID token signature");
  if ((claims.iss || "").replace(/\/$/, "") !== config.issuer) throw new Error("Invalid OIDC issuer");
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes(config.clientId)) throw new Error("Invalid OIDC audience");
  if (claims.nonce !== nonce) throw new Error("Invalid OIDC nonce");
  if (!claims.exp || claims.exp <= Math.floor(Date.now() / 1000)) throw new Error("Expired OIDC ID token");
  if (!claims.sub) throw new Error("OIDC subject is missing");
  return claims;
}

export async function exchangeCode(code: string, verifier: string, nonce: string): Promise<OidcClaims> {
  const config = await getConfig();
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code_verifier: verifier,
    }),
  });
  if (!response.ok) throw new Error(`OIDC token exchange failed: ${response.status}`);
  const tokens = (await response.json()) as { id_token?: string; access_token?: string };
  if (!tokens.id_token) throw new Error("OIDC response does not contain id_token");
  const claims = await verifyIdToken(tokens.id_token, config, nonce);
  if (!claims.email && tokens.access_token && config.userInfoUrl) {
    const userInfo = await fetch(config.userInfoUrl, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (userInfo.ok) Object.assign(claims, await userInfo.json());
  }
  if (!claims.email) throw new Error("Corporate email is missing in OIDC profile");
  return claims;
}
