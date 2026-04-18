// Unit conversions + formatters. Storage stays metric (kg, cm) everywhere.

export function kgToLbs(kg) {
  const n = Number(kg);
  if (!isFinite(n)) return null;
  return n * 2.20462;
}

export function cmToFtIn(cm) {
  const n = Number(cm);
  if (!isFinite(n) || n <= 0) return null;
  const totalInches = n / 2.54;
  const ft = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - ft * 12);
  // 11.5" should round to 12" which rolls into +1 ft
  if (inches === 12) return { ft: ft + 1, in: 0 };
  return { ft, in: inches };
}

export function formatWeight(kg, { decimals = 1 } = {}) {
  const n = Number(kg);
  if (!isFinite(n)) return "—";
  const lbs = kgToLbs(n);
  return `${n.toFixed(decimals)} kg (${lbs.toFixed(0)} lb)`;
}

export function formatHeight(cm) {
  const n = Number(cm);
  if (!isFinite(n) || n <= 0) return "—";
  const ftIn = cmToFtIn(n);
  if (!ftIn) return `${n} cm`;
  return `${Math.round(n)} cm (${ftIn.ft}'${ftIn.in}")`;
}

export function lbsHint(kg) {
  const lbs = kgToLbs(kg);
  return lbs == null ? "" : `≈ ${lbs.toFixed(0)} lb`;
}

export function ftInHint(cm) {
  const ftIn = cmToFtIn(cm);
  return ftIn ? `≈ ${ftIn.ft}'${ftIn.in}"` : "";
}
