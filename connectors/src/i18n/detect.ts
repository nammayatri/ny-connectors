import { SupportedLanguage } from './types';

// Unicode script blocks → language. We pick the language whose script has the
// most matched characters in the message. Order is irrelevant (max wins).
const SCRIPT_RANGES: { lang: SupportedLanguage; range: RegExp }[] = [
  { lang: 'kn', range: /[ಀ-೿]/g }, // Kannada
  { lang: 'hi', range: /[ऀ-ॿ]/g }, // Devanagari (Hindi)
  { lang: 'ta', range: /[஀-௿]/g }, // Tamil
  { lang: 'te', range: /[ఀ-౿]/g }, // Telugu
  { lang: 'gu', range: /[઀-૿]/g }, // Gujarati
];

/**
 * Best-effort language detection from a message's script. Returns the dominant
 * Indic-script language, or `undefined` for Latin / emoji / digits / unknown
 * (the caller then falls back to the default, English).
 *
 * Detection is intentionally script-only: we cannot tell romanized Kannada
 * ("hushar") from English, so romanized text falls through to `undefined`. This
 * is used to seed a NEW user's language from their very first message; an
 * explicit Language-button choice always overrides it afterwards.
 */
export function detectLanguage(text: string): SupportedLanguage | undefined {
  if (!text) return undefined;
  let best: { lang: SupportedLanguage; count: number } | undefined;
  for (const { lang, range } of SCRIPT_RANGES) {
    const count = (text.match(range) || []).length;
    if (count > 0 && (!best || count > best.count)) {
      best = { lang, count };
    }
  }
  return best?.lang;
}
