'use client';
import { useState, useEffect, useContext } from 'react';
import { Folder, Clipboard, FlaskConical } from 'lucide-react';
import { useTheme } from 'next-themes';
import { aggregateBasicInfo, aggregateTestPriority, aggregateTestType, aggregateProgress } from './aggregate';
import { HomeMessages } from './page';
import TestTypesChart from './TestTypesDonutChart';
import TestPriorityChart from './TestPriorityDonutChart';
import TestProgressBarChart from './TestProgressColumnChart';
import { Chip } from '@/components/heroui';
import Config from '@/config/config';
import { TokenContext } from '@/utils/TokenProvider';
import { ProgressSeriesType } from '@/types/run';
import { TestRunCaseStatusMessages } from '@/types/status';
import { TestTypeMessages } from '@/types/testType';
import { PriorityMessages } from '@/types/priority';
import { ProjectType } from '@/types/project';
import { CasePriorityCountType, CaseTypeCountType } from '@/types/chart';
import { logError } from '@/utils/errorHandler';

const apiServer = Config.apiServer;

async function fetchProject(jwt: string, projectId: number) {
  const fetchOptions = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
  };

  const url = `${apiServer}/home/${projectId}`;

  try {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error: unknown) {
    logError('Error fetching data:', error);
  }
}

type Props = {
  projectId: string;
  messages: HomeMessages;
  testRunCaseStatusMessages: TestRunCaseStatusMessages;
  testTypeMessages: TestTypeMessages;
  priorityMessages: PriorityMessages;
};

export function ProjectHome({
  projectId,
  messages,
  testRunCaseStatusMessages,
  testTypeMessages,
  priorityMessages,
}: Props) {
  const context = useContext(TokenContext);
  const { theme } = useTheme();
  const [project, setProject] = useState<ProjectType>({
    id: 0,
    name: '',
    detail: '',
    isPublic: false,
    userId: 0,
    createdAt: '',
    updatedAt: '',
    Folders: [],
    Runs: [],
  });
  const [folderNum, setFolderNum] = useState(0);
  const [caseNum, setCaseNum] = useState(0);
  const [runNum, setRunNum] = useState(0);
  const [typesCounts, setTypesCounts] = useState<CaseTypeCountType[]>([]);
  const [priorityCounts, setPriorityCounts] = useState<CasePriorityCountType[]>([]);
  const [progressCategories, setProgressCategories] = useState<string[]>([]);
  const [progressSeries, setProgressSeries] = useState<ProgressSeriesType[]>([]);

  useEffect(() => {
    async function fetchDataEffect() {
      if (!context.isSignedIn()) {
        return;
      }

      try {
        const data = await fetchProject(context.token.access_token, Number(projectId));
        setProject(data);
      } catch (error: unknown) {
        logError('Error in effect:', error);
      }
    }

    fetchDataEffect();
  }, [context, projectId]);

  useEffect(() => {
    async function aggregate() {
      if (!project) {
        return;
      }
      const { folderNum, runNum, caseNum } = aggregateBasicInfo(project);
      setFolderNum(folderNum);
      setRunNum(runNum);
      setCaseNum(caseNum);

      const typeRet = aggregateTestType(project);
      setTypesCounts([...typeRet]);

      const priorityRet = aggregateTestPriority(project);
      setPriorityCounts([...priorityRet]);

      const { series, categories } = aggregateProgress(project, testRunCaseStatusMessages);
      setProgressSeries([...series]);
      setProgressCategories([...categories]);
    }

    aggregate();
  }, [project, testRunCaseStatusMessages]);

  const stats = [
    {
      key: 'folders',
      label: messages.folders,
      value: folderNum,
      icon: <Folder size={18} />,
    },
    {
      key: 'cases',
      label: messages.testCases,
      value: caseNum,
      icon: <Clipboard size={18} />,
    },
    {
      key: 'runs',
      label: messages.testRuns,
      value: runNum,
      icon: <FlaskConical size={18} />,
    },
  ];

  return (
    <div className="workspace-page-wide">
      <section className="workspace-surface overflow-hidden">
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-semibold tracking-normal text-neutral-950 dark:text-white">
              {project.name}
            </h1>
            {project.detail && (
              <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                {project.detail}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.map((stat) => (
              <Chip key={stat.key} variant="flat" startContent={stat.icon} className="px-3">
                <span className="font-semibold">{stat.value}</span> {stat.label}
              </Chip>
            ))}
          </div>
        </div>
      </section>

      <section className="workspace-surface mt-6 overflow-hidden">
        <div className="border-b border-black/10 px-5 py-4 dark:border-white/10">
          <h2 className="workspace-section-title">{messages.progress}</h2>
        </div>
        <div className="h-80 min-w-0 p-4 lg:h-96">
          <TestProgressBarChart progressSeries={progressSeries} progressCategories={progressCategories} theme={theme} />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="workspace-section-title mb-3">{messages.testClassification}</h2>
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <div className="workspace-surface min-w-0 overflow-hidden">
            <div className="border-b border-black/10 px-5 py-4 dark:border-white/10">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">{messages.byType}</h3>
            </div>
            <div className="h-80 min-w-0 p-4">
              <TestTypesChart typesCounts={typesCounts} testTypeMessages={testTypeMessages} theme={theme} />
            </div>
          </div>
          <div className="workspace-surface min-w-0 overflow-hidden">
            <div className="border-b border-black/10 px-5 py-4 dark:border-white/10">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">{messages.byPriority}</h3>
            </div>
            <div className="h-80 min-w-0 p-4">
              <TestPriorityChart priorityCounts={priorityCounts} priorityMessages={priorityMessages} theme={theme} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
