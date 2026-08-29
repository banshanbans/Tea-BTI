export const TEA_ORIGINS = ["swipe", "passport", "profile"] as const;

export type TeaOrigin = typeof TEA_ORIGINS[number];
export type RealmEntry = "realm" | "tea";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseTeaOrigin(value: string | string[] | undefined): TeaOrigin {
  const candidate = first(value);
  return TEA_ORIGINS.includes(candidate as TeaOrigin) ? candidate as TeaOrigin : "swipe";
}

export function parseRealmEntry(value: string | string[] | undefined): RealmEntry {
  return first(value) === "tea" ? "tea" : "realm";
}

export function teaDetailHref(teaId: string, origin: TeaOrigin): string {
  return `/tea/${encodeURIComponent(teaId)}?origin=${origin}`;
}

export function teaOriginHref(origin: TeaOrigin): string {
  if (origin === "passport") return "/passport";
  if (origin === "profile") return "/profile";
  return "/";
}

export function teaStepHref(path: string, teaId: string, origin: TeaOrigin): string {
  return `/${path}/${encodeURIComponent(teaId)}?origin=${origin}`;
}

export function realmFromTeaHref(realmId: string, teaId: string, origin: TeaOrigin): string {
  const params = new URLSearchParams({ entry: "tea", teaId, origin });
  return `/realm/${encodeURIComponent(realmId)}?${params.toString()}`;
}

export function realmExitHref(entry: RealmEntry, teaId: string | undefined, origin: TeaOrigin): string {
  return entry === "tea" && teaId ? teaDetailHref(teaId, origin) : "/realm";
}
