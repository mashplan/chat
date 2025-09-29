export const locales = (process.env.LOCALES || 'sv,en')
  .split(',')
  .map((locale) => locale.trim())
  .filter(Boolean);

export const defaultLocale = (process.env.DEFAULT_LOCALE || 'sv').trim();

export const localePrefix: 'always' | 'as-needed' | 'never' = 'as-needed';

export const localeDetection = true;

export const defaultTimeZone = (
  process.env.DEFAULT_TIME_ZONE || 'Europe/Stockholm'
).trim();
