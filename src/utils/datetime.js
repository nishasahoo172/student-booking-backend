// ISO -> MySQL DATETIME (UTC)
export function isoToMysqlUtc(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid ISO date");
  }
  return d.toISOString().slice(0, 19).replace("T", " ");
}

// MySQL DATETIME -> ISO (UTC)
export function mysqlUtcToIso(mysqlDt) {
  // mysqlDt: "2026-02-05 02:00:00"
  return new Date(mysqlDt.replace(" ", "T") + "Z").toISOString();
}
