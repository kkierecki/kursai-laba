"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (newPassword !== confirmation) {
      setError("Nowe hasło i jego powtórzenie muszą być takie same.");
      return;
    }
    if (!email) {
      setError("Nie udało się odczytać adresu e-mail bieżącego konta.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: verificationError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (verificationError) throw new Error("Obecne hasło jest nieprawidłowe.");
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setMessage("Hasło zostało zmienione.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się zmienić hasła.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="account-shell">
      <section className="account-card" aria-labelledby="account-title">
        <p className="section-eyebrow">Konto</p>
        <h1 id="account-title">Zmiana hasła</h1>
        <p className="account-description">Dla bezpieczeństwa potwierdź obecne hasło przed ustawieniem nowego.</p>
        <form className="account-form" onSubmit={submit}>
          <label>Adres e-mail<input autoComplete="email" disabled type="email" value={email} /></label>
          <label>Obecne hasło<input autoComplete="current-password" minLength={6} onChange={(event) => setCurrentPassword(event.target.value)} required type="password" value={currentPassword} /></label>
          <label>Nowe hasło<input autoComplete="new-password" minLength={6} onChange={(event) => setNewPassword(event.target.value)} required type="password" value={newPassword} /></label>
          <label>Powtórz nowe hasło<input autoComplete="new-password" minLength={6} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} /></label>
          {error && <p className="account-error" role="alert">{error}</p>}
          {message && <p className="account-message" role="status">{message}</p>}
          <button disabled={isSubmitting} type="submit">{isSubmitting ? "Zmieniam hasło…" : "Zmień hasło"}</button>
        </form>
      </section>
    </main>
  );
}
