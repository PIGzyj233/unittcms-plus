import { useTranslations } from 'next-intl';

export default function Page() {
  const t = useTranslations('Run');

  return (
    <div className="flex min-h-full items-center justify-center bg-white p-6 dark:bg-neutral-950">
      <div className="w-full max-w-sm rounded-lg border border-black/10 bg-neutral-50/80 p-5 text-center shadow-sm shadow-black/[0.02] dark:border-white/10 dark:bg-neutral-900">
        <h3 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">{t('no_case_selected')}</h3>
      </div>
    </div>
  );
}
