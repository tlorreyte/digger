import { createFileRoute } from '@tanstack/react-router';
import { startLogin } from '@/authkit/ssr/session';
import { redirectWithFallback } from '@/api/helpers';

export const Route = createFileRoute('/api/auth/login')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const returnPathname = new URL(request.url).searchParams.get('returnPathname') ?? undefined;
        return redirectWithFallback(await startLogin(returnPathname));
      },
    },
  },
});
