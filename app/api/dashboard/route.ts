import {
  fetchExchangeRate,
  fetchHolidays,
  fetchWeather,
  getCurrentDateTime,
} from "../../../lib/agent-tools";
import { beginTechnicalRequest } from "../../../lib/technical-logger";

export const revalidate = 0;

export async function GET(request: Request) {
  const section = new URL(request.url).searchParams.get("section") ?? "all";
  const city = new URL(request.url).searchParams.get("city")?.trim() || "Warszawa";
  const year = new Date().getFullYear();
  const requestLog = beginTechnicalRequest(request, "/api/dashboard", {
    section,
  });

  try {
    if (section === "weather") {
      const response = Response.json({
        currentDateTime: getCurrentDateTime(),
        weather: await fetchWeather(city),
      });
      void requestLog.finish(200);
      return response;
    }

    if (section === "currencies") {
      const [eur, usd] = await Promise.all([
        fetchExchangeRate("EUR"),
        fetchExchangeRate("USD"),
      ]);
      const response = Response.json({ currencies: { eur, usd } });
      void requestLog.finish(200);
      return response;
    }

    if (section === "holidays") {
      const response = Response.json({
        holidays: await fetchHolidays("PL", year),
      });
      void requestLog.finish(200);
      return response;
    }

    const [weather, eur, usd, holidays] = await Promise.all([
      fetchWeather("Warszawa"),
      fetchExchangeRate("EUR"),
      fetchExchangeRate("USD"),
      fetchHolidays("PL", year),
    ]);

    const response = Response.json({
      currentDateTime: getCurrentDateTime(),
      weather,
      currencies: { eur, usd },
      holidays,
    });
    void requestLog.finish(200);
    return response;
  } catch (error) {
    await requestLog.fail(error);
    throw error;
  }
}
