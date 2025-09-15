'use client';

import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { defaultTimeZone } from '@/lib/i18n/config';

type LocaleProviderProps = {
  children: ReactNode;
  locale: string;
  messages: Record<string, unknown>;
};

export function LocaleProvider({
  children,
  locale,
  messages,
}: LocaleProviderProps) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone={defaultTimeZone}
    >
      {children}
    </NextIntlClientProvider>
  );
}
