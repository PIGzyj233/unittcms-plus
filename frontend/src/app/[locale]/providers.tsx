'use client';

import * as React from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { ThemeProvider as NextThemesProvider, ThemeProviderProps } from 'next-themes';
import { AbstractIntlMessages } from 'use-intl/core';
import { ToastProvider } from '@/components/heroui';
import TokenProvider from '@/utils/TokenProvider';
import { TokenProps } from '@/types/user';

export interface ProvidersProps {
  children: React.ReactNode;
  intlProps: {
    locale: string;
    messages: AbstractIntlMessages;
  };
  themeProps?: ThemeProviderProps;
  tokenProps?: TokenProps;
}

export function Providers({ children, intlProps, themeProps, tokenProps }: ProvidersProps) {
  return (
    <NextIntlClientProvider {...intlProps}>
      <NextThemesProvider {...themeProps}>
        <ToastProvider />
        <TokenProvider {...tokenProps}>{children}</TokenProvider>
      </NextThemesProvider>
    </NextIntlClientProvider>
  );
}
