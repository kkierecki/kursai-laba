import { google } from "@ai-sdk/google";
import { convertToModelMessages, isStepCount, jsonSchema, streamText, tool, type UIMessage } from "ai";
import { fetchWebPage } from "../../../lib/agent-tools";
import { getRequestUser } from "../../../lib/request-user";
import { getActiveRacePlans, saveRacePlan } from "../../../lib/race-plans";
import { getRunnerContext } from "../../../lib/running-data";
import { beginTechnicalRequest, logTechnical, summarizeMessages } from "../../../lib/technical-logger";

export const maxDuration = 90;

const system = `Jesteś trenerem biegania przygotowującym plan pod konkretne, oficjalne zawody.

## Polecanie biegów
Gdy użytkownik pyta o najbliższe biegi, propozycje startów albo nie wskazuje zawodów, wyszukaj przez google_search nadchodzące oficjalne biegi w Polsce. Jeżeli w kontekście profilu istnieje home_location, wyszukaj przede wszystkim biegi w tej miejscowości i w jej okolicy; w przeciwnym razie przeszukaj całą Polskę.
- Pokaż 3–5 rzeczywiście nadchodzących propozycji, posortowanych od najbliższych terminowo.
- Każdą propozycję zweryfikuj przez readWebPage na oficjalnej stronie organizatora. Podaj nazwę, datę, dystans, miejscowość oraz link do oficjalnej strony.
- Nie przedstawiaj agregatorów, wpisów z social mediów ani wydarzeń z niepewną datą jako oficjalnych biegów. Jeśli nie uda się zweryfikować wystarczającej liczby propozycji, napisz to wprost.
- Po wskazaniu przez użytkownika jednego biegu przejdź do procesu tworzenia planu. Nie zapisuj planu ani celu podczas samego zestawienia propozycji.

## Obowiązkowy proces
1. ZAWSZE najpierw użyj google_search, aby znaleźć wydarzenie podane nazwą przez użytkownika.
2. Następnie otwórz oficjalną stronę organizatora przez readWebPage i potwierdź co najmniej nazwę, datę oraz dystans. Gdy nie ma pewności, nie planuj i poproś o oficjalny link lub doprecyzowanie.
3. Przed propozycją jednostek korzystaj z przekazanego kontekstu: bieżącej daty, ostatniego treningu, regeneracji, profilu i historii. Nie wymyślaj żadnych metryk.
4. Twórz plan od dzisiejszego dnia do startu. Jeśli czasu jest mało, powiedz jasno, że nie da się bezpiecznie zbudować pełnej formy, zaproponuj realną strategię ograniczania ryzyka i nigdy nie próbuj „odrabiać” opuszczonych treningów.
5. Po utworzeniu albo aktualizacji planu użyj saveRacePlan. Plan można zapisać wyłącznie po zweryfikowaniu oficjalnej strony. Przy aktualizacji uwzględnij nową datę, treningi i regenerację z kontekstu, a potem nadpisz zapisany plan dla tych samych zawodów.

## Format odpowiedzi
## Zweryfikowane zawody
Podaj nazwę, datę, dystans, miejsce i link do oficjalnej strony. Wyraźnie oznacz fakty jako pewne lub niepotwierdzone.
## Ocena przygotowania
Uwzględnij ile dni zostało, ostatni trening i regenerację.
## Plan treningowy
Rozpisz tygodniami i dniami: rodzaj treningu, cel oraz intensywność wyłącznie przez opis/RPE albo znane strefy. Uwzględnij odpoczynek i taper.
## Jak aktualizować
Wyjaśnij, że użytkownik ma wrócić tu po każdym nowym treningu, zmianie samopoczucia lub co tydzień i użyć „Aktualizuj plan”.

Odpowiadaj po polsku, konkretnie i wspierająco. Nie diagnozuj urazów; przy bólu zalecaj konsultację medyczną.`;

export async function POST(request: Request) {
  const requestLog = beginTechnicalRequest(request, "/api/race-plan");
  try {
    const { messages }: { messages: UIMessage[] } = await request.json();
    const user = await getRequestUser(request);
    if (!user) return Response.json({ error: "Wymagane logowanie." }, { status: 401 });
    const [runnerContext, activePlans] = await Promise.all([getRunnerContext(user.id), getActiveRacePlans(user.id)]);
    const tools = {
      google_search: google.tools.googleSearch({}),
      readWebPage: tool({
        description: "Czyta wskazaną stronę WWW. Użyj do potwierdzenia danych z oficjalnej strony organizatora.",
        inputSchema: jsonSchema<{ url: string }>({ type: "object", properties: { url: { type: "string" } }, required: ["url"], additionalProperties: false }),
        execute: async ({ url }) => fetchWebPage(url),
      }),
      saveRacePlan: tool({
        description: "Trwale zapisuje lub aktualizuje plan dla zweryfikowanych oficjalnych zawodów. Wymaga URL oficjalnego organizatora.",
        inputSchema: jsonSchema<{ eventName: string; eventDate: string; officialUrl: string; planMarkdown: string; distanceKm?: number; location?: string; eventDetails?: Record<string, unknown> }>({
          type: "object",
          properties: { eventName: { type: "string" }, eventDate: { type: "string", description: "YYYY-MM-DD" }, officialUrl: { type: "string" }, planMarkdown: { type: "string" }, distanceKm: { type: "number" }, location: { type: "string" }, eventDetails: { type: "object" } },
          required: ["eventName", "eventDate", "officialUrl", "planMarkdown"], additionalProperties: false,
        }),
        execute: async (input) => saveRacePlan(user.id, input),
      }),
    };
    const modelMessages = await convertToModelMessages(messages, { tools });
    const result = streamText({
      model: google("gemini-3.1-flash-lite"),
      system: `${system}\n\n## Dzisiejsza data\n${new Date().toISOString().slice(0, 10)}\n\n## Bieżący kontekst biegacza\n${JSON.stringify(runnerContext)}\n\n## Zapisane aktywne plany\n${JSON.stringify(activePlans)}`,
      messages: modelMessages, tools, stopWhen: isStepCount(6), temperature: 0.2,
      onError: ({ error }) => void logTechnical("ERROR", "ai.stream.error", { route: "/api/race-plan", requestId: requestLog.requestId, error }),
    });
    const response = result.toUIMessageStreamResponse({ sendSources: true });
    void requestLog.finish(200, { model: "gemini-3.1-flash-lite", messageSummary: summarizeMessages(messages) });
    return response;
  } catch (error) {
    await requestLog.fail(error);
    throw error;
  }
}
