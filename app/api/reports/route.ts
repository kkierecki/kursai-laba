import { getRequestUser } from "../../../lib/request-user";
import { supabase } from "../../../lib/supabase";

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return Response.json({ error: "Wymagane logowanie." }, { status: 401 });

  const { data, error } = await supabase
    .from("reports")
    .select("id, topic, content, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ reports: data ?? [] });
}

export async function POST(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return Response.json({ error: "Wymagane logowanie." }, { status: 401 });

  const body = (await request.json()) as { topic?: unknown; content?: unknown };
  if (typeof body.topic !== "string" || !body.topic.trim() || typeof body.content !== "string" || !body.content.trim()) {
    return Response.json({ error: "Raport musi zawierać temat i treść." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("reports")
    .insert({ user_id: user.id, topic: body.topic.trim().slice(0, 500), content: body.content.trim() })
    .select("id, created_at")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ report: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return Response.json({ error: "Wymagane logowanie." }, { status: 401 });

  const { id } = (await request.json()) as { id?: unknown };
  if (typeof id !== "string" || !id) return Response.json({ error: "Brak identyfikatora raportu." }, { status: 400 });

  const { error } = await supabase.from("reports").delete().eq("id", id).eq("user_id", user.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
