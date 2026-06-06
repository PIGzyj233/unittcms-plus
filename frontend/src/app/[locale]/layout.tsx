import '@/styles/globals.css';
import clsx from 'clsx';
import { getMessages, getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import Header from './Header';
import { Providers } from './providers';
import { LocaleCodeType } from '@/types/locale';
import { fontSans } from '@/config/fonts';

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;

  const {
    locale
  } = params;

  const headersList = await headers();
  const host = headersList.get('host');
  const isOfficialDomain = host === 'unittcms.org' ? true : false;
  const t = await getTranslations({ locale, namespace: 'Header' });

  return {
    title: `${t('title')} | UnitTCMS`,
    description: t('description'),
    icons: {
      icon: '/favicon/favicon.ico',
      shortcut: '/favicon/favicon-16x16.png',
      apple: '/favicon/apple-touch-icon.png',
    },
    alternates: {
      canonical: `https://www.unittcms.org/${locale}`,
    },
    robots: isOfficialDomain ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function RootLayout(props: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const { children } = props;
  const messages = await getMessages({ locale });
  const t = await getTranslations({ locale, namespace: 'Toast' });
  const toastMessages = {
    needSignedIn: t('need_signed_in'),
    sessionExpired: t('session_expired'),
  };

  return (
    <html lang={locale} suppressHydrationWarning>
      <head />
      <body className={clsx('min-h-[calc(100vh-64px)] bg-background font-sans antialiased', fontSans.variable)}>
        <Providers
          intlProps={{ locale: locale, messages: messages }}
          themeProps={{ attribute: 'class', defaultTheme: 'light' }}
          tokenProps={{ toastMessages: toastMessages, locale: locale as LocaleCodeType }}
        >
          <div className="relative flex flex-col min-h-screen light:bg-neutral-50 dark:bg-neutral-800">
            <Header locale={locale as LocaleCodeType} />
            <main>{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
