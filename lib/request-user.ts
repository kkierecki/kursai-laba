import { createSupabaseUserClient, supabase } from "./supabase";

function getAccessToken(request: Request, fallbackAccessToken?: unknown) {
  const authorization = request.headers.get("authorization");
  const headerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;

  if (headerToken) return headerToken;

  return typeof fallbackAccessToken === "string" && fallbackAccessToken.length <= 10_000
    ? fallbackAccessToken
    : null;
}

export async function getRequestUser(request: Request, fallbackAccessToken?: unknown) {
  const token = getAccessToken(request, fallbackAccessToken);
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  return error ? null : data.user;
}

export function getRequestSupabaseClient(request: Request, fallbackAccessToken?: unknown) {
  const token = getAccessToken(request, fallbackAccessToken);
  return token ? createSupabaseUserClient(token) : null;
}
