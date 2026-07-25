import Link from "next/link";

export default function ExtractPage() {
  return (
    <main className="chat-shell">
      <section className="chat-panel" aria-label="Analizator">
        <header className="chat-header">
          <h1>📊 Analizator</h1>
          <p>Analiza treści i obrazów jest dostępna w trybie Vision.</p>
        </header>
        <div className="messages">
          <p className="empty-state">
            Wklej screenshot, prześlij plik albo przeciągnij obraz na stronie{" "}
            <Link href="/vision">Vision</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
