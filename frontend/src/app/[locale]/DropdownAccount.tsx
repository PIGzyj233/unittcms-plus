'use client';
import { ChevronDown, PenTool, ArrowRightFromLine, ArrowRightToLine, Settings } from 'lucide-react';
import { useContext } from 'react';
import { Button, DropdownTrigger, Dropdown, DropdownMenu, DropdownItem } from '@/components/heroui';
import { TokenContext } from '@/utils/TokenProvider';
import { AccountDropDownMessages } from '@/types/user';
import UserAvatar from '@/components/UserAvatar';

type Props = {
  messages: AccountDropDownMessages;
  locale: string;
  onItemPress: () => void;
};

function getLocalizedPath(pathname: string, locale: string) {
  return pathname === '/' ? `/${locale}` : `/${locale}${pathname}`;
}

export default function DropdownAccount({ messages, locale, onItemPress }: Props) {
  const context = useContext(TokenContext);

  function navigateTo(pathname: string) {
    window.location.assign(getLocalizedPath(pathname, locale));
  }

  const signOut = () => {
    context.setToken({
      access_token: '',
      expires_at: 0,
      user: null,
    });
    context.removeTokenFromLocalStorage();
    navigateTo('/account/signin');
  };

  const signinItems = [
    {
      uid: 'account',
      title: messages.account,
      icon: (
        <UserAvatar size={16} username={context.token?.user?.username} avatarPath={context.token?.user?.avatarPath} />
      ),
      onPress: () => {
        navigateTo('/account');
        onItemPress();
      },
    },
    {
      uid: 'profile',
      title: messages.profileSettings,
      icon: <Settings size={16} />,
      onPress: () => {
        navigateTo('/account/settings');
        onItemPress();
      },
    },
    {
      uid: 'signout',
      title: messages.signOut,
      icon: <ArrowRightFromLine size={16} />,
      onPress: () => {
        signOut();
        onItemPress();
      },
    },
  ];

  const signoutItems = [
    {
      uid: 'signin',
      title: messages.signIn,
      icon: <ArrowRightToLine size={16} />,
      onPress: () => {
        navigateTo('/account/signin');
        onItemPress();
      },
    },
    {
      uid: 'signup',
      title: messages.signUp,
      icon: <PenTool size={16} />,
      onPress: () => {
        navigateTo('/account/signup');
        onItemPress();
      },
    },
  ];

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button
          size="sm"
          variant="light"
          startContent={
            <UserAvatar
              size={16}
              username={context.token?.user?.username}
              avatarPath={context.token?.user?.avatarPath}
            />
          }
          endContent={<ChevronDown size={16} />}
        >
          {context.isSignedIn() ? context.token?.user?.username : messages.signIn}
        </Button>
      </DropdownTrigger>
      {context.isSignedIn() ? (
        <DropdownMenu aria-label="account actions when sign in">
          {signinItems.map((entry) => (
            <DropdownItem key={entry.uid} title={entry.title} startContent={entry.icon} onPress={entry.onPress} />
          ))}
        </DropdownMenu>
      ) : (
        <DropdownMenu aria-label="account actions when sign out">
          {signoutItems.map((entry) => (
            <DropdownItem key={entry.uid} title={entry.title} startContent={entry.icon} onPress={entry.onPress} />
          ))}
        </DropdownMenu>
      )}
    </Dropdown>
  );
}
