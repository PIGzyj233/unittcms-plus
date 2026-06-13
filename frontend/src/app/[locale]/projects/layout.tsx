import { getTranslations } from 'next-intl/server';

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;

  const { locale } = params;

  const t = await getTranslations({ locale, namespace: 'Projects' });
  return {
    title: `${t('project_list')} | UnitTCMS`,
    robots: { index: false, follow: false },
  };
}

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
