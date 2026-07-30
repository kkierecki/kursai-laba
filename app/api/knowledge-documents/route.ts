import { getRequestSupabaseClient, getRequestUser } from "../../../lib/request-user";

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return Response.json({ error: "Wymagane logowanie." }, { status: 401 });
  const supabase = getRequestSupabaseClient(request);
  if (!supabase) return Response.json({ error: "Wymagane logowanie." }, { status: 401 });
  const title = new URL(request.url).searchParams.get("title");

  if (title) {
    const { data, error } = await supabase
      .from("documents")
      .select("content, metadata, created_at")
      .eq("title", title)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({
      chunks: (data ?? []).map((row, index) => ({
        content: row.content,
        index: typeof row.metadata?.chunk_index === "number" ? row.metadata.chunk_index : index,
        createdAt: row.created_at,
      })),
    });
  }

  const { data, error } = await supabase
    .from("documents")
    .select("title, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const documents = new Map<string, { title: string; chunks: number; createdAt: string }>();
  for (const row of data ?? []) {
    const existing = documents.get(row.title);
    if (existing) existing.chunks += 1;
    else documents.set(row.title, { title: row.title, chunks: 1, createdAt: row.created_at });
  }
  return Response.json({ documents: [...documents.values()] });
}

export async function DELETE(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return Response.json({ error: "Wymagane logowanie." }, { status: 401 });
  const supabase = getRequestSupabaseClient(request);
  if (!supabase) return Response.json({ error: "Wymagane logowanie." }, { status: 401 });
  const { title } = (await request.json()) as { title?: unknown };
  if (typeof title !== "string" || !title) return Response.json({ error: "Brak tytułu." }, { status: 400 });
  const { error } = await supabase.from("documents").delete().eq("title", title).eq("user_id", user.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
