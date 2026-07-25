import { searchKnowledge } from "../../../lib/agent-tools";
import { getRequestUser } from "../../../lib/request-user";

export async function POST(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return Response.json({ error: "Wymagane logowanie." }, { status: 401 });
  const { query } = (await request.json()) as { query?: unknown };

  if (typeof query !== "string" || !query.trim()) {
    return Response.json({ error: "Wpisz pytanie do wyszukania." }, { status: 400 });
  }

  return Response.json(await searchKnowledge(query, user.id));
}
