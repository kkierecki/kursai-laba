"use client";

import { FormEvent, useState } from "react";

const examples = [
  "Wygeneruj techniczny szkic trzymasztowego barku z opisanymi elementami takielunku",
  "Wygeneruj minimalistyczny plakat motywacyjny dla biegacza długodystansowego",
  "Wygeneruj infografikę: 5 zasad regeneracji po mocnym treningu biegowym",
  "Wygeneruj ikonę buta biegowego i pulsometru w nowoczesnym stylu",
  "Wygeneruj czytelną planszę stref tętna dla biegacza",
  "Wygeneruj realistyczne zdjęcie biegacza na leśnej ścieżce o świcie",
];

type GeneratedImage = {
  image: string;
  text: string;
};

export default function GeneratePage() {
  const [prompt, setPrompt] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const [result, setResult] = useState<GeneratedImage | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function generate(text: string) {
    if (!text.trim() || isLoading) {
      return;
    }

    setIsLoading(true);
    setError("");
    setLastPrompt(text.trim());

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: text.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Nie udało się wygenerować obrazu.");
      }

      setResult(data);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Nie udało się wygenerować obrazu.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await generate(prompt);
  }

  function downloadImage() {
    if (!result?.image) {
      return;
    }

    const link = document.createElement("a");
    link.href = result.image;
    link.download = "ai-generated.png";
    link.click();
  }

  return (
    <main className="chat-shell">
      <section className="chat-panel generate-panel" aria-label="Generator grafik AI">
        <header className="chat-header">
          <h1>🎨 Generator grafik AI</h1>
          <p>Opisz co chcesz - AI stworzy obraz w kilka sekund</p>
          <div className="example-questions" aria-label="Przykładowe prompty">
            {examples.map((example) => (
              <button
                disabled={isLoading}
                key={example}
                onClick={() => setPrompt(example)}
                type="button"
              >
                {example}
              </button>
            ))}
          </div>
        </header>

        <form className="image-generator-form" onSubmit={handleSubmit}>
          <textarea
            disabled={isLoading}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Opisz obraz który chcesz wygenerować..."
            value={prompt}
          />
          <button disabled={isLoading || prompt.trim().length === 0} type="submit">
            🎨 Generuj
          </button>
        </form>

        <div className="image-result-area">
          {isLoading && (
            <div className="image-loading">Generuję... (5-15 sekund)</div>
          )}
          {error && <div className="image-error">{error}</div>}
          {result && !isLoading && (
            <div className="image-result">
              <img alt="Wygenerowana grafika AI" src={result.image} />
              <p>{result.text}</p>
              <div className="result-actions">
                <button onClick={downloadImage} type="button">
                  💾 Pobierz
                </button>
                <button onClick={() => generate(lastPrompt)} type="button">
                  🔄 Ponownie
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
