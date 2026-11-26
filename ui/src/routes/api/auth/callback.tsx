import { createFileRoute } from '@tanstack/react-router';
import { completeLogin } from '@/authkit/ssr/session';
import { redirectWithFallback, errorResponseWithFallback, syncOrganization } from '@/api/helpers';

function noOrganizationResponse(email?: string) {
  const who = email ? ` (${email.replace(/[<>&"']/g, '')})` : '';
  return new Response(
    `<!doctype html><html><body style="font-family:sans-serif;max-width:40rem;margin:4rem auto">
<h2>No GitHub organization</h2>
<p>Your GitHub account${who} is not a member of any GitHub organization allowed on this instance. When the instance restricts sign-in to specific organizations, you must also belong to at least one team in the organization.</p>
<p>Ask an administrator to add you to an allowed GitHub organization, make sure you granted the organization access during sign-in, then <a href="/">try again</a>.</p>
</body></html>`,
    { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

export const Route = createFileRoute('/api/auth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');

        if (code && state) {
          try {
            const result = await completeLogin(code, state);
            if (result.status === 'no_organization') {
              return noOrganizationResponse(result.email);
            }

            const { session, returnPathname } = result;
            await syncOrganization(session.organizationId, session.user);

            return redirectWithFallback(new URL(returnPathname, url.origin).toString());
          } catch (error) {
            console.error({ error: error instanceof Error ? error.message : String(error) });
            return errorResponse();
          }
        }

        return errorResponse();

        function errorResponse() {
          return errorResponseWithFallback({
            error: {
              message: 'Something went wrong',
              description:
                "Couldn't sign in. If you are not sure what happened, please contact your organization admin.",
            },
          });
        }
      },
    },
  },
});
