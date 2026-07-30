import { generateAiImage } from "../../../lib/image-generation";
import { beginTechnicalRequest } from "../../../lib/technical-logger";
import { getLlmRequestContext, recordApiUsage } from "../../../lib/api-usage";

export const maxDuration = 35;

export async function POST(req: Request) {
  const requestLog = beginTechnicalRequest(req, "/api/generate-image");

  try {
    const usageContext = await getLlmRequestContext(req);
    if ("error" in usageContext) return usageContext.error;
    const { prompt }: { prompt?: unknown } = await req.json();

    if (typeof prompt !== "string" || prompt.trim().length === 0 || prompt.trim().length > 2_000) {
      const response = Response.json(
        { error: "Brak promptu do wygenerowania obrazu." },
        { status: 400 },
      );
      void requestLog.finish(400, { promptLength: 0 });
      return response;
    }

    const generated = await generateAiImage(prompt.trim());
    await recordApiUsage(usageContext.database, usageContext.user.id, generated.usage, "gemini-3.1-flash-lite-image", "/api/generate-image");
    const response = Response.json({ image: generated.image, text: generated.text });
    void requestLog.finish(200, { promptLength: prompt.trim().length });
    return response;
  } catch (error) {
    await requestLog.fail(error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nie udalo sie wygenerowac obrazu.",
      },
      { status: 500 },
    );
  }
}
