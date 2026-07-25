import { searchKnowledge } from "../../../lib/agent-tools";

export async function POST(request: Request) {
  const { query } = (await request.json()) as { query?: unknown };

  if (typeof query !== "string" || !query.trim()) {
    return Response.json({ error: "Wpisz pytanie do wyszukania." }, { status: 400 });
  }

  return Response.json(await searchKnowledge(query));
}
