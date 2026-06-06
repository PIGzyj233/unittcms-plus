'use client';
import { useState, useContext } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRightFromLine, ArrowRightToLine, File, Globe, MoveUpRight, PenTool, Settings } from 'lucide-react';
import DropdownAccount from './DropdownAccount';
import DropdownLanguage from './DropdownLanguage';
import {
  Button,
  Link as NextUiLink,
  ListBoxItem,
  ListBox,
} from '@/components/heroui';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { GithubIcon } from '@/components/icons';
import { locales } from '@/config/selection';
import { TokenContext } from '@/utils/TokenProvider';
import UserAvatar from '@/components/UserAvatar';
import { LocaleCodeType } from '@/types/locale';
import Config from '@/config/config';

type NabbarMenuMessages = {
  projects: string;
  admin: string;
  docs: string;
  roadmap: string;
  account: string;
  profileSettings: string;
  signUp: string;
  signIn: string;
  signOut: string;
  links: string;
  languages: string;
};

type Props = {
  messages: NabbarMenuMessages;
  locale: LocaleCodeType;
};

function getLocalizedPath(pathname: string, locale: string) {
  return pathname === '/' ? `/${locale}` : `/${locale}${pathname}`;
}

function getUnlocalizedPathname(locale: string) {
  const localePrefix = `/${locale}`;
  const pathname = window.location.pathname;

  if (pathname === localePrefix) {
    return '/';
  }

  if (pathname.startsWith(`${localePrefix}/`)) {
    return pathname.slice(localePrefix.length);
  }

  return pathname;
}

