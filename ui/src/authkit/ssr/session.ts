import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server';
import { sealData, unsealData } from 'iron-session';
import { decodeJwt } from 'jose';
import { getAuthConfig } from './config';
import {
  buildAuthorizationUrl,
  exchangeCode,
  organizationsFromGroups,
  randomToken,
  refreshTokens,
  verifyIdToken,
  type IdTokenClaims,
  type TokenSet,
} from './oidc';

export type User = {
  id: string;
  email: string;
  name?: string;
};

export type Session = {
  idToken: string;
  refreshToken?: string;
  user: User;
  organizationId: string;
};

export type UserInfo = {
  user: User;
  organizationId: string;
  organizations: string[];
};

export type NoUserInfo = {
  user: null;
  organizationId?: undefined;
  organizations?: undefined;
};

type PendingLogin = {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnPathname: string;
};

const LOGIN_TTL_SECONDS = 600;
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;
const EXPIRY_SKEW_SECONDS = 30;

function cookieOptions(maxAge: number) {
  const { redirectUri, cookieDomain } = getAuthConfig();
  return {
    path: '/',
    httpOnly: true,
    secure: redirectUri.startsWith('https:'),
    sameSite: 'lax' as const,
    maxAge,
    domain: cookieDomain,
  };
}

function loginCookieName() {
  return `${getAuthConfig().cookieName}-login`;
}

function seal(data: object): Promise<string> {
  return sealData(data, { password: getAuthConfig().cookiePassword, ttl: 0 });
}

async function unseal<T>(cookie: string | undefined): Promise<T | undefined> {
  if (!cookie) return undefined;
  try {
    return await unsealData<T>(cookie, { password: getAuthConfig().cookiePassword });
  } catch {
    return undefined;
  }
}

function safeReturnPathname(pathname: string | undefined): string {
  return pathname && pathname.startsWith('/') && !pathname.startsWith('//') ? pathname : '/';
}

function sessionFromTokens(tokens: TokenSet, claims: IdTokenClaims, preferredOrganization?: string): Session | null {
  const organizations = organizationsFromGroups(claims.groups);
  if (organizations.length === 0) return null;
  return {
    idToken: tokens.idToken,
    refreshToken: tokens.refreshToken,
    user: { id: claims.sub, email: claims.email ?? '', name: claims.name ?? claims.preferred_username },
    organizationId:
      preferredOrganization && organizations.includes(preferredOrganization) ? preferredOrganization : organizations[0],
  };
}

export function organizationsOf(session: Session): string[] {
  return organizationsFromGroups(decodeJwt<IdTokenClaims>(session.idToken).groups);
}

export async function saveSession(session: Session): Promise<void> {
  setCookie(getAuthConfig().cookieName, await seal(session), cookieOptions(SESSION_MAX_AGE_SECONDS));
}

export function clearSession(): void {
  deleteCookie(getAuthConfig().cookieName, cookieOptions(0));
}

function isExpired(idToken: string): boolean {
  const { exp } = decodeJwt(idToken);
  return exp !== undefined && exp - EXPIRY_SKEW_SECONDS <= Date.now() / 1000;
}

async function refreshSession(session: Session): Promise<Session | null> {
  if (!session.refreshToken) return null;
  try {
    const tokens = await refreshTokens(session.refreshToken);
    const claims = await verifyIdToken(tokens.idToken);
    return sessionFromTokens(
      { idToken: tokens.idToken, refreshToken: tokens.refreshToken ?? session.refreshToken },
      claims,
      session.organizationId,
    );
  } catch (error) {
    console.error('Failed to refresh session', error);
    return null;
  }
}

export async function getSessionFromCookie(): Promise<Session | null> {
  const session = await unseal<Session>(getCookie(getAuthConfig().cookieName));
  if (!session?.idToken) return null;
  if (!isExpired(session.idToken)) return session;

  const refreshed = await refreshSession(session);
  if (refreshed) {
    await saveSession(refreshed);
  } else {
    clearSession();
  }
  return refreshed;
}

export async function withAuth(): Promise<UserInfo | NoUserInfo> {
  const session = await getSessionFromCookie();
  if (!session) return { user: null };
  return { user: session.user, organizationId: session.organizationId, organizations: organizationsOf(session) };
}

export async function startLogin(returnPathname: string | undefined): Promise<string> {
  const pending: PendingLogin = {
    state: randomToken(),
    nonce: randomToken(),
    codeVerifier: randomToken(),
    returnPathname: safeReturnPathname(returnPathname),
  };
  setCookie(loginCookieName(), await seal(pending), cookieOptions(LOGIN_TTL_SECONDS));
  return buildAuthorizationUrl(pending);
}

export type LoginResult =
  | { status: 'ok'; session: Session; returnPathname: string }
  | { status: 'no_organization'; email?: string };

export async function completeLogin(code: string, state: string): Promise<LoginResult> {
  const pending = await unseal<PendingLogin>(getCookie(loginCookieName()));
  deleteCookie(loginCookieName(), cookieOptions(0));
  if (!pending || pending.state !== state) {
    throw new Error('Invalid or expired login state');
  }

  const tokens = await exchangeCode(code, pending.codeVerifier);
  const claims = await verifyIdToken(tokens.idToken, pending.nonce);
  const session = sessionFromTokens(tokens, claims);
  if (!session) return { status: 'no_organization', email: claims.email };

  await saveSession(session);
  return { status: 'ok', session, returnPathname: pending.returnPathname };
}
