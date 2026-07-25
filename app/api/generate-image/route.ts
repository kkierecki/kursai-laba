import { generateAiImage } from "../../../lib/image-generation";
import { beginTechnicalRequest } from "../../../lib/technical-logger";

export const maxDuration = 35;

export async function POST(req: Request) {
  const requestLog = beginTechnicalRequest(req, "/api/generate-image");

  try {
    const { prompt }: { prompt?: unknown } = await req.json();

    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      const response = Response.json(
        { error: "Brak promptu do wygenerowania obrazu." },
        { status: 400 },
      );
      void requestLog.finish(400, { promptLength: 0 });
      return response;
    }

    const response = Response.json(await generateAiImage(prompt.trim()));
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
