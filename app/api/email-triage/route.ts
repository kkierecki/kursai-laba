import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { getLlmRequestContext, recordApiUsage } from "../../../lib/api-usage";

export const maxDuration = 90;

const system = `Jesteś profesjonalnym asystentem do zarządzania pocztą.
Dla każdego maila określ kategorię (zapytanie ofertowe, reklamacja, spam, informacja, prośba o spotkanie), priorytet (Wysoki, Średni, Niski lub Spam), uzasadnienie i krótki profesjonalny draft odpowiedzi. Dla spamu i newslettera napisz: Brak odpowiedzi.

Zwróć WYŁĄCZNIE format:
### Mail [numer]: [krótki temat]
Kategoria: [typ]
Priorytet: [Wysoki | Średni | Niski | Spam]
Uzasadnienie: [krótko]
Proponowana odpowiedź:
> [draft]
---

PODSUMOWANIE
Pilne: [liczba]
Średnie: [liczba]
Niskie: [liczba]
Spam: [liczba]
Rekomendacja: [który mail obsłużyć najpierw i dlaczego]
Odpowiadaj po polsku i nie wymyślaj danych.`;

export async function POST(request: Request) {
  try {
    const usageContext = await getLlmRequestContext(request);
    if ("error" in usageContext) return usageContext.error;
    const body = (await request.json()) as { emails?: unknown };
    if (!Array.isArray(body.emails) || body.emails.length === 0 || body.emails.some((email) => typeof email !== "string")) {
      return Response.json({ error: "Pole emails musi być niepustą tablicą tekstów." }, { status: 400 });
    }
    const prompt = body.emails.map((email, index) => `MAIL ${index + 1}:\n${email}`).join("\n\n");
    const result = streamText({ model: google("gemini-3.1-flash-lite"), system, prompt: `Przeanalizuj poniższe maile:\n\n${prompt}`, temperature: 0.2 });
    void result.usage.then(
      (usage) => recordApiUsage(usageContext.database, usageContext.user.id, usage, "gemini-3.1-flash-lite", "/api/email-triage"),
      console.error,
    );
    return result.toTextStreamResponse();
  } catch (error) {
    console.error("email-triage error", error);
    return Response.json({ error: "Nie udało się uruchomić analizy maili." }, { status: 500 });
  }
}
