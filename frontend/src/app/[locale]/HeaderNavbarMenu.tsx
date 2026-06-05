'use client';
import { useState, useContext } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Navbar,
  NavbarContent,
  NavbarMenu,
  NavbarMenuToggle,
  NavbarBrand,
  NavbarItem,
  Link as NextUiLink,
  ListboxItem,
  Listbox,
} from '@heroui/react';
import { ArrowRightFromLine, ArrowRightToLine, File, Globe, MoveUpRight, PenTool, Settings } from 'lucide-react';
import DropdownAccount from './DropdownAccount';
import DropdownLanguage from './DropdownLanguage';
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
    <Navbar isMenuOpen={isMenuOpen} maxWidth="full" position="sticky" className="bg-inherit">
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand as="li" className="gap-3 max-w-fit">
          <Link className="flex justify-start items-center gap-1" href={getLocalizedPath('/', locale)}>
            <Image src="/favicon/icon-192.png" width={32} height={32} alt="Logo" />
            <p className="font-bold text-inherit ms-1">UnitTCMS</p>
          </Link>
        </NavbarBrand>
        {commonLinks.map((link) =>
          link.isExternal ? (
            <NavbarItem key={link.uid} className="hidden md:block">
              <NextUiLink isExternal href={link.href} showAnchorIcon>
                {link.label}
              </NextUiLink>
            </NavbarItem>
          ) : (
            <NavbarItem key={link.uid} className="hidden md:block">
              <Link
                className="data-[active=true]:text-primary data-[active=true]:font-medium"
                href={getLocalizedPath(link.href, locale)}
              >
                {link.label}
              </Link>
            </NavbarItem>
          )
        )}
        {context.isAdmin() && (
          <NavbarItem key="admin" className="hidden md:block">
            <Link
              className="data-[active=true]:text-primary data-[active=true]:font-medium"
              href={getLocalizedPath('/admin', locale)}
            >
              {messages.admin}
            </Link>
          </NavbarItem>
        )}
      </NavbarContent>

      <NavbarContent className="basis-1 pl-4" justify="end">
        <NextUiLink isExternal href="https://github.com/kimatata/unittcms" aria-label="Github">
          <GithubIcon className="text-default-500" />
        </NextUiLink>
        <ThemeSwitch />
        <div className="hidden md:block">
          <DropdownAccount messages={messages} locale={locale} onItemPress={() => {}} />
          {!context.isSignedIn() && <DropdownLanguage locale={locale} onChangeLocale={changeLocale} />}
        </div>
        <NavbarMenuToggle className="md:hidden" onChange={() => setIsMenuOpen(!isMenuOpen)} />
      </NavbarContent>

      <NavbarMenu>
        <div className="mx-4 mt-2 flex flex-col gap-2">
          <p className="font-bold">{messages.links}</p>
          <Listbox
            aria-label="Links"
            itemClasses={{
              base: 'h-10 text-large',
            }}
          >
            {commonLinks.map((link) =>
              link.isExternal ? (
                <ListboxItem
                  key={link.uid}
                  title={link.label}
                  startContent={<MoveUpRight size={12} />}
                  onPress={() => {
                    window.open(link.href, '_blank');
                    setIsMenuOpen(false);
                  }}
                />
              ) : (
                <ListboxItem
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
          </Listbox>

          <p className="font-bold">{messages.account}</p>
          {context.isSignedIn() ? (
            <Listbox
              aria-label="Account links"
              itemClasses={{
                base: 'h-10 text-large',
              }}
            >
              <ListboxItem
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
              <ListboxItem
                key="profile"
                title={messages.profileSettings}
                startContent={<Settings size={16} />}
                onPress={() => {
                  navigateTo('/account/settings');
                  setIsMenuOpen(false);
                }}
              />
              <ListboxItem
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
            </Listbox>
          ) : (
            <>
              <Listbox
                aria-label="Account links"
                itemClasses={{
                  base: 'h-10 text-large',
                }}
              >
                <ListboxItem
                  key="signin"
                  startContent={<ArrowRightToLine size={16} />}
                  title={messages.signIn}
                  onPress={() => {
                    navigateTo('/account/signin');
                    setIsMenuOpen(false);
                  }}
                />
                <ListboxItem
                  key="signup"
                  title={messages.signUp}
                  startContent={<PenTool size={16} />}
                  onPress={() => {
                    navigateTo('/account/signup');
                    setIsMenuOpen(false);
                  }}
                />
              </Listbox>
              <p className="font-bold">{messages.languages}</p>
              <Listbox
                aria-label="Language links"
                itemClasses={{
                  base: 'h-10 text-large',
                }}
              >
                {locales.map((entry) => (
                  <ListboxItem
                    key={entry.code}
                    startContent={<Globe size={16} />}
                    title={entry.name}
                    onPress={() => {
                      changeLocale(entry.code);
                      setIsMenuOpen(false);
                    }}
                  />
                ))}
              </Listbox>
            </>
          )}
        </div>
      </NavbarMenu>
    </Navbar>
  );
}
