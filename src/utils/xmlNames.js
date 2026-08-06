export function sanitizeXmlName(value, fallback = 'terrain') {
  const normalized = String(value ?? '')
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^A-Za-z0-9_.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_\-.]+|[_\-.]+$/g, '');

  const safe = normalized || fallback;
  return /^[A-Za-z_]/.test(safe) ? safe : `geom_${safe}`;
}

export function sanitizeXmlNameDraft(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^A-Za-z0-9_.-]+/g, '_')
    .replace(/_+/g, '_');
}

/** Return a valid MJCF name that does not collide with the supplied names. */
export function makeUniqueXmlName(value, existingNames, fallback = 'terrain') {
  const base = sanitizeXmlName(value, fallback);
  const used = existingNames instanceof Set ? existingNames : new Set(existingNames);
  if (!used.has(base)) return base;

  let suffix = 2;
  while (used.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}
