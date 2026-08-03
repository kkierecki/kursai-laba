"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ready, setReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || Boolean(session)) setReady(true);
    });
    void supabase.auth.getSession().then(({ data: { session } }) => setReady(Boolean(session)));
    return () => subscription.subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirmation) {
      setError("Wpisane hasła muszą być takie same.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      router.replace("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się ustawić nowego hasła.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <p className="login-eyebrow">Odzyskiwanie dostępu</p>
        <h1>Ustaw nowe hasło</h1>
        <p>{ready ? "Wybierz nowe hasło do swojego konta." : "Link jest nieprawidłowy lub wygasł. Poproś o nowy link na stronie logowania."}</p>
        {ready && <>
          <label>Nowe hasło<input autoComplete="new-password" minLength={6} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
          <label>Powtórz nowe hasło<input autoComplete="new-password" minLength={6} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} /></label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button disabled={isSubmitting} type="submit">{isSubmitting ? "Zapisywanie…" : "Ustaw nowe hasło"}</button>
        </>}
        <Link className="login-switch login-link" href="/login">Wróć do logowania</Link>
      </form>
    </main>
  );
}
