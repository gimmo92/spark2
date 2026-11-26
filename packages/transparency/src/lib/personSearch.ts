export function personMatchesQuery(
  person: { name?: string | null; employeeId?: string | null },
  query: string
): boolean {
  const needle = String(query ?? "").trim().toLowerCase();
  if (!needle) return true;
  const name = String(person?.name ?? "").toLowerCase();
  const id = String(person?.employeeId ?? "").toLowerCase();
  return name.includes(needle) || id.includes(needle);
}
