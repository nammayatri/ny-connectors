import { SupportedLanguage, LanguageStrings } from './types';
import { en } from './en';
import { hi } from './hi';
import { gu } from './gu';
import { kn } from './kn';
import { ta } from './ta';
import { te } from './te';

export type { SupportedLanguage, LanguageStrings };

const languages: Record<SupportedLanguage, LanguageStrings> = {
  en,
  hi,
  gu,
  kn,
  ta,
  te,
};

export function t(lang?: SupportedLanguage): LanguageStrings {
  return languages[lang || 'en'] || languages.en;
}

export function getAllLanguages(): { code: SupportedLanguage; name: string; nativeName: string }[] {
  return (Object.entries(languages) as [SupportedLanguage, LanguageStrings][]).map(
    ([code, strings]) => ({
      code,
      name: strings.languageName,
      nativeName: strings.nativeLanguageName,
    })
  );
}

export function isValidLanguage(code: string): code is SupportedLanguage {
  return code in languages;
}
