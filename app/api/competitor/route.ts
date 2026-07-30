import { google } from "@ai-sdk/google";
import { convertToModelMessages, isStepCount, jsonSchema, streamText, tool, type UIMessage } from "ai";
import { fetchWebPage, fetchWikipedia } from "../../../lib/agent-tools";
import { getLlmRequestContext, recordApiUsage } from "../../../lib/api-usage";

export const maxDuration = 90;

const baseTools = {
  readWebPage: tool({
    description: "Pobiera treść strony firmowej lub artykułu pod podanym adresem URL.",
    inputSchema: jsonSchema<{ url: string }>({ type: "object", properties: { url: { type: "string" } }, required: ["url"], additionalProperties: false }),
    execute: async ({ url }) => fetchWebPage(url),
  }),
  searchWikipedia: tool({
    description: "Wyszukuje firmę lub produkt w polskiej Wikipedii i zwraca streszczenie oraz link.",
    inputSchema: jsonSchema<{ query: string }>({ type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false }),
    execute: async ({ query }) => fetchWikipedia(query),
  }),
};

const system = `Jesteś analitykiem konkurencji. Gdy użytkownik poda nazwy trzech firm, autonomicznie zbierasz informacje i porównujesz je.

PROCES:
1. Dla KAŻDEJ firmy użyj searchWikipedia. Gdy google_search jest dostępne, użyj go również do aktualnych informacji i źródeł; czytaj najważniejsze znalezione strony przez readWebPage.
2. Zbierz opis, branżę, wielkość, produkty, ceny, mocne i słabe strony. Nie wymyślaj danych; ceny oznaczaj jako orientacyjne lub brak danych.
3. Uwzględnij kontekst użytkownika w rekomendacji. Odpowiadaj po polsku, bez opisu wewnętrznego procesu.

FORMAT:
# 🏢 Analiza konkurencji
## Porównanie
| Aspekt | Firma 1 | Firma 2 | Firma 3 |
|--------|---------|---------|---------|
| Branża | ... | ... | ... |
| Wielkość | ... | ... | ... |
| Główny produkt | ... | ... | ... |
| Mocne strony | ... | ... | ... |
| Słabe strony | ... | ... | ... |
| Ceny (orientacyjne) | ... | ... | ... |
## Szczegółowa analiza
[Osobny nagłówek dla każdej firmy i 3–4 zdania.]
## Rekomendacja
[Najlepsza opcja w kontekście użytkownika i dlaczego.]
## Źródła
- [Nazwa źródła](https://example.com)
Linki źródłowe muszą być prawdziwymi adresami wykorzystanymi w analizie.`;

export async function POST(request: Request) {
  try {
    const usageContext = await getLlmRequestContext(request);
    if ("error" in usageContext) return usageContext.error;
    const { messages }: { messages: UIMessage[] } = await request.json();
    const tools = process.env.ENABLE_SEARCH_GROUNDING === "true" ? { ...baseTools, google_search: google.tools.googleSearch({}) } : baseTools;
    const result = streamText({ model: google("gemini-3.1-flash-lite"), system, messages: await convertToModelMessages(messages, { tools }), tools, stopWhen: isStepCount(10), temperature: 0.2, onFinish: ({ usage }) => { void recordApiUsage(usageContext.database, usageContext.user.id, usage, "gemini-3.1-flash-lite", "/api/competitor").catch(console.error); } });
    return result.toUIMessageStreamResponse({ sendSources: true });
  } catch (error) {
    console.error("competitor analysis error", error);
    return Response.json({ error: "Nie udało się przygotować analizy konkurencji." }, { status: 500 });
  }
}
