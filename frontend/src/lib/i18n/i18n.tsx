import type { ReactNode } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';
import { enUS } from './locales/en-US';
import { ptBR } from './locales/pt-BR';

type Locale = 'en-US' | 'pt-BR';
type TranslationKey = string;

const messages: Record<Locale, Record<string, unknown>> = {
  'en-US': enUS,
  'pt-BR': ptBR,
};

const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void }>({
  locale: 'en-US',
  setLocale: () => {},
});

function getByPath(source: unknown, path: string): string | undefined {
  return path
    .split('.')
    .reduce<unknown>(
      (value, key) => (value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined),
      source,
    ) as string | undefined;
}

function format(template: string, values?: Record<string, string | number>) {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
}

export function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'en-US';
  const stored = window.localStorage.getItem('robo-cestinha-locale');
  if (stored === 'en-US' || stored === 'pt-BR') return stored;
  const language = window.navigator.language.toLowerCase();
  return language.startsWith('pt') ? 'pt-BR' : 'en-US';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => detectLocale());

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}

export function useTranslation() {
  const { locale, setLocale } = useContext(LocaleContext);
  const t = useMemo(() => {
    return (key: TranslationKey, values?: Record<string, string | number>) => {
      const raw = getByPath(messages[locale], key) ?? getByPath(messages['en-US'], key) ?? key;
      return format(raw, values);
    };
  }, [locale]);

  return { t, locale, setLocale };
}