export default function HeaderNavbarMenu({ messages, locale }: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const context = useContext(TokenContext);

  const commonLinks = [
    {
      uid: 'projects',
      href: '/projects',
      label: messages.projects,
      isExternal: false,
    },
  ];

  if (Config.isDemoSite) {
    commonLinks.push(
      {
        uid: 'docs',
        href: 'https://kimatata.github.io/unittcms/docs/getstarted/selfhost',
        label: messages.docs,
        isExternal: true,
      },
      {
        uid: 'roadmap',
        href: 'https://kimatata.github.io/unittcms/docs/roadmap/',
        label: messages.roadmap,
        isExternal: true,
      }
    );
  }

  function navigateTo(pathname: string, nextLocale: string = locale) {
    window.location.assign(getLocalizedPath(pathname, nextLocale));
  }

  async function changeLocale(nextLocale: string) {
    navigateTo(getUnlocalizedPathname(locale), nextLocale);
  }

  return (
    <header className="sticky top-0 z-40 w-full bg-inherit backdrop-blur">
      <nav data-menu-open={isMenuOpen ? 'true' : 'false'}>
        <div className="flex h-16 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-4">
          <Link className="flex justify-start items-center gap-1" href={getLocalizedPath('/', locale)}>
            <Image src="/favicon/icon-192.png" width={32} height={32} alt="Logo" />
            <p className="font-bold text-inherit ms-1">{Config.appName}</p>
          </Link>
        {commonLinks.map((link) =>
          link.isExternal ? (
            <div key={link.uid} className="hidden md:block">
              <NextUiLink isExternal href={link.href} showAnchorIcon>
                {link.label}
              </NextUiLink>
            </div>
          ) : (
            <div key={link.uid} className="hidden md:block">
              <Link
                className="data-[active=true]:text-primary data-[active=true]:font-medium"
                href={getLocalizedPath(link.href, locale)}
              >
                {link.label}
              </Link>
            </div>
          )
        )}
        {context.isAdmin() && (
          <div key="admin" className="hidden md:block">
            <Link
              className="data-[active=true]:text-primary data-[active=true]:font-medium"
              href={getLocalizedPath('/admin', locale)}
            >
              {messages.admin}
            </Link>
          </div>
        )}
          </div>

          <div className="flex items-center justify-end gap-4">
        <NextUiLink isExternal href={Config.repositoryUrl} aria-label="Github">
          <GithubIcon className="text-default-500" />
        </NextUiLink>
        <ThemeSwitch />
        <div className="hidden items-center gap-2 md:flex">
          <DropdownAccount messages={messages} locale={locale} onItemPress={() => {}} />
          {!context.isSignedIn() && <DropdownLanguage locale={locale} onChangeLocale={changeLocale} />}
        </div>
        <Button
          isIconOnly
          aria-label="Toggle navigation menu"
          className="md:hidden"
          variant="ghost"
          onPress={() => setIsMenuOpen(!isMenuOpen)}
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ☰
          </span>
        </Button>
          </div>
        </div>

      {isMenuOpen && (
        <div className="border-t border-separator bg-background md:hidden">
        <div className="mx-4 mt-2 flex flex-col gap-2">
          <p className="font-bold">{messages.links}</p>
          <ListBox
            aria-label="Links"
            itemClasses={{
              base: 'h-10 text-large',
            }}
          >
            {commonLinks.map((link) =>
              link.isExternal ? (
                <ListBoxItem
                  key={link.uid}
                  title={link.label}
                  startContent={<MoveUpRight size={12} />}
                  onPress={() => {
                    window.open(link.href, '_blank');
                    setIsMenuOpen(false);
                  }}
                />
              ) : (
                <ListBoxItem
                  key={link.uid}
                  title={link.label}
                  startContent={<File size={12} />}
                  onPress={() => {
                    navigateTo(link.href);
                    setIsMenuOpen(false);
                  }}
                />
              )
            )}
          </ListBox>

          <p className="font-bold">{messages.account}</p>
          {context.isSignedIn() ? (
            <ListBox
              aria-label="Account links"
              itemClasses={{
                base: 'h-10 text-large',
              }}
            >
              <ListBoxItem
                key="account"
                title={messages.account}
                startContent={
                  <UserAvatar
                    size={16}
                    username={context.token?.user?.username}
                    avatarPath={context.token?.user?.avatarPath}
                  />
                }
                onPress={() => {
                  navigateTo('/account');
                  setIsMenuOpen(false);
                }}
              />
              <ListBoxItem
                key="profile"
                title={messages.profileSettings}
                startContent={<Settings size={16} />}
                onPress={() => {
                  navigateTo('/account/settings');
                  setIsMenuOpen(false);
                }}
              />
              <ListBoxItem
                key="signout"
                title={messages.signOut}
                startContent={<ArrowRightFromLine size={16} />}
                onPress={() => {
                  context.setToken({
                    access_token: '',
                    expires_at: 0,
                    user: null,
                  });
                  context.removeTokenFromLocalStorage();
                  navigateTo('/account/signin');
                  setIsMenuOpen(false);
                }}
              />
            </ListBox>
          ) : (
            <>
              <ListBox
                aria-label="Account links"
                itemClasses={{
                  base: 'h-10 text-large',
                }}
              >
                <ListBoxItem
                  key="signin"
                  startContent={<ArrowRightToLine size={16} />}
                  title={messages.signIn}
                  onPress={() => {
                    navigateTo('/account/signin');
                    setIsMenuOpen(false);
                  }}
                />
                <ListBoxItem
                  key="signup"
                  title={messages.signUp}
                  startContent={<PenTool size={16} />}
                  onPress={() => {
                    navigateTo('/account/signup');
                    setIsMenuOpen(false);
                  }}
                />
              </ListBox>
              <p className="font-bold">{messages.languages}</p>
              <ListBox
                aria-label="Language links"
                itemClasses={{
                  base: 'h-10 text-large',
                }}
              >
                {locales.map((entry) => (
                  <ListBoxItem
                    key={entry.code}
                    startContent={<Globe size={16} />}
                    title={entry.name}
                    onPress={() => {
                      changeLocale(entry.code);
                      setIsMenuOpen(false);
                    }}
                  />
                ))}
              </ListBox>
            </>
          )}
        </div>
        </div>
      )}
      </nav>
    </header>
  );
}
