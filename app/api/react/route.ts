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
import { getLlmRequestContext, recordApiUsage } from "../../../lib/api-usage";

export const maxDuration = 60;

const system = `Jesteś autonomicznym agentem ReAct. Gdy dostajesz zadanie, realizujesz je krok po kroku przy użyciu dostępnych narzędzi.

## PROCES
- Przed użyciem narzędzia napisz krótką sekcję "### 🧠 Myślę..." z uzasadnieniem następnego działania. Nie ujawniaj prywatnego, szczegółowego toku rozumowania.
- Użyj właściwego narzędzia zamiast zgadywać.
- Po wyniku napisz "### 👁️ Obserwuję..." i krótko oceń, czy masz potrzebne dane.
- Wykonaj maksymalnie 5 głównych kroków.
- Na końcu napisz "### ✅ Wynik końcowy" i podaj konkretną odpowiedź opartą na danych.

## ZASADY
- Łącz dane z wielu narzędzi w spójną odpowiedź.
- Jeśli narzędzie zwróci błąd, spróbuj rozsądnej alternatywy albo jasno poinformuj użytkownika.
- Cytuj źródła danych: Open-Meteo, NBP, Nager.Date, Wikipedia lub adres przeczytanej strony.
- Odpowiadaj po polsku.`;

const knowledgeRules = `

## BAZA WIEDZY FIRMY
- Masz narzędzie searchKnowledge do przeszukiwania firmowej bazy wiedzy: cenników, pakietów, ofert, FAQ, regulaminów i warunków usług.
- Przy pytaniu o informacje firmowe najpierw użyj searchKnowledge. Przekaż całe pytanie użytkownika jako query.
- Odpowiadaj wyłącznie na podstawie znalezionych fragmentów. Jeżeli wynik ma 0 dopasowań, powiedz: „Nie mam informacji na ten temat w mojej bazie wiedzy. Skontaktuj się z firmą bezpośrednio.”
- Gdy korzystasz z wyniku, w sekcji „### ✅ Wynik końcowy” dodaj na końcu: „📎 Źródło: [tytuł]”. Dla wielu dokumentów użyj „📎 Źródła: [tytuł 1], [tytuł 2]”. Tytuły bierz z source_documents albo metadata.source.
- Nie używaj searchKnowledge do pytań ogólnych, np. o pogodę, kursy walut, święta lub Wikipedię. Wybierz wtedy właściwe narzędzie.`;

const safetyRules = `

## OBSŁUGA BŁĘDÓW
- Jeśli narzędzie zwróci błąd, nie powtarzaj tego samego wywołania.
- Poinformuj użytkownika i zaproponuj praktyczną alternatywę.
- Nigdy nie wywołuj tego samego narzędzia z identycznymi argumentami dwa razy z rzędu.
- Jeśli po 3 nieudanych próbach brakuje danych, powiedz wprost, czego brakuje.`;

// Gemini 2.5 nie obsługuje jednoczesnego użycia wbudowanego Google Search
// i własnych funkcji. Ten endpoint priorytetowo udostępnia komplet narzędzi
// warsztatowych; źródła internetowe zapewniają readWebPage i Wikipedia.
const tools = lessonFourTools;

export async function POST(request: Request) {
  const requestLog = beginTechnicalRequest(request, "/api/react");

  try {
    const usageContext = await getLlmRequestContext(request);
    if ("error" in usageContext) return usageContext.error;
    const { messages }: { messages: UIMessage[] } = await request.json();
    const modelMessages = await convertToModelMessages(messages, { tools });
    const result = streamText({
      model: google("gemini-3.1-flash-lite"),
      system: `${system}${knowledgeRules}${safetyRules}`,
      messages: modelMessages,
      tools,
      // maxSteps: 3 (odpowiednik w AI SDK 7)
      stopWhen: isStepCount(3),
      temperature: 0.25,
      onError: ({ error }) => {
        void logTechnical("ERROR", "ai.stream.error", {
          route: "/api/react",
          requestId: requestLog.requestId,
          model: "gemini-3.1-flash-lite",
          error,
        });
      },
      onFinish: ({ finishReason, usage }) => {
        void recordApiUsage(usageContext.database, usageContext.user.id, usage, "gemini-3.1-flash-lite", "/api/react").catch((error) =>
          logTechnical("ERROR", "api-usage.write.failed", { route: "/api/react", requestId: requestLog.requestId, error }),
        );
        void logTechnical("INFO", "ai.stream.finished", {
          route: "/api/react",
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
