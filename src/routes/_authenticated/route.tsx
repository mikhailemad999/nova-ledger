import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { TenantProvider } from "@/hooks/useTenant";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      // The backend may be unreachable (e.g. paused). With a cached session, let the app
      // through so the workspace loading state can offer a retry instead of a dead end.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw redirect({ to: "/auth" });
      return { user: sessionData.session.user };
    }
    return { user: data.user };
  },
  component: () => (
    <TenantProvider>
      <Outlet />
    </TenantProvider>
  ),
});
