'use client';
import { useEffect, useState, useContext } from 'react';
import { useSearchParams } from 'next/navigation';
import RunCaseStatusSelect from '../../RunCaseStatusSelect';
import { useRunExecution } from '../../RunExecutionContext';
import CaseDetail from './CaseDetail';
import { Tabs, Tab } from '@/components/heroui';
import Comments from '@/components/Comments';
import History from '@/components/History';
import { TokenContext } from '@/utils/TokenProvider';
import { fetchCase } from '@/utils/caseControl';
import { logError } from '@/utils/errorHandler';
import type { CaseType, StepType } from '@/types/case';
import type { RunCaseType, RunDetailMessages } from '@/types/run';
import type { PriorityMessages } from '@/types/priority';
import type { TestTypeMessages } from '@/types/testType';
import type { TestRunCaseStatusMessages } from '@/types/status';
import type { CommentMessages } from '@/types/comment';

type Props = {
  projectId: string;
  runId: string;
  locale: string;
  caseId: string;
  messages: RunDetailMessages;
  testTypeMessages: TestTypeMessages;
  priorityMessages: PriorityMessages;
  testRunCaseStatusMessages: TestRunCaseStatusMessages;
  commentMessages: CommentMessages;
};

export default function TestCaseDetailPane({
  projectId,
  runId,
  locale,
  caseId,
  messages,
  testTypeMessages,
  priorityMessages,
  testRunCaseStatusMessages,
  commentMessages,
}: Props) {
  const context = useContext(TokenContext);
  const searchParams = useSearchParams();
  const { getExecutionRunCase, handleRunCaseStatusChange, canEditExecution } = useRunExecution();
  const [selectedTab, setSelectedTab] = useState('caseDetail');
  const [isFetching, setIsFetching] = useState(false);
  const [testCase, setTestCase] = useState<CaseType | null>(null);
  const [runCaseId, setRunCaseId] = useState<number | undefined>(undefined);

  useEffect(() => {
    // if the url has ?tab=comments, then select the comments tab
    const tab = searchParams.get('tab');
    if (tab === 'comments') {
      setSelectedTab('comments');
    } else if (tab === 'history') {
      setSelectedTab('history');
    } else {
      setSelectedTab('caseDetail');
    }
  }, [searchParams]);

  useEffect(() => {
    async function fetchDataEffect() {
      if (!context.isSignedIn()) return;
      if (!caseId || Number(caseId) <= 0) return;

      setIsFetching(true);
      try {
        const data = await fetchCase(context.token.access_token, Number(caseId));
        if (data.Steps && data.Steps.length > 0) {
          data.Steps.sort((a: StepType, b: StepType) => a.caseSteps.stepNo - b.caseSteps.stepNo);
        }
        setTestCase(data);

        // Find the runCase for this case in this run
        if (data.RunCases && data.RunCases.length > 0) {
          const runCase = data.RunCases.find((rc: RunCaseType) => rc.runId === Number(runId));
          if (runCase) {
            setRunCaseId(runCase.id);
          }
        }
      } catch (error: unknown) {
        logError('Error fetching case data', error);
      } finally {
        setIsFetching(false);
      }
    }

    fetchDataEffect();
  }, [context, caseId, runId]);

  const isExecutionWorkflow = searchParams.get('tab') === 'execution';
  const executionRunCase = isExecutionWorkflow ? getExecutionRunCase(Number(caseId)) : undefined;
  const titleSuffix =
    isExecutionWorkflow && executionRunCase ? (
      <RunCaseStatusSelect
        runCase={executionRunCase}
        statusLabel={messages.status}
        statusMessages={testRunCaseStatusMessages}
        onStatusChange={handleRunCaseStatusChange}
        isDisabled={!canEditExecution}
      />
    ) : null;

  if (isFetching || !testCase) {
    return (
      <div className="flex h-full items-center justify-center bg-white text-sm text-neutral-500 dark:bg-neutral-950">
        loading...
      </div>
    );
  } else {
    return (
      <div className="flex h-full w-full flex-col bg-white p-3 dark:bg-neutral-950">
        <Tabs
          aria-label="Options"
          size="sm"
          variant="underlined"
          selectedKey={selectedTab}
          onSelectionChange={(key) => setSelectedTab(String(key))}
        >
          <Tab key="caseDetail" title={messages.caseDetail}>
            <CaseDetail
              projectId={projectId}
              testCase={testCase}
              locale={locale}
              messages={messages}
              testTypeMessages={testTypeMessages}
              priorityMessages={priorityMessages}
              titleSuffix={titleSuffix}
            />
          </Tab>
          <Tab key="comments" title={messages.comments}>
            <Comments
              projectId={projectId}
              commentableType="RunCase"
              commentableId={runCaseId}
              messages={commentMessages}
            />
          </Tab>
          <Tab key="history" title={messages.history}>
            <History />
          </Tab>
        </Tabs>
      </div>
    );
  }
}
