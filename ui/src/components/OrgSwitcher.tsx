import { useRouter } from '@tanstack/react-router'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

type OrgSwitcherProps = {
  organizations: string[]
  organizationId: string
  redirectTo?: string
}

export default function OrgSwitcher({ organizations, organizationId, redirectTo = '/dashboard/units' }: OrgSwitcherProps) {
  const router = useRouter()
  const { toast } = useToast()

  const switchOrganization = async (nextOrganizationId: string) => {
    try {
      const res = await fetch('/api/auth/switch-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: nextOrganizationId, pathname: redirectTo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Failed to switch organization')
      await router.navigate({ to: data.redirectUrl })
      router.invalidate()
    } catch (e: any) {
      toast({
        title: 'Failed to switch organization',
        description: e?.message ?? 'Failed to switch organization',
        variant: 'destructive',
      })
    }
  }

  return (
    <Select value={organizationId} onValueChange={switchOrganization}>
      <SelectTrigger aria-label="GitHub organization">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {organizations.map((org) => (
          <SelectItem key={org} value={org}>
            {org}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
