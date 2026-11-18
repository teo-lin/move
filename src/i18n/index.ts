import {ro} from './ro';

export type Language = 'en' | 'ro';

export const languages: {value: Language; label: string}[] = [
  {value: 'en', label: 'English'},
  {value: 'ro', label: 'Română'},
];

let current: Language = 'en';

export function setLanguage(language: Language) {
  current = language;
}

export function getLanguage(): Language {
  return current;
}

export function parseLanguage(raw: string | null | undefined): Language {
  return raw === 'ro' ? 'ro' : 'en';
}

/**
 * Looks a UI string up in the active language. English is the key, so untranslated text simply
 * stays English. `{name}` placeholders are filled from `vars`.
 */
export function t(text: string, vars?: Record<string, string | number>): string {
  const translated = current === 'ro' ? ro[text] ?? text : text;
  return vars
    ? translated.replace(/\{(\w+)\}/g, (_match, key) => String(vars[key] ?? ''))
    : translated;
}
