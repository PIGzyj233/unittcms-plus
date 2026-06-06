import { use } from "react";
import { getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import AdminPage from './AdminPage';
import { PageType } from '@/types/base';
import { LocaleCodeType } from '@/types/locale';
import { AdminMessages } from '@/types/user';

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;

  const {
    locale
  } = params;

  const t = await getTranslations({ locale, namespace: 'Admin' });
  return {
    title: `${t('user_management')} | UnitTCMS`,
    robots: { index: false, follow: false },
  };
}

export default function Page(props: PageType) {
  const params = use(props.params);
  const t = useTranslations('Admin');
  const messages: AdminMessages = {
    userManagement: t('user_management'),
    avatar: t('avatar'),
    id: t('id'),
    email: t('email'),
    username: t('username'),
    role: t('role'),
    administrator: t('administrator'),
    user: t('user'),
    noUsersFound: t('no_users_found'),
    quitAdmin: t('quit_admin'),
    quit: t('quit'),
    quitConfirm: t('quit_confirm'),
    close: t('close'),
    roleChanged: t('role_changed'),
    lostAdminAuth: t('lost_admin_auth'),
    atLeast: t('at_least'),
    resetPassword: t('reset_password'),
    reset: t('reset'),
    invalidPassword: t('invalid_password'),
    passwordNotMatch: t('password_not_match'),
    agentMcp: t('agent_mcp'),
    mcpTokenName: t('mcp_token_name'),
    mcpTokenNamePlaceholder: t('mcp_token_name_placeholder'),
    mcpTokenPrefix: t('mcp_token_prefix'),
    mcpTokenStatus: t('mcp_token_status'),
    mcpTokenStatusActive: t('mcp_token_status_active'),
    mcpTokenStatusExpired: t('mcp_token_status_expired'),
    mcpTokenStatusRevoked: t('mcp_token_status_revoked'),
    mcpTokenLastUsed: t('mcp_token_last_used'),
    mcpTokenNeverUsed: t('mcp_token_never_used'),
    mcpTokenExpires: t('mcp_token_expires'),
    mcpTokenNoExpiry: t('mcp_token_no_expiry'),
    mcpTokenCreator: t('mcp_token_creator'),
    mcpTokenUnknownCreator: t('mcp_token_unknown_creator'),
    mcpTokenCreate: t('mcp_token_create'),
    mcpTokenRefresh: t('mcp_token_refresh'),
    mcpTokenRevoke: t('mcp_token_revoke'),
    mcpTokenCopy: t('mcp_token_copy'),
    mcpTokenPlaintextTitle: t('mcp_token_plaintext_title'),
    mcpTokenNoTokens: t('mcp_token_no_tokens'),
    mcpTokenCreated: t('mcp_token_created'),
    mcpTokenCopied: t('mcp_token_copied'),
    mcpTokenRevoked: t('mcp_token_revoked'),
    mcpTokenLoadError: t('mcp_token_load_error'),
    mcpTokenCreateError: t('mcp_token_create_error'),
    mcpTokenRevokeError: t('mcp_token_revoke_error'),
  };

  return (
    <div className="w-full flex items-center justify-center">
      <AdminPage messages={messages} locale={params.locale as LocaleCodeType} />
    </div>
  );
}
