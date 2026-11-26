import radixCssUrl from '@radix-ui/themes/styles.css?url';
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { getAuth, getSignInUrl } from '@/authkit/serverFunctions';
import type { ReactNode } from 'react';
import globalCssUrl from '@/styles/global.css?url';
import { Toaster } from '@/components/ui/toaster';
import { getPublicServerConfig } from '@/lib/env.server';

// PostHog integration
import { PostHogProvider } from 'posthog-js/react';

export const Route = createRootRoute({
  beforeLoad: async () => {
    // Run auth and config in parallel (they don't depend on each other)
    const [authResult, publicServerConfig] = await Promise.all([
      getAuth(),
      getPublicServerConfig()
    ]);
    
    const { auth, organisationId } = authResult;
    return {
      user: auth.user,
      organisationId,
      organisationName: organisationId,
      organizations: auth.organizations ?? [],
      publicServerConfig,
    };
  },
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'OpenTaco - Future of IaC is open',
      },
    ],
  }),
  loader: async ({ context }) => {
    const { user, publicServerConfig } = context as any;
    // Only fetch sign-in URL if user is not authenticated
    const url = !user ? await getSignInUrl() : null;
    return {
      user,
      url,
      publicServerConfig,
    } as any;
  },
  component: DashboardRootComponent,
  notFoundComponent: () => <div>Not Found</div>,
});

function DashboardRootComponent() {
  const data = (Route as any).useLoaderData?.() || {};
  return (
    <DashboardRootDocument publicServerConfig={data.publicServerConfig}>
      <Outlet />
      <TanStackRouterDevtools position="bottom-right" />
    </DashboardRootDocument>
  );
}

function DashboardRootDocument({ children, publicServerConfig }: Readonly<{ children: ReactNode, publicServerConfig?: any }>) {
  return (
    <html>
      <head>
        <HeadContent />
        {/* Preload and apply critical CSS to avoid FOUC */}
        <link rel="preload" as="style" href={radixCssUrl} />
        <link rel="stylesheet" href={radixCssUrl} />
        <link rel="preload" as="style" href={globalCssUrl} />
        <link rel="stylesheet" href={globalCssUrl} />
        {/* App icons */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/favicon.png" />
      </head>
      <body>
        {publicServerConfig?.POSTHOG_KEY ? (
          <PostHogProvider
            apiKey={publicServerConfig.POSTHOG_KEY}
            options={{
              api_host: publicServerConfig.POSTHOG_HOST,
              defaults: '2025-05-24',
              capture_exceptions: true,
              debug: false,
            }}
          >
            {children}
            <Toaster />
            <Scripts />
          </PostHogProvider>
        ) : (
          <>
            {children}
            <Toaster />
            <Scripts />
          </>
        )}
      </body>
    </html>
  );
}