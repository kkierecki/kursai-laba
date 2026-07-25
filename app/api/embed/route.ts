import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { text } = (await request.json()) as { text?: unknown };
  if (typeof text !== "string" || !text.trim()) return NextResponse.json({ error: "Tekst jest wymagany." }, { status: 400 });
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Brak klucza Gemini w konfiguracji serwera." }, { status: 500 });
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "models/gemini-embedding-2", content: { parts: [{ text: text.trim() }] }, output_dimensionality: 768 }) });
  const payload = (await response.json()) as { embedding?: { values?: number[] }; error?: { message?: string } };
  if (!response.ok || !payload.embedding?.values) return NextResponse.json({ error: payload.error?.message ?? "Nie udało się wygenerować embeddingu." }, { status: response.status || 502 });
  return NextResponse.json({ embedding: payload.embedding.values });
}
