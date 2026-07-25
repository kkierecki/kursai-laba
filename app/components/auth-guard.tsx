"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const { data } = await supabase.auth.getUser();
      if (!active) return;

      if (!data.user && !isLoginPage) {
        router.replace("/login");
      } else if (data.user && isLoginPage) {
        router.replace("/");
      }
      setReady(true);
    }

    void checkSession();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && !isLoginPage) router.replace("/login");
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [isLoginPage, router]);

  if (!ready) {
    return <main className="auth-loading">Sprawdzam sesję…</main>;
  }

  if (isLoginPage) return <>{children}</>;
  return <>{children}</>;
}
