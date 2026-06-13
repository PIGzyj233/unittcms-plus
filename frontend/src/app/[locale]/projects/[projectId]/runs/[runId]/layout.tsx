import { use } from 'react';
import { useTranslations } from 'next-intl';
import RunEditor from './RunEditor';
import RunLayoutShell from './RunLayoutShell';
import { RunMessages } from '@/types/run';
import { PriorityMessages } from '@/types/priority';
import { RunStatusMessages, TestRunCaseStatusMessages } from '@/types/status';
import { TestTypeMessages } from '@/types/testType';

export default function RunLayout(props: {
  children: React.ReactNode;
  params: Promise<{ projectId: string; runId: string; locale: string }>;
}) {
  const params = use(props.params);

  const { projectId, runId, locale } = params;

  const { children } = props;

  const t = useTranslations('Run');
  const messages: RunMessages = {
    backToRuns: t('back_to_runs'),
    updating: t('updating'),
    update: t('update'),
    updatedTestRun: t('updated_test_run'),
    testRunOverview: t('test_run_overview'),
    runCaseExecution: t('run_case_execution'),
    saveOverview: t('save_overview'),
    saveSelection: t('save_selection'),
    saveExecution: t('save_execution'),
    savedRunCasesOnly: t('saved_run_cases_only'),
    runCaseSaveConflict: t('run_case_save_conflict'),
    unsavedChanges: t('unsaved_changes'),
    all: t('all'),
    discard: t('discard'),
    export: t('export'),
    progress: t('progress'),
    refresh: t('refresh'),
    id: t('id'),
    title: t('title'),
    folderPath: t('folder_path'),
    pleaseEnter: t('please_enter'),
    description: t('description'),
    priority: t('priority'),
    actions: t('actions'),
    status: t('status'),
    selectTestCase: t('select_test_case'),
    membership: t('membership'),
    included: t('included'),
    notIncluded: t('not_included'),
    pendingInclude: t('pending_include'),
    pendingExclude: t('pending_exclude'),
    includeSubfolders: t('include_subfolders'),
    testCaseSelection: t('test_case_selection'),
    includeInRun: t('include_in_run'),
    excludeFromRun: t('exclude_from_run'),
    noCasesFound: t('no_cases_found'),
    areYouSureLeave: t('are_you_sure_leave'),
    type: t('type'),
    testDetail: t('test_detail'),
    steps: t('steps'),
    preconditions: t('preconditions'),
    expectedResult: t('expected_result'),
    detailsOfTheStep: t('details_of_the_step'),
    close: t('close'),
    filter: t('filter'),
    clearAll: t('clear_all'),
    apply: t('apply'),
    selectStatus: t('select_status'),
    selectPriorities: t('select_priorities'),
    selectTypes: t('select_types'),
    pleaseSave: t('please_save'),
    caseTitleOrDescription: t('case_title_or_description'),
    selected: t('selected'),
    tags: t('tags'),
    selectTags: t('select_tags'),
    comments: t('comments'),
  };

  const rst = useTranslations('RunStatus');
  const runStatusMessages: RunStatusMessages = {
    new: rst('new'),
    inProgress: rst('inProgress'),
    underReview: rst('underReview'),
    rejected: rst('rejected'),
    done: rst('done'),
    closed: rst('closed'),
  };

  const rcst = useTranslations('RunCaseStatus');
  const testRunCaseStatusMessages: TestRunCaseStatusMessages = {
    untested: rcst('untested'),
    passed: rcst('passed'),
    failed: rcst('failed'),
    retest: rcst('retest'),
    skipped: rcst('skipped'),
  };

  const pt = useTranslations('Priority');
  const priorityMessages: PriorityMessages = {
    critical: pt('critical'),
    high: pt('high'),
    medium: pt('medium'),
    low: pt('low'),
  };

  const tt = useTranslations('Type');
  const testTypeMessages: TestTypeMessages = {
    other: tt('other'),
    security: tt('security'),
    performance: tt('performance'),
    accessibility: tt('accessibility'),
    functional: tt('functional'),
    acceptance: tt('acceptance'),
    usability: tt('usability'),
    smokeSanity: tt('smoke_sanity'),
    compatibility: tt('compatibility'),
    destructive: tt('destructive'),
    regression: tt('regression'),
    automated: tt('automated'),
    manual: tt('manual'),
  };

  return (
    <RunLayoutShell
      leftPane={
        <RunEditor
          projectId={projectId}
          runId={runId}
          messages={messages}
          runStatusMessages={runStatusMessages}
          testRunCaseStatusMessages={testRunCaseStatusMessages}
          priorityMessages={priorityMessages}
          testTypeMessages={testTypeMessages}
          locale={locale}
        />
      }
      rightPane={children}
    />
  );
}
