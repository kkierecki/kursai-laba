import { supabase } from "./supabase";

export async function getRequestUser(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  return error ? null : data.user;
}
