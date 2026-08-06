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
