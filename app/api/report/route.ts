import { google } from "@ai-sdk/google";
import { convertToModelMessages, isStepCount, streamText, type UIMessage } from "ai";

export const maxDuration = 90;

// Google Search grounding zapewnia aktualne dane oraz adresy źródeł.
// Nie łączymy go z własnymi narzędziami HTTP, ponieważ część modeli Gemini
// nie obsługuje obu typów narzędzi w jednym żądaniu.
const tools = {
  google_search: google.tools.googleSearch({}),
};

const currentDate = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "long",
  timeZone: "Europe/Warsaw",
}).format(new Date());

const system = `Jesteś profesjonalnym analitykiem biznesowym. Dzisiejsza data w Polsce to ${currentDate}. Gdy użytkownik poda temat, autonomicznie zbierasz informacje i piszesz raport.

PROCES:
1. ZAWSZE użyj narzędzia google_search przed napisaniem raportu — nawet gdy temat wydaje się ogólny.
2. Szukaj najświeższych informacji i preferuj źródła pierwotne: strony instytucji, firm, raporty branżowe oraz publikacje z datą.
3. Zbierz konkretne fakty, liczby, statystyki i daty. Nie używaj informacji sprzed 2025 roku, gdy istnieje nowsze źródło.
4. Napisz raport po polsku, liczący około 500-1000 słów.

FORMAT RAPORTU:
# 📊 Raport: [TEMAT]
Data przygotowania: ${currentDate}
Autor: Agent AI

## Streszczenie (Executive Summary)
[3-4 zdania z kluczowymi wnioskami]

## 1. Wprowadzenie
## 2. Kluczowe dane i fakty
## 3. Analiza
## 4. Wnioski i rekomendacje
## Źródła
[lista linków do wykorzystanych źródeł, z nazwą i datą publikacji lub aktualizacji, gdy jest dostępna]

Nie wymyślaj statystyk. Jeśli nie możesz potwierdzić danych, zaznacz ograniczenie. Przy każdym istotnym fakcie podaj źródło. Odpowiedź ma być gotowym raportem, bez opisu wewnętrznego procesu.`;

export async function POST(request: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await request.json();
    const modelMessages = await convertToModelMessages(messages, { tools });
    const result = streamText({
      model: google("gemini-3.1-flash-lite"),
      system,
      messages: modelMessages,
      tools,
      stopWhen: isStepCount(8),
      temperature: 0.2,
    });
    return result.toUIMessageStreamResponse({ sendSources: true });
  } catch (error) {
    console.error("report error", error);
    return Response.json({ error: "Nie udało się wygenerować raportu." }, { status: 500 });
  }
}
