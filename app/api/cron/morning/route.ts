import { generateText, isStepCount } from "ai";
import { google } from "@ai-sdk/google";
import { fetchWeather } from "../../../../lib/agent-tools";
import { getRequestUser } from "../../../../lib/request-user";
import { getRunnerContext } from "../../../../lib/running-data";
import { supabase } from "../../../../lib/supabase";
import { beginTechnicalRequest, logTechnical } from "../../../../lib/technical-logger";

export const maxDuration = 90;
export const dynamic = "force-dynamic";

function warsawDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function addDays(date: string, days: number) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

type RunnerContext = Awaited<ReturnType<typeof getRunnerContext>>;

async function getHomeLocation(userId: string, context: RunnerContext) {
  const profileLocation = context.profile?.home_location;
  if (typeof profileLocation === "string" && profileLocation.trim()) return profileLocation.trim();

  const { data } = await supabase
    .from("user_profiles")
    .select("preferences")
    .eq("id", userId)
    .maybeSingle();
  const preferences = data?.preferences;
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) return null;
  const fallback = (preferences as Record<string, unknown>).home_location;
  return typeof fallback === "string" && fallback.trim() ? fallback.trim() : null;
}

function briefingSystem(today: string, until: string, location: string | null) {
  return `Jesteś ostrożnym, indywidualnym trenerem biegania. Przygotowujesz poranny briefing po polsku.

Dzisiejsza data: ${today}. Zakres wyszukiwania wydarzeń: od ${today} do ${until} włącznie.
${location ? `Lokalizacja biegacza: ${location}.` : "Biegacz nie ma zapisanej lokalizacji."}

Zasady bezwzględne:
- Korzystaj wyłącznie z przekazanego kontekstu biegacza oraz wyników narzędzia wyszukiwania. Nie wymyślaj metryk, dat treningu, stanu regeneracji ani wydarzeń.
- Nie diagnozuj zdrowia. Jeśli opis bólu jest obecny, nie proponuj treningu; zalecaj odpoczynek i konsultację z odpowiednim specjalistą.
- Następny krok może być konkretnym treningiem tylko wtedy, gdy kontekst wystarcza do bezpiecznej propozycji. W przeciwnym razie poproś o brakujące dane.
- Gdy lokalizacja jest znana, użyj google_search, aby znaleźć 1–3 najbliższe czasowo oficjalne biegi lub zorganizowane biegi w promieniu około 50 km od niej, wyłącznie w podanym zakresie dat. Potwierdzaj datę, miejscowość i link na stronie organizatora albo zapisów. Nie pokazuj wydarzeń bez potwierdzonej daty. Nie pokazuj wydarzeń spoza promienia ani historycznych.
- Jeśli wyszukiwanie nie da potwierdzonych wydarzeń, napisz dokładnie: „Nie znalazłem potwierdzonych oficjalnych biegów w promieniu 50 km w najbliższych 3 tygodniach.” Nie wnioskuj, że takich wydarzeń obiektywnie nie ma.
- Jeśli lokalizacji brakuje, nie wyszukuj wydarzeń i poproś o miejscowość lub okolicę.
- Linki do wydarzeń podaj bezpośrednio przy każdym wydarzeniu.

Zwróć wyłącznie briefing w tym formacie Markdown:
# 🌅 Poranny briefing biegacza — [data]
## 🌦️ Warunki do biegu
## 🏃 Kontekst treningowy
## 💚 Regeneracja
## ✅ Następny krok
## 🏁 Biegi w okolicy

W sekcji o biegach podaj maksymalnie trzy krótkie pozycje: nazwa, data, miejscowość, dystans gdy źródło go podaje, link. Nie dodawaj sekcji ani komentarzy poza tym formatem.`;
}

export async function GET(request: Request) {
  const requestLog = beginTechnicalRequest(request, "/api/cron/morning");
  try {
    const user = await getRequestUser(request);
    if (!user) {
      const response = Response.json({ error: "Zaloguj się, aby wygenerować swój briefing." }, { status: 401 });
      void requestLog.finish(401);
      return response;
    }

    const [runnerContext, today] = await Promise.all([getRunnerContext(user.id), Promise.resolve(warsawDate())]);
    const location = await getHomeLocation(user.id, runnerContext);
    const weather = location ? await fetchWeather(location) : { error: "Brak zapisanej lokalizacji." };
    const until = addDays(today, 21);

    const result = await generateText({
      model: google("gemini-3.1-flash-lite"),
      system: briefingSystem(today, until, location),
      prompt: `Przygotuj briefing na podstawie poniższych pewnych danych.\n\nKontekst biegacza:\n${JSON.stringify(runnerContext)}\n\nPogoda:\n${JSON.stringify(weather)}`,
      tools: location ? { google_search: google.tools.googleSearch({}) } : undefined,
      stopWhen: isStepCount(8),
      maxOutputTokens: 1800,
      temperature: 0.1,
    });

    const content = result.text.trim();
    if (!content) throw new Error("Model nie zwrócił treści briefingu.");

    const context = { location, weather, lastWorkout: runnerContext.lastWorkout, lastRecovery: runnerContext.lastRecovery, goals: runnerContext.goals };
    const { data: saved, error: saveError } = await supabase
      .from("runner_briefings")
      .upsert({ user_id: user.id, briefing_date: today, content, context }, { onConflict: "user_id,briefing_date" })
      .select("id,briefing_date,created_at")
      .single();

    if (saveError) {
      void logTechnical("WARN", "morning-briefing.save.unavailable", { requestId: requestLog.requestId, error: saveError });
      const response = Response.json({ success: true, saved: false, date: today, content, warning: "Briefing został wygenerowany, ale nie został zapisany. Uruchom migrację 008_add_runner_briefings.sql w Supabase." });
      void requestLog.finish(200, { model: "gemini-3.1-flash-lite", saved: false });
      return response;
    }

    const response = Response.json({ success: true, saved: true, date: today, briefing: saved, content });
    void requestLog.finish(200, { model: "gemini-3.1-flash-lite", saved: true });
    return response;
  } catch (error) {
    await requestLog.fail(error);
    return Response.json({ error: "Nie udało się wygenerować porannego briefingu." }, { status: 500 });
  }
}
