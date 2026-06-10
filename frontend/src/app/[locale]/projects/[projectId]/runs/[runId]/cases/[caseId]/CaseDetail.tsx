'use client';

import { Chip } from '@/components/heroui';
import { templates, testTypes } from '@/config/selection';
import type { CaseType } from '@/types/case';
import type { RunDetailMessages } from '@/types/run';
import type { PriorityMessages } from '@/types/priority';
import type { TestTypeMessages } from '@/types/testType';
import TestCasePriority from '@/components/TestCasePriority';
import { Link, NextUiLinkClasses } from '@/src/i18n/routing';

type Props = {
  projectId: string;
  testCase: CaseType;
  locale: string;
  messages: RunDetailMessages;
  testTypeMessages: TestTypeMessages;
  priorityMessages: PriorityMessages;
};

export default function CaseDetail({
  projectId,
  testCase,
  locale,
  messages,
  testTypeMessages,
  priorityMessages,
}: Props) {
  return (
    <div className="h-full overflow-auto bg-white p-4 text-sm text-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
      <section className="rounded-lg border border-black/10 bg-neutral-50/70 p-4 dark:border-white/10 dark:bg-neutral-900">
        <Link
          href={`/projects/${projectId}/folders/${testCase.folderId}/cases/${testCase.id}`}
          locale={locale}
          className={`${NextUiLinkClasses} text-base font-semibold`}
        >
          #{testCase.id} {testCase.title}
        </Link>

        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold uppercase text-neutral-500">{messages.description}</p>
          <div className="whitespace-pre-wrap leading-6">{testCase.description || '-'}</div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-neutral-950">
            <p className="mb-2 text-xs font-semibold uppercase text-neutral-500">{messages.priority}</p>
            <TestCasePriority priorityValue={testCase.priority} priorityMessages={priorityMessages} />
          </div>

          <div className="rounded-md border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-neutral-950">
            <p className="mb-2 text-xs font-semibold uppercase text-neutral-500">{messages.type}</p>
            <div>{testTypeMessages[testTypes[testCase.type].uid]}</div>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase text-neutral-500">{messages.tags}</p>
          <div className="flex flex-wrap gap-1.5">
            {(!testCase.Tags || testCase.Tags.length === 0) && <span className="text-neutral-400">-</span>}
            {testCase.Tags &&
              testCase.Tags.length > 0 &&
              testCase.Tags.map((tag) => (
                <Chip key={tag.id} size="sm" variant="flat">
                  {tag.name}
                </Chip>
              ))}
          </div>
        </div>
      </section>

      {templates[testCase.template].uid === 'text' ? (
        <section className="mt-4 rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-neutral-950">
          <div className="border-b border-black/10 px-4 py-3 dark:border-white/10">
            <p className="font-semibold text-neutral-950 dark:text-neutral-50">{messages.testDetail}</p>
          </div>
          <div className="grid gap-3 p-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-neutral-500">{messages.preconditions}</p>
              <div className="min-h-24 whitespace-pre-wrap rounded-md bg-neutral-50 p-3 leading-6 dark:bg-neutral-900">
                {testCase.preConditions || '-'}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-neutral-500">{messages.expectedResult}</p>
              <div className="min-h-24 whitespace-pre-wrap rounded-md bg-neutral-50 p-3 leading-6 dark:bg-neutral-900">
                {testCase.expectedResults || '-'}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-4 rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-neutral-950">
          <div className="border-b border-black/10 px-4 py-3 dark:border-white/10">
            <p className="font-semibold text-neutral-950 dark:text-neutral-50">{messages.steps}</p>
          </div>
          <div className="space-y-3 p-4">
            {testCase.Steps &&
              testCase.Steps.length > 0 &&
              testCase.Steps.map((step) => (
                <div key={step.id} className="grid gap-3 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-neutral-950 px-2 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-950">
                      {step.caseSteps.stepNo}
                    </span>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-neutral-500">
                        {messages.detailsOfTheStep}
                      </p>
                      <div className="whitespace-pre-wrap leading-6">{step.step || '-'}</div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-neutral-500">{messages.expectedResult}</p>
                      <div className="whitespace-pre-wrap leading-6">{step.result || '-'}</div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
