import { getRequestUser } from "../../../lib/request-user";
import { getActiveRacePlans } from "../../../lib/race-plans";
import { supabase } from "../../../lib/supabase";

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return Response.json({ plans: [] });
  try { return Response.json({ plans: await getActiveRacePlans(user.id) }); }
  catch { return Response.json({ plans: [] }); }
}

export async function DELETE(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return Response.json({ error: "Wymagane logowanie." }, { status: 401 });
  const { planId }: { planId?: string } = await request.json();
  if (!planId) return Response.json({ error: "Brak identyfikatora planu." }, { status: 400 });
  const { error } = await supabase.from("race_plans").delete().eq("id", planId).eq("user_id", user.id);
  if (error) return Response.json({ error: "Nie udało się usunąć planu." }, { status: 500 });
  return Response.json({ deleted: true });
}
