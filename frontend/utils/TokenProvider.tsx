'use client';
import { createContext, useState, useEffect } from 'react';
import { addToast } from '@heroui/react';
import {
  isSignedIn as tokenIsSinedIn,
  isAdmin as tokenIsAdmin,
  isProjectOnwer as tokenIsProjectOnwer,
  isProjectManager as tokenIsProjectManager,
  isProjectDeveloper as tokenIsProjectDeveloper,
  isProjectReporter as tokenIsProjectReporter,
  checkSignInPage as tokenCheckSignInPage,
  fetchMyRoles,
} from './token';
import { logError } from './errorHandler';
import { ProjectRoleType, TokenContextType, TokenType } from '@/types/user';
import { TokenProps } from '@/types/user';
const LOCAL_STORAGE_KEY = 'unittcms-auth-token';
const NAVIGATION_EVENT = 'unittcms:navigation';

function storeTokenToLocalStorage(token: TokenType) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(token));
}

function removeTokenFromLocalStorage() {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
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

const defaultContext = {
  token: {
    access_token: '',
    expires_at: 0,
    user: null,
  },
  isSignedIn: () => false,
  isAdmin: () => false,
  isProjectOwner: () => {
    return false;
  },
  isProjectManager: () => {
    return false;
  },
  isProjectDeveloper: () => {
    return false;
  },
  isProjectReporter: () => {
    return false;
  },
  refreshProjectRoles: () => {},
  setToken: () => {},
  storeTokenToLocalStorage,
  removeTokenFromLocalStorage,
};
const TokenContext = createContext<TokenContextType>(defaultContext);

const TokenProvider = ({ toastMessages, locale, children }: TokenProps) => {
  const currentLocale = locale ?? 'en';
  const [pathname, setPathname] = useState('');
  const [hasRestoreFinished, setHasRestoreFinished] = useState(false);
  const [token, setToken] = useState<TokenType>({
    access_token: '',
    expires_at: 0,
    user: null,
  });
  const [projectRoles, setProjectRoles] = useState<ProjectRoleType[]>([]);

  const isSignedIn = () => {
    return tokenIsSinedIn(token);
  };

  const isAdmin = () => {
    return tokenIsAdmin(token);
  };

  const isProjectOwner = (projectId: number) => {
    return tokenIsProjectOnwer(projectRoles, projectId);
  };

  const isProjectManager = (projectId: number) => {
    return tokenIsProjectManager(projectRoles, projectId);
  };

  const isProjectDeveloper = (projectId: number) => {
    return tokenIsProjectDeveloper(projectRoles, projectId);
  };

  const isProjectReporter = (projectId: number) => {
    return tokenIsProjectReporter(projectRoles, projectId);
  };

  async function refreshProjectRoles() {
    if (!hasRestoreFinished || !token || !token.access_token) {
      return;
    }

    try {
      const data = await fetchMyRoles(token.access_token);
      setProjectRoles(data);
    } catch (error: unknown) {
      logError('Error fetching project roles', error);
    }
  }

  const tokenContext = {
    token,
    projectRoles,
    isSignedIn,
    isAdmin,
    isProjectOwner,
    isProjectManager,
    isProjectDeveloper,
    isProjectReporter,
    setToken,
    refreshProjectRoles,
    storeTokenToLocalStorage,
    removeTokenFromLocalStorage,
  };

  const restoreTokenFromLocalStorage = () => {
    const tokenString = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (tokenString) {
      const restoredToken = JSON.parse(tokenString);
      setToken(restoredToken);
    }
    setHasRestoreFinished(true);
  };

  useEffect(() => {
    restoreTokenFromLocalStorage();
  }, []);

  useEffect(() => {
    const updatePathname = () => {
      setPathname(getUnlocalizedPathname(currentLocale));
    };
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    const notifyNavigation = () => window.dispatchEvent(new Event(NAVIGATION_EVENT));

    window.history.pushState = function pushState(...args) {
      const result = originalPushState.apply(this, args);
      notifyNavigation();
      return result;
    };
    window.history.replaceState = function replaceState(...args) {
      const result = originalReplaceState.apply(this, args);
      notifyNavigation();
      return result;
    };

    updatePathname();
    window.addEventListener('popstate', updatePathname);
    window.addEventListener(NAVIGATION_EVENT, updatePathname);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', updatePathname);
      window.removeEventListener(NAVIGATION_EVENT, updatePathname);
    };
  }, [currentLocale]);

  useEffect(() => {
    if (!hasRestoreFinished || !pathname) {
      return;
    }

    const ret = tokenCheckSignInPage(token, pathname);
    if (!ret.ok) {
      if (ret.reason === 'notoken') {
        if (toastMessages) {
          addToast({
            title: 'Error',
            description: toastMessages.needSignedIn,
            color: 'danger',
          });
        }
      } else if (ret.reason === 'expired') {
        if (toastMessages) {
          addToast({
            title: 'Error',
            description: toastMessages.sessionExpired,
            color: 'danger',
          });
        }
      }

      window.location.assign(`/${currentLocale}${ret.redirectPath}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, hasRestoreFinished]);

  useEffect(() => {
    refreshProjectRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRestoreFinished, token]);

  return <TokenContext.Provider value={tokenContext}>{children}</TokenContext.Provider>;
};

export { TokenContext };
export default TokenProvider;
