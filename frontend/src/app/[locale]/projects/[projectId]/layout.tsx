import { use } from 'react';
import { useTranslations } from 'next-intl';
import Sidebar from './Sidebar';
import { ProjectMessages } from '@/types/project';

export default function SidebarLayout(props: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const { locale } = params;

  const { children } = props;

  const t = useTranslations('Project');
  const messages: ProjectMessages = {
    toggleSidebar: t('toggle_sidebar'),
    home: t('home'),
    testCases: t('test_cases'),
    caseCandidates: t('case_candidates'),
    testRuns: t('test_runs'),
    members: t('members'),
    settings: t('settings'),
  };

  return (
    <div className="workspace-shell flex flex-col md:flex-row">
      <Sidebar messages={messages} locale={locale} />
      <div className="min-w-0 flex-1 overflow-x-hidden">{children}</div>
    </div>
  );
}
