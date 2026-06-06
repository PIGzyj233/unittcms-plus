import { use } from 'react';
import { getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import CandidateReviewPage from './CandidateReviewPage';
import { AgentCandidateMessages } from '@/types/agentCandidate';

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const { locale } = params;
  const t = await getTranslations({ locale, namespace: 'CaseCandidates' });

  return {
    title: `${t('title')} | UnitTCMS`,
    robots: { index: false, follow: false },
  };
}

export default function Page(props: { params: Promise<{ projectId: string; locale: string }> }) {
  const params = use(props.params);
  const t = useTranslations('CaseCandidates');
  const caseT = useTranslations('Case');
  const casesT = useTranslations('Cases');

  const messages: AgentCandidateMessages = {
    title: t('title'),
    status: t('status'),
    draft: t('draft'),
    accepted: t('accepted'),
    rejected: t('rejected'),
    superseded: t('superseded'),
    source: t('source'),
    automatedSuggestion: t('automated_suggestion'),
    rationale: t('rationale'),
    duplicateWarnings: t('duplicate_warnings'),
    accept: t('accept'),
    reject: t('reject'),
    bulkAccept: t('bulk_accept'),
    allowPartial: t('allow_partial'),
    suggestedTags: t('suggested_tags'),
    createMissingTags: t('create_missing_tags'),
    acceptedCase: t('accepted_case'),
    noCandidatesFound: t('no_candidates_found'),
  };

  const caseMessages = {
    description: caseT('description'),
    preconditions: caseT('preconditions'),
    expectedResult: caseT('expected_result'),
    steps: caseT('steps'),
    tags: caseT('tags'),
    update: caseT('update'),
  };

  const casesMessages = {
    id: casesT('id'),
    actions: casesT('actions'),
  };

  return (
    <CandidateReviewPage
      projectId={params.projectId}
      locale={params.locale}
      messages={messages}
      caseMessages={caseMessages}
      casesMessages={casesMessages}
    />
  );
}
