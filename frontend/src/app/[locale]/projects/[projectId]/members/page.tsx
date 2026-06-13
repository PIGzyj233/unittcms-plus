import { use } from 'react';
import { getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import MembersPage from './MembersPage';

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;

  const { locale } = params;

  const t = await getTranslations({ locale, namespace: 'Members' });
  return {
    title: `${t('member_management')} | UnitTCMS`,
    robots: { index: false, follow: false },
  };
}

export default function Page(props: { params: Promise<{ projectId: string; locale: string }> }) {
  const params = use(props.params);
  const t = useTranslations('Members');
  const messages = {
    memberManagement: t('member_management'),
    avatar: t('avatar'),
    email: t('email'),
    username: t('username'),
    role: t('role'),
    manager: t('manager'),
    developer: t('developer'),
    reporter: t('reporter'),
    delete: t('delete'),
    deleteMember: t('deleteMember'),
    noMembersFound: t('no_members_found'),
    addMember: t('add_member'),
    userNameOrEmail: t('user_name_or_email'),
    close: t('close'),
    add: t('add'),
    areYouSure: t('are_you_sure'),
    memberAdded: t('member_added'),
    roleChanged: t('role_changed'),
    memberDeleted: t('member_deleted'),
  };

  return (
    <>
      <MembersPage projectId={params.projectId} messages={messages} />
    </>
  );
}
