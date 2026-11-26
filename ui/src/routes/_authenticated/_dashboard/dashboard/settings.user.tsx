import { createFileRoute } from '@tanstack/react-router'
import OrgSwitcher from '@/components/OrgSwitcher'

export const Route = createFileRoute(
  '/_authenticated/_dashboard/dashboard/settings/user',
)({
  component: RouteComponent,
  loader: async ({ context }) => {
    const { user, organisationId, organizations } = context
    return { user, organisationId, organizations }
  }
})

function RouteComponent() {
  const { user, organisationId, organizations } = Route.useLoaderData()

  return (
    <div className="max-w-3xl space-y-6 py-6">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Name</p>
        <p>{user?.name || '-'}</p>
      </div>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Email</p>
        <p>{user?.email || '-'}</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">GitHub organization</p>
        <div className="max-w-xs">
          <OrgSwitcher organizations={organizations} organizationId={organisationId} redirectTo="/dashboard/settings/user" />
        </div>
        <p className="text-sm text-muted-foreground">
          Organizations come from your GitHub organization memberships. Membership changes apply on your next sign-in.
        </p>
      </div>
    </div>
  )
}
