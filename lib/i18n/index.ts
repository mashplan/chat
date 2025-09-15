import { headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, defaultTimeZone, locales } from './config';

export const LOCALE_COOKIE = 'NEXT_LOCALE';

export async function getPreferredLocale(): Promise<string> {
  const incomingHeaders = await headers();
  const cookieHeader = incomingHeaders.get('cookie') || '';
  const cookieLocale = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .map((c) => c.split('='))
    .find(([name]) => name === LOCALE_COOKIE)?.[1];
  if (cookieLocale && locales.includes(cookieLocale)) return cookieLocale;

  const acceptLanguage = incomingHeaders.get('accept-language') || '';
  const preferred = acceptLanguage
    .split(',')
    .map((part) => part.split(';')[0].trim())
    .find((lang) => locales.includes(lang.split('-')[0]));
  if (preferred) return preferred.split('-')[0];

  return defaultLocale;
}

export default getRequestConfig(async ({ locale }) => {
  const normalized = (locale || defaultLocale).split('-')[0];
  const messages = (await import(`../../messages/${normalized}.json`)).default;
  return {
    messages,
    locale: normalized,
    timeZone: defaultTimeZone,
  };
});
