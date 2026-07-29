import { getRequestUser } from "../../../lib/request-user";
import { supabase } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return Response.json({ error: "Wymagane logowanie." }, { status: 401 });

  const { data, error } = await supabase
    .from("runner_briefings")
    .select("id, briefing_date, created_at, content")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ briefings: data ?? [] });
}
