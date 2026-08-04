import Link from "next/link";

const features = [
  {
    icon: "◎",
    title: "Trening oparty na Twoich danych",
    text: "Zapisuje potwierdzone treningi, cele i sygnały regeneracji w jednym miejscu.",
  },
  {
    icon: "⌁",
    title: "Analizuje screeny Garmin i Strava",
    text: "Wyciąga tylko jednoznacznie widoczne dane i pomaga zrozumieć każdy bieg.",
  },
  {
    icon: "◌",
    title: "Prywatny profil biegacza",
    text: "Twoja historia oraz preferencje są dostępne wyłącznie na Twoim koncie.",
  },
  {
    icon: "↗",
    title: "Plan na kolejny krok",
    text: "Dopasowuje propozycję treningu do celu, ostatniego wysiłku i regeneracji.",
  },
];

export default function LandingPage() {
  return (
    <main className="landing-shell">
      <nav className="landing-nav" aria-label="Nawigacja strony startowej">
        <Link className="landing-brand" href="/" aria-label="RUNLAB — strona główna">
          <span className="landing-brand-mark" aria-hidden="true" />
          RUN<span>LAB</span>
        </Link>
        <Link className="landing-login" href="/login">Zaloguj się</Link>
      </nav>

      <section className="landing-hero">
        <div className="landing-copy">
          <p className="landing-eyebrow">TWÓJ TRENING. TWOJE TEMPO.</p>
          <h1>Biegaj mądrzej.<br /><em>Docieraj dalej.</em></h1>
          <p className="landing-lead">
            RUNLAB analizuje treningi, regenerację i cele, aby podpowiedzieć Ci najlepszy następny krok.
          </p>
          <div className="landing-actions">
            <Link className="landing-primary" href="/login">Zacznij za darmo <span aria-hidden="true">→</span></Link>
            <a className="landing-secondary" href="#jak-to-dziala">Zobacz, jak działa <span aria-hidden="true">↓</span></a>
          </div>
          <p className="landing-note">Bez karty płatniczej · Start w mniej niż minutę</p>
        </div>

        <div className="landing-preview" aria-label="Przykładowy panel trenera biegania">
          <div className="preview-topbar"><span>RUNLAB</span><i /><i /><i /></div>
          <div className="preview-content">
            <p className="preview-label">DZISIAJ · WTOREK</p>
            <h2>Gotowy na spokojne 7 km?</h2>
            <p className="preview-text">Po wczorajszym odpoczynku organizm wygląda dobrze. Biegnij swobodnie, bez patrzenia na tempo.</p>
            <div className="preview-metrics">
              <div><span>DYSTANS</span><strong>7,0 <small>km</small></strong></div>
              <div><span>INTENSYWNOŚĆ</span><strong>lekka</strong></div>
            </div>
            <div className="preview-message"><span className="preview-avatar">R</span><p>Przyślij po biegu screen z zegarka — zapiszę pewne dane w historii.</p></div>
          </div>
          <div className="preview-orbit preview-orbit-one" /><div className="preview-orbit preview-orbit-two" />
        </div>
      </section>

      <section className="landing-features" id="jak-to-dziala">
        <div className="landing-section-heading"><p>WSZYSTKO, CZEGO POTRZEBUJE BIEGACZ</p><h2>Trener biegania, który zna Twój rytm.</h2></div>
        <div className="landing-feature-grid">
          {features.map((feature) => <article className="landing-feature" key={feature.title}><span className="landing-feature-icon" aria-hidden="true">{feature.icon}</span><h3>{feature.title}</h3><p>{feature.text}</p></article>)}
        </div>
      </section>

      <section className="landing-cta">
        <p>TWÓJ PIERWSZY KROK</p>
        <h2>Gotowy biegać z planem?</h2>
        <Link className="landing-primary light" href="/login">Stwórz darmowe konto <span aria-hidden="true">→</span></Link>
      </section>

      <footer className="landing-footer"><span>© {new Date().getFullYear()} RUNLAB</span><span>Twój indywidualny trener biegania</span></footer>
    </main>
  );
}
