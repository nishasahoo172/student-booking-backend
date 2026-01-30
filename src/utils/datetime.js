export function isoToMysqlUtc(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid ISO date");
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export function mysqlUtcToIso(mysqlDt) {
  return new Date(String(mysqlDt).replace(" ", "T") + "Z").toISOString();
}
