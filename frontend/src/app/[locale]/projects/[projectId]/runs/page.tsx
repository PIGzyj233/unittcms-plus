import { use } from 'react';
import { getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import RunsPage from './RunsPage';
import { LocaleCodeType } from '@/types/locale';

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;

  const { locale } = params;

  const t = await getTranslations({ locale, namespace: 'Runs' });
  return {
    title: `${t('run_list')} | UnitTCMS`,
    robots: { index: false, follow: false },
  };
}

export default function Page(props: { params: Promise<{ projectId: string; locale: string }> }) {
  const params = use(props.params);
  const t = useTranslations('Runs');
  const messages = {
    runList: t('run_list'),
    run: t('run'),
    editRun: t('edit_run'),
    newRun: t('new_run'),
    deleteRun: t('delete_run'),
    id: t('id'),
    name: t('name'),
    description: t('description'),
    lastUpdate: t('last_update'),
    actions: t('actions'),
    runName: t('run_name'),
    runDescription: t('run_description'),
    noRunsFound: t('no_runs_found'),
    close: t('close'),
    create: t('create'),
    update: t('update'),
    pleaseEnter: t('please_enter'),
    areYouSure: t('are_you_sure'),
    delete: t('delete'),
  };

  return (
    <>
      <RunsPage projectId={params.projectId} locale={params.locale as LocaleCodeType} messages={messages} />
    </>
  );
}
