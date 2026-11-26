import { base64url, createRemoteJWKSet, jwtVerify } from 'jose';
import { getAuthConfig } from './config';

const SCOPES = 'openid email profile groups offline_access';

type Discovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
};

export type TokenSet = {
  idToken: string;
  refreshToken?: string;
};

export type IdTokenClaims = {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  groups?: string[];
  nonce?: string;
};

let discovery: Promise<Discovery> | undefined;
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getDiscovery(): Promise<Discovery> {
  discovery ??= (async () => {
    const issuer = getAuthConfig().issuerUrl.replace(/\/$/, '');
    const res = await fetch(`${issuer}/.well-known/openid-configuration`);
    if (!res.ok) {
      throw new Error(`OIDC discovery failed for ${issuer}: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as Discovery;
  })().catch((error) => {
    discovery = undefined;
    throw error;
  });
  return discovery;
}

export function randomToken(): string {
  return base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
}

async function codeChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  return base64url.encode(new Uint8Array(digest));
}

export async function buildAuthorizationUrl(params: {
  state: string;
  nonce: string;
  codeVerifier: string;
}): Promise<string> {
  const { authorization_endpoint } = await getDiscovery();
  const { clientId, redirectUri } = getAuthConfig();
  const url = new URL(authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state: params.state,
    nonce: params.nonce,
    code_challenge: await codeChallenge(params.codeVerifier),
    code_challenge_method: 'S256',
  }).toString();
  return url.toString();
}

async function requestTokens(grant: Record<string, string>): Promise<TokenSet> {
  const { token_endpoint } = await getDiscovery();
  const { clientId, clientSecret } = getAuthConfig();
  const res = await fetch(token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`)}`,
    },
    body: new URLSearchParams(grant),
  });
  if (!res.ok) {
    throw new Error(`Token request failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { id_token?: string; refresh_token?: string };
  if (!body.id_token) {
    throw new Error('Token response is missing id_token');
  }
  return { idToken: body.id_token, refreshToken: body.refresh_token };
}

export function exchangeCode(code: string, codeVerifier: string): Promise<TokenSet> {
  return requestTokens({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    redirect_uri: getAuthConfig().redirectUri,
  });
}

export function refreshTokens(refreshToken: string): Promise<TokenSet> {
  return requestTokens({ grant_type: 'refresh_token', refresh_token: refreshToken });
}

export async function verifyIdToken(idToken: string, nonce?: string): Promise<IdTokenClaims> {
  const { issuer, jwks_uri } = await getDiscovery();
  jwks ??= createRemoteJWKSet(new URL(jwks_uri));
  const { payload } = await jwtVerify<IdTokenClaims>(idToken, jwks, {
    issuer,
    audience: getAuthConfig().clientId,
  });
  if (nonce !== undefined && payload.nonce !== nonce) {
    throw new Error('ID token nonce mismatch');
  }
  return payload;
}

// Dex's GitHub connector emits "org:team" groups, plus bare "org" groups with loadAllGroups.
export function organizationsFromGroups(groups: string[] | undefined): string[] {
  return [...new Set((groups ?? []).map((group) => group.split(':')[0]).filter(Boolean))];
}
