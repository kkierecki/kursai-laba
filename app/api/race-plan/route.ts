import { google } from "@ai-sdk/google";
import { convertToModelMessages, isStepCount, jsonSchema, streamText, tool, type UIMessage } from "ai";
import { getRequestUser } from "../../../lib/request-user";
import { getActiveRacePlans, saveRacePlan } from "../../../lib/race-plans";
import { getRunnerContext } from "../../../lib/running-data";
import { beginTechnicalRequest, logTechnical, summarizeMessages } from "../../../lib/technical-logger";

export const maxDuration = 90;

const system = `Jesteś trenerem biegania przygotowującym plan pod konkretne zawody.

## Polecanie biegów
Gdy użytkownik pyta o najbliższe biegi, propozycje startów albo nie wskazuje zawodów, wyszukaj przez google_search nadchodzące biegi w Polsce z najbliższych sześciu miesięcy. Jeżeli w kontekście profilu istnieje home_location, wyszukaj przede wszystkim biegi w tej miejscowości i w jej okolicy; w przeciwnym razie przeszukaj całą Polskę.
- Pokaż minimum 10 rzeczywiście nadchodzących propozycji, posortowanych od najbliższych terminowo. Jeśli nie znajdziesz 10, pokaż tyle, ile znajdziesz, i jasno podaj powód.
- Podaj nazwę, datę, dystans, miejscowość oraz link źródłowy, jeśli jest dostępny. Nie weryfikuj ani nie klasyfikuj zawodów według ich oficjalności.
- Po wskazaniu przez użytkownika jednego biegu przejdź do procesu tworzenia planu. Nie zapisuj planu ani celu podczas samego zestawienia propozycji.
- Gdy prezentujesz propozycje, rozpocznij odpowiedź dokładnie jednym blokiem maszynowym: <race-data>[{"name":"nazwa","date":"YYYY-MM-DD","location":"miasto","distancesKm":[5,10,21.1],"officialUrl":"https://..."}]</race-data>. Umieść w nim minimum 10 biegów z Google Search oraz wszystkie znalezione dystanse. Nie używaj tego bloku przy tworzeniu planu po wyborze dystansu. Nie dodawaj żadnego tekstowego podsumowania poza tym blokiem.

## Obowiązkowy proces
1. Gdy użytkownik podał nazwę zawodów, użyj google_search, aby zebrać pomocny kontekst o wydarzeniu, ale nie blokuj planowania przez brak oficjalnego linku ani brak możliwości jego odczytania.
2. Użytkownik może podać bieg ręcznie: nazwę, dystans, datę i docelowe tempo. Traktuj je jako wystarczające dane do przygotowania planu.
3. Przed propozycją jednostek korzystaj z przekazanego kontekstu: bieżącej daty, ostatniego treningu, regeneracji, profilu i historii. Nie wymyślaj żadnych metryk.
4. Twórz plan od dzisiejszego dnia do startu. Jeśli czasu jest mało, powiedz jasno, że nie da się bezpiecznie zbudować pełnej formy, zaproponuj realną strategię ograniczania ryzyka i nigdy nie próbuj „odrabiać” opuszczonych treningów.
5. Po utworzeniu albo aktualizacji planu użyj saveRacePlan. officialUrl jest opcjonalny. Przy aktualizacji uwzględnij nową datę, treningi i regenerację z kontekstu, a potem nadpisz zapisany plan dla tych samych zawodów.
6. Docelowe tempo przekazane w bieżącej wiadomości dotyczy wyłącznie tych zawodów. Użyj go do planu i strategii tempa, ale nie nadpisuj ogólnego celu biegacza w profilu.

## Format odpowiedzi
## Wybrane zawody
Podaj nazwę, datę, dystans, miejsce i link źródłowy, jeśli jest dostępny.
## Ocena przygotowania
Uwzględnij ile dni zostało, ostatni trening i regenerację.
## Plan treningowy
Użyj osobnego nagłówka ### dla każdego tygodnia. W każdym tygodniu wypisz krótkie, czytelne punkty: dzień, rodzaj treningu, cel i intensywność wyłącznie przez opis/RPE albo znane strefy. Uwzględnij odpoczynek i taper.
## Jak aktualizować
Wyjaśnij, że użytkownik ma wrócić tu po każdym nowym treningu, zmianie samopoczucia lub co tydzień i użyć „Aktualizuj plan”.

Odpowiadaj po polsku, konkretnie i wspierająco. Nie diagnozuj urazów; przy bólu zalecaj konsultację medyczną.`;

export async function POST(request: Request) {
  const requestLog = beginTechnicalRequest(request, "/api/race-plan");
  try {
    const { messages, selectedPlanId }: { messages: UIMessage[]; selectedPlanId?: string } = await request.json();
    const user = await getRequestUser(request);
    const runnerContext = user
      ? await getRunnerContext(user.id)
      : { profile: null, goals: [], lastWorkout: null, lastRecovery: null, lastConversationAt: null };
    let activePlans: unknown[] = [];
    let planStorageAvailable = Boolean(user);
    if (user) {
      try {
        activePlans = await getActiveRacePlans(user.id);
      } catch (error) {
        planStorageAvailable = false;
        void logTechnical("WARN", "race-plan.storage.unavailable", {
          route: "/api/race-plan",
          requestId: requestLog.requestId,
          error,
        });
      }
    }
    const tools = {
      google_search: google.tools.googleSearch({}),
      saveRacePlan: tool({
        description: "Trwale zapisuje lub aktualizuje plan dla wskazanych zawodów. Adres organizatora jest opcjonalny.",
        inputSchema: jsonSchema<{ eventName: string; eventDate: string; officialUrl?: string; planMarkdown: string; distanceKm?: number; location?: string; eventDetails?: Record<string, unknown> }>({
          type: "object",
          properties: { eventName: { type: "string" }, eventDate: { type: "string", description: "YYYY-MM-DD" }, officialUrl: { type: "string" }, planMarkdown: { type: "string" }, distanceKm: { type: "number" }, location: { type: "string" }, eventDetails: { type: "object" } },
          required: ["eventName", "eventDate", "planMarkdown"], additionalProperties: false,
        }),
        execute: async (input) => {
          if (!user) return { saved: false, error: "Zapis planu wymaga zalogowanej sesji. Lista biegów pozostaje dostępna." };
          if (!planStorageAvailable) return { saved: false, error: "Zapis planu wymaga uruchomienia migracji 006_add_race_plans.sql w Supabase." };
          try {
            return await saveRacePlan(user.id, input);
          } catch (error) {
            void logTechnical("WARN", "race-plan.save.unavailable", { route: "/api/race-plan", requestId: requestLog.requestId, error });
            return { saved: false, error: "Nie udało się zapisać planu. Sprawdź migrację 006_add_race_plans.sql w Supabase." };
          }
        },
      }),
    };
    const modelMessages = await convertToModelMessages(messages, { tools });
    const selectedPlan = activePlans.find((plan) =>
      typeof plan === "object" && plan !== null && (plan as { id?: string }).id === selectedPlanId,
    ) ?? null;
    const result = streamText({
      model: google("gemini-3.1-flash-lite"),
      system: `${system}\n\n## Dzisiejsza data\n${new Date().toISOString().slice(0, 10)}\n\n## Bieżący kontekst biegacza\n${JSON.stringify(runnerContext)}\n\n## Zapisane aktywne plany\n${JSON.stringify(activePlans)}\n\n## Wybrany plan do rozmowy\n${JSON.stringify(selectedPlan)}`,
      messages: modelMessages, tools, stopWhen: isStepCount(16), maxOutputTokens: 3200, temperature: 0.2,
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
