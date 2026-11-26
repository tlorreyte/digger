import { createFileRoute } from '@tanstack/react-router';
import { getSessionFromCookie, organizationsOf, saveSession } from '@/authkit/ssr/session';
import { syncOrganization } from '@/api/helpers';

export const Route = createFileRoute('/api/auth/switch-org')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { organizationId, pathname } = (await request.json()) as { organizationId?: string; pathname?: string };
        const session = await getSessionFromCookie();
        if (!session) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!organizationId || !organizationsOf(session).includes(organizationId)) {
          return Response.json({ error: 'You are not a member of this organization' }, { status: 403 });
        }

        await syncOrganization(organizationId, session.user);
        await saveSession({ ...session, organizationId });

        const redirectUrl = pathname && pathname.startsWith('/') && !pathname.startsWith('//') ? pathname : '/dashboard/units';
        return Response.json({ redirectUrl });
      },
    },
  },
});
