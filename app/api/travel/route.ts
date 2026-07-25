import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  isStepCount,
  streamText,
  type UIMessage,
} from "ai";
import { lessonFourTools } from "../../../lib/agent-tools";
import {
  beginTechnicalRequest,
  logTechnical,
  summarizeMessages,
} from "../../../lib/technical-logger";

export const maxDuration = 90;

const system = `Jesteś profesjonalnym asystentem podróży. Gdy użytkownik opisuje podróż, autonomicznie zbierasz potrzebne informacje przy użyciu narzędzi.

## PROCES
Dla każdej destynacji sprawdź, o ile ma to zastosowanie:
1. pogodę (getWeather),
2. kurs lokalnej waluty do PLN (getExchangeRate),
3. dni wolne i święta w kraju docelowym (getHolidays),
4. informacje o mieście i atrakcjach (searchWikipedia),
5. budżet, jeśli podany (calculator).

Jeśli użytkownik prosi o porównanie miast, zbierz dane dla obu i przygotuj tabelę porównawczą oraz jednoznaczną rekomendację.

## FORMAT
## 🗺️ Plan podróży: [MIASTO]
### 📋 Podsumowanie
### 🌤️ Pogoda
### 💰 Budżet
### 📅 Ważne daty
### 🏛️ Co zobaczyć
### ✅ Checklista przed wyjazdem

## ZASADY
- Używaj prawdziwych danych z narzędzi i nie zgaduj wartości.
- Podawaj ceny w PLN i w walucie lokalnej, jeśli dostępny jest kurs.
- Bądź praktyczny i konkretny.
- Jeśli narzędzie zwróci błąd, poinformuj o nim i kontynuuj z pozostałymi danymi.
- Podawaj źródła: Open-Meteo, NBP, Nager.Date i Wikipedia.
- Odpowiadaj po polsku.`;

const safetyRules = `

## OBSŁUGA BŁĘDÓW
- Jeśli narzędzie zwróci błąd, nie powtarzaj tego samego wywołania.
- Poinformuj użytkownika i zaproponuj praktyczną alternatywę.
- Nigdy nie wywołuj tego samego narzędzia z identycznymi argumentami dwa razy z rzędu.
- Jeśli po 3 nieudanych próbach brakuje danych, powiedz wprost, czego brakuje.`;

export async function POST(request: Request) {
  const requestLog = beginTechnicalRequest(request, "/api/travel");

  try {
    const { messages }: { messages: UIMessage[] } = await request.json();
    const modelMessages = await convertToModelMessages(messages, {
      tools: lessonFourTools,
    });
    const result = streamText({
      model: google("gemini-3.1-flash-lite"),
      system: `${system}${safetyRules}`,
      messages: modelMessages,
      tools: lessonFourTools,
      // maxSteps: 3 (odpowiednik w AI SDK 7)
      stopWhen: isStepCount(3),
      temperature: 0.25,
      onError: ({ error }) => {
        void logTechnical("ERROR", "ai.stream.error", {
          route: "/api/travel",
          requestId: requestLog.requestId,
          model: "gemini-3.1-flash-lite",
          error,
        });
      },
      onFinish: ({ finishReason, usage }) => {
        void logTechnical("INFO", "ai.stream.finished", {
          route: "/api/travel",
          requestId: requestLog.requestId,
          model: "gemini-3.1-flash-lite",
          finishReason,
          usage,
        });
      },
    });

    const response = result.toUIMessageStreamResponse({ sendSources: true });
    void requestLog.finish(200, {
      model: "gemini-3.1-flash-lite",
      messageSummary: summarizeMessages(messages),
    });
    return response;
  } catch (error) {
    await requestLog.fail(error);
    throw error;
  }
}
