import { redirect, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context }) => {
    if (!context.user || !context.organisationId) {
      throw redirect({ href: '/' });
    }
    return { user: context.user, organisationId: context.organisationId };
  },
});
