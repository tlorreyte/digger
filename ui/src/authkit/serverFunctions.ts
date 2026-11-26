import { createServerFn } from '@tanstack/react-start';
import { redirect } from '@tanstack/react-router';
import { clearSession, withAuth } from './ssr/session';
import type { NoUserInfo, UserInfo } from './ssr/session';

export const getSignInUrl = createServerFn({ method: 'GET' })
  .inputValidator((data?: string) => data)
  .handler(async ({ data: returnPathname }) => {
    const params = returnPathname ? `?${new URLSearchParams({ returnPathname })}` : '';
    return `/api/auth/login${params}`;
  });

export const signOut = createServerFn({ method: 'POST' })
  .inputValidator((data?: string) => data)
  .handler(async ({ data: returnTo }) => {
    clearSession();
    throw redirect({ href: returnTo || '/', reloadDocument: true });
  });

export const getAuth = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ auth: UserInfo | NoUserInfo; organisationId?: string }> => {
    const auth = await withAuth();
    return { auth, organisationId: auth.organizationId };
  },
);
