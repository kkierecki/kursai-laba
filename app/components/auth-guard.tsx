"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const isPublicAuthPage = pathname === "/login" || pathname === "/reset-password";

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const { data } = await supabase.auth.getUser();
      if (!active) return;

      if (!data.user && !isPublicAuthPage) {
        router.replace("/login");
      } else if (data.user && pathname === "/login") {
        router.replace("/");
      }
      setAuthenticated(Boolean(data.user));
      setReady(true);
    }

    void checkSession();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(Boolean(session));
      if (!session && !isPublicAuthPage) router.replace("/login");
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [isPublicAuthPage, pathname, router]);

  if (!ready || (!isPublicAuthPage && !authenticated)) {
    return <main className="auth-loading">Sprawdzam sesję…</main>;
  }

  return <>{children}</>;
}
