"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      if (isRegistering) {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (data.session) router.replace("/");
        else setMessage("Konto utworzone. Sprawdź skrzynkę e-mail i potwierdź rejestrację.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        router.replace("/");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się uwierzytelnić.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <p className="login-eyebrow">Centrum agenta</p>
        <h1>{isRegistering ? "Załóż konto" : "Zaloguj się"}</h1>
        <p>{isRegistering ? "Utwórz konto, aby zachować prywatne rozmowy i bazę wiedzy." : "Zaloguj się, aby przejść do swojego agenta."}</p>
        <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
        <label>Hasło<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isRegistering ? "new-password" : "current-password"} minLength={6} required /></label>
        {error && <p className="login-error" role="alert">{error}</p>}
        {message && <p className="login-message" role="status">{message}</p>}
        <button disabled={isSubmitting} type="submit">{isSubmitting ? "Proszę czekać…" : isRegistering ? "Zarejestruj się" : "Zaloguj się"}</button>
        <button className="login-switch" disabled={isSubmitting} onClick={() => { setIsRegistering((value) => !value); setError(null); setMessage(null); }} type="button">
          {isRegistering ? "Masz już konto? Zaloguj się" : "Nie masz konta? Zarejestruj się"}
        </button>
      </form>
    </main>
  );
}
