export interface GlossaryTerm {
  id: string;
  label: string;
  aliases?: readonly string[];
  description: string;
  sourceUrl: string;
}
export interface GlossaryPart { text: string; term?: GlossaryTerm }

// Normalize OCR spacing/full-width letters for lookup, while retaining the exact
// original text and offsets for rendering and copying.
export function splitGlossaryText(text: string, terms: readonly GlossaryTerm[]): GlossaryPart[] {
  const normalize = (value: string) => value.normalize('NFKC').replace(/\s/g, '');
  const lookup = terms.flatMap(term => [term.label, ...(term.aliases ?? [])]
    .map(value => ({ value: normalize(value), term })))
    .filter(entry => entry.value.length > 0).sort((a, b) => b.value.length - a.value.length);
  const offsets: { start: number; end: number }[] = [];
  let normalized = '', offset = 0;
  for (const char of text) {
    const value = normalize(char);
    normalized += value;
    for (let i = 0; i < value.length; i++) offsets.push({ start: offset, end: offset + char.length });
    offset += char.length;
  }
  const parts: GlossaryPart[] = [];
  let cursor = 0;
  for (let i = 0; i < normalized.length;) {
    const entry = lookup.find(({value}) => normalized.startsWith(value, i)
      && (!/^[A-Za-z]/.test(value) || !/[A-Za-z]/.test(normalized[i - 1] ?? ''))
      && (!/[A-Za-z]$/.test(value) || !/[A-Za-z]/.test(normalized[i + value.length] ?? '')));
    if (!entry) { i++; continue; }
    const start = offsets[i].start, end = offsets[i + entry.value.length - 1].end;
    if (start > cursor) parts.push({ text: text.slice(cursor, start) });
    parts.push({ text: text.slice(start, end), term: entry.term });
    cursor = end; i += entry.value.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}
