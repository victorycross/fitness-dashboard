// Local-timezone YYYY-MM-DD. `en-CA` locale happens to be ISO-formatted.
// Avoid `toISOString()` for dates — it returns UTC, which flips evenings in
// negative offsets to the next day.
export function localDateStr(d = new Date()) {
  return d.toLocaleDateString("en-CA");
}
