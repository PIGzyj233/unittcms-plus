'use client';
import { useState, useEffect, useContext, ChangeEvent, DragEvent } from 'react';
import { Save, Plus, ArrowLeft, Circle } from 'lucide-react';
import CaseStepsEditor from './CaseStepsEditor';
import CaseAttachmentsEditor from './CaseAttachmentsEditor';
import { updateSteps } from './stepControl';
import { fetchCreateAttachments, fetchDownloadAttachment, fetchDeleteAttachment } from './attachmentControl';
import CaseTagsEditor from './CaseTagsEditor';
import { Input, TextArea, Select, SelectItem, Button, Tooltip, addToast, Badge } from '@/components/heroui';
import { fetchCase, updateCase } from '@/utils/caseControl';
import { priorities, testTypes, templates } from '@/config/selection';
import { useRouter } from '@/src/i18n/routing';
import { TokenContext } from '@/utils/TokenProvider';
import { useFormGuard } from '@/utils/formGuard';
import { CaseType, AttachmentType, CaseMessages, StepType } from '@/types/case';
import { PriorityMessages } from '@/types/priority';
import { TestTypeMessages } from '@/types/testType';
import { logError } from '@/utils/errorHandler';
import { updateCaseTags } from '@/utils/caseTagsControls';

const defaultTestCase = {
  id: 0,
  title: '',
  state: 0,
  priority: 0,
  type: 0,
  automationStatus: 0,
  description: '',
  template: 0,
  preConditions: '',
  expectedResults: '',
  folderId: 0,
  Steps: [],
  Attachments: [],
  isIncluded: false,
  runStatus: 0,
  Tags: [],
};

type Props = {
  projectId: string;
  folderId: string;
  caseId: string;
  messages: CaseMessages;
  testTypeMessages: TestTypeMessages;
  priorityMessages: PriorityMessages;
  locale: string;
};

export default function CaseEditor({
  projectId,
  folderId,
  caseId,
  messages,
  testTypeMessages,
  priorityMessages,
  locale,
}: Props) {
  const tokenContext = useContext(TokenContext);
  const [testCase, setTestCase] = useState<CaseType>(defaultTestCase);
  const [isTitleInvalid] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [idCounter, setIdCounter] = useState<number>(0);
  const [isDirty, setIsDirty] = useState(false);
  const [selectedTags, setSelectedTags] = useState<{ id: number; name: string }[]>([]);

  const router = useRouter();
  useFormGuard(isDirty, messages.areYouSureLeave);

  const onPlusClick = async (newStepNo: number) => {
    if (!testCase.Steps) {
      return;
    }
    setIsDirty(true);
    const nextId = idCounter + 1;
    const newStep: StepType = {
      // hypothetical ID
      id: nextId,
      step: '',
      result: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      caseSteps: {
        stepNo: newStepNo,
      },
      uid: `uid${nextId}`,
      editState: 'new',
    };

    const updatedSteps = testCase.Steps.map((step) => {
      if (step.caseSteps.stepNo >= newStepNo) {
        return {
          ...step,
          editState: step.editState === 'notChanged' ? 'changed' : step.editState,
          caseSteps: {
            ...step.caseSteps,
            stepNo: step.caseSteps.stepNo + 1,
          },
        };
      }
      return step;
    });

    updatedSteps.push(newStep);

    setTestCase({
      ...testCase,
      Steps: updatedSteps,
    });
    setIdCounter(nextId);
  };

  const onDeleteClick = async (stepId: number) => {
    setIsDirty(true);
    if (!testCase.Steps) {
      return;
    }
    // find deletedStep's stepNo

    const deletedStep = testCase.Steps.find((step) => step.id === stepId);
    if (!deletedStep) {
      return;
    }
    const deletedStepNo = deletedStep.caseSteps.stepNo;
    deletedStep.editState = 'deleted';

    const updatedSteps = testCase.Steps.map((step) => {
      if (step.caseSteps.stepNo > deletedStepNo) {
        return {
          ...step,
          editState: step.editState === 'notChanged' ? 'changed' : step.editState,
          caseSteps: {
            ...step.caseSteps,
            stepNo: step.caseSteps.stepNo - 1,
          },
        };
      }
      return step;
    });

    setTestCase({
      ...testCase,
      Steps: updatedSteps,
    });
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (event.dataTransfer) {
      const filesArray = Array.from(event.dataTransfer.files);
      handleFetchCreateAttachments(Number(caseId), filesArray);
    }
  };

  const handleInput = (event: ChangeEvent) => {
    if (event.target) {
      const input = event.target as HTMLInputElement;
      if (input.files) {
        const filesArray = Array.from(input.files);
        handleFetchCreateAttachments(Number(caseId), filesArray);
      }
    }
  };

  const handleFetchCreateAttachments = async (caseId: number, files: File[]) => {
    const newAttachments = await fetchCreateAttachments(caseId, files);

    if (newAttachments) {
      const newAttachmentsWithJoinTable = [];
      newAttachments.forEach((attachment: AttachmentType) => {
        attachment.caseAttachments = {
          createdAt: new Date(),
          updatedAt: new Date(),
          caseId: 0,
          attachmentId: attachment.id,
        };
        newAttachmentsWithJoinTable.push(attachment);
      });
      const updatedAttachments = testCase.Attachments;
      if (updatedAttachments) {
        updatedAttachments.push(...newAttachments);

        setTestCase({
          ...testCase,
          Attachments: updatedAttachments,
        });
      }
    }
  };

  const onAttachmentDelete = async (attachmentId: number) => {
    await fetchDeleteAttachment(attachmentId);
    if (testCase.Attachments) {
      const filteredAttachments = testCase.Attachments.filter((attachment) => attachment.id !== attachmentId);

      setTestCase({
        ...testCase,
        Attachments: filteredAttachments,
      });
    }
  };

  const onStepUpdate = (stepId: number, changeStep: StepType) => {
    if (changeStep.editState === 'notChanged') {
      changeStep.editState = 'changed';
    }

    if (!testCase.Steps) {
      return;
    }

    setTestCase({
      ...testCase,
      Steps: testCase.Steps.map((step) => {
        if (step.id === stepId) {
          return changeStep;
        } else {
          return step;
        }
      }),
    });
  };

  useEffect(() => {
    const fetchAndSetCase = async () => {
      if (!tokenContext.isSignedIn()) return;
      try {
        const data = await fetchCase(tokenContext.token.access_token, Number(caseId));
        data.Steps.forEach((step: StepType) => {
          step.editState = 'notChanged';
        });

        // set idCounter to the max step id to avoid id conflict for new steps
        // id is not reflected on database
        const maxStepId = data.Steps.reduce((maxId: number, step: StepType) => Math.max(maxId, step.id), 0);
        setIdCounter(maxStepId);
        setTestCase(data);
        if (data.Tags) {
          setSelectedTags(Array.isArray(data.Tags) ? data.Tags : []);
        }
      } catch (error: unknown) {
        logError('Error fetching case data', error);
      }
    };
    fetchAndSetCase();
  }, [tokenContext, caseId]);

  return (
    <div className="flex min-h-full flex-col bg-[#f6f7f8] dark:bg-neutral-950">
      <div className="sticky top-0 z-20 flex w-full items-center justify-between gap-3 border-b border-black/10 bg-white/90 px-5 py-3 shadow-sm shadow-black/[0.02] backdrop-blur-xl dark:border-white/10 dark:bg-neutral-950/90">
        <div className="flex min-w-0 items-center">
          <Tooltip content={messages.backToCases} placement="left">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              className="shrink-0 rounded-full"
              onPress={() => router.push(`/projects/${projectId}/folders/${folderId}/cases`, { locale: locale })}
            >
              <ArrowLeft size={16} />
            </Button>
          </Tooltip>
          <h3 className="ms-2 min-w-0 truncate text-base font-semibold text-neutral-950 dark:text-neutral-50">
            {testCase.title}
          </h3>
        </div>
        <Button
          startContent={
            <Badge isInvisible={!isDirty} color="danger" size="sm" content="" shape="circle">
              <Save size={16} />
            </Badge>
          }
          size="sm"
          isDisabled={!tokenContext.isProjectDeveloper(Number(projectId))}
          color="primary"
          isLoading={isUpdating}
          onPress={async () => {
            setIsUpdating(true);
            try {
              await updateCase(tokenContext.token.access_token, testCase);
              if (testCase.Steps) {
                await updateSteps(tokenContext.token.access_token, Number(caseId), testCase.Steps);
              }

              const tagIds = selectedTags.map((tag) => tag.id);
              await updateCaseTags(tokenContext.token.access_token, Number(caseId), tagIds, projectId);

              addToast({
                title: 'Success',
                color: 'success',
                description: messages.updatedTestCase,
              });
              setIsDirty(false);
            } catch (error) {
              logError('Error updating test case', error);
              addToast({
                title: 'Error',
                description: messages.errorUpdatingTestCase,
                color: 'danger',
              });
            } finally {
              setIsUpdating(false);
            }
          }}
        >
          {isUpdating ? messages.updating : messages.update}
        </Button>
      </div>

      <div className="mx-auto w-full max-w-6xl space-y-5 p-5 lg:p-6">
        <section className="workspace-surface overflow-hidden">
          <div className="border-b border-black/10 px-5 py-4 dark:border-white/10">
            <h6 className="workspace-section-title">{messages.basic}</h6>
          </div>
          <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0 space-y-4">
              <Input
                size="sm"
                type="text"
                variant="bordered"
                label={messages.title}
                value={testCase.title}
                isInvalid={isTitleInvalid}
                errorMessage={isTitleInvalid ? messages.pleaseEnterTitle : ''}
                onChange={(e) => {
                  setIsDirty(true);
                  setTestCase({ ...testCase, title: e.target.value });
                }}
              />

              <TextArea
                size="sm"
                variant="bordered"
                label={messages.description}
                placeholder={messages.testCaseDescription}
                value={testCase.description}
                minRows={6}
                onValueChange={(changeValue) => {
                  setIsDirty(true);
                  setTestCase({ ...testCase, description: changeValue });
                }}
              />
            </div>

            <aside className="workspace-subtle-surface min-w-0 p-4">
              <CaseTagsEditor
                projectId={projectId}
                selectedTags={selectedTags}
                onChange={(tags) => {
                  setSelectedTags(tags);
                  setIsDirty(true);
                }}
                messages={messages}
              />

              <div className="mt-4 grid gap-3">
                <Select
                  size="sm"
                  variant="bordered"
                  selectedKeys={[priorities[testCase.priority].uid]}
                  onSelectionChange={(newSelection) => {
                    if (newSelection !== 'all' && newSelection.size !== 0) {
                      const selectedUid = Array.from(newSelection)[0];
                      const index = priorities.findIndex((priority) => priority.uid === selectedUid);
                      setIsDirty(true);
                      setTestCase({ ...testCase, priority: index });
                    }
                  }}
                  startContent={
                    <Circle
                      size={8}
                      color={priorities[testCase.priority].color}
                      fill={priorities[testCase.priority].color}
                    />
                  }
                  label={messages.priority}
                  className="w-full"
                >
                  {priorities.map((priority) => (
                    <SelectItem key={priority.uid}>{priorityMessages[priority.uid]}</SelectItem>
                  ))}
                </Select>

                <Select
                  size="sm"
                  variant="bordered"
                  selectedKeys={[testTypes[testCase.type].uid]}
                  onSelectionChange={(newSelection) => {
                    if (newSelection !== 'all' && newSelection.size !== 0) {
                      const selectedUid = Array.from(newSelection)[0];
                      const index = testTypes.findIndex((type) => type.uid === selectedUid);
                      setIsDirty(true);
                      setTestCase({ ...testCase, type: index });
                    }
                  }}
                  label={messages.type}
                  className="w-full"
                >
                  {testTypes.map((type) => (
                    <SelectItem key={type.uid}>{testTypeMessages[type.uid]}</SelectItem>
                  ))}
                </Select>

                <Select
                  size="sm"
                  variant="bordered"
                  selectedKeys={[templates[testCase.template].uid]}
                  onSelectionChange={(newSelection) => {
                    if (newSelection !== 'all' && newSelection.size !== 0) {
                      const selectedUid = Array.from(newSelection)[0];
                      const index = templates.findIndex((template) => template.uid === selectedUid);
                      setIsDirty(true);
                      setTestCase({ ...testCase, template: index });
                    }
                  }}
                  label={messages.template}
                  className="w-full"
                >
                  {templates.map((template) => (
                    <SelectItem key={template.uid}>{messages[template.uid]}</SelectItem>
                  ))}
                </Select>
              </div>
            </aside>
          </div>
        </section>

        <section className="workspace-surface overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-black/10 px-5 py-4 dark:border-white/10">
            <h6 className="workspace-section-title">
              {templates[testCase.template].uid === 'text' ? messages.testDetail : messages.steps}
            </h6>
            {templates[testCase.template].uid !== 'text' && (
              <Button
                startContent={<Plus size={16} />}
                size="sm"
                isDisabled={!tokenContext.isProjectDeveloper(Number(projectId))}
                color="primary"
                onPress={() => onPlusClick(1)}
              >
                {messages.newStep}
              </Button>
            )}
          </div>
          <div className="p-5">
            {templates[testCase.template].uid === 'text' ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <TextArea
                  size="sm"
                  variant="bordered"
                  label={messages.preconditions}
                  value={testCase.preConditions}
                  minRows={8}
                  onValueChange={(changeValue) => {
                    setIsDirty(true);
                    setTestCase({ ...testCase, preConditions: changeValue });
                  }}
                />

                <TextArea
                  size="sm"
                  variant="bordered"
                  label={messages.expectedResult}
                  value={testCase.expectedResults}
                  minRows={8}
                  onValueChange={(changeValue) => {
                    setIsDirty(true);
                    setTestCase({ ...testCase, expectedResults: changeValue });
                  }}
                />
              </div>
            ) : (
              testCase.Steps && (
                <CaseStepsEditor
                  isDisabled={!tokenContext.isProjectDeveloper(Number(projectId))}
                  steps={testCase.Steps}
                  onStepUpdate={onStepUpdate}
                  onStepPlus={onPlusClick}
                  onStepDelete={onDeleteClick}
                  messages={messages}
                />
              )
            )}
          </div>
        </section>

        <section className="workspace-surface overflow-hidden">
          <div className="border-b border-black/10 px-5 py-4 dark:border-white/10">
            <h6 className="workspace-section-title">{messages.attachments}</h6>
          </div>
          <div className="p-5">
            {testCase.Attachments && (
              <CaseAttachmentsEditor
                isDisabled={!tokenContext.isProjectDeveloper(Number(projectId))}
                attachments={testCase.Attachments}
                onAttachmentDownload={(attachmentId: number, downloadFileName: string) =>
                  fetchDownloadAttachment(attachmentId, downloadFileName)
                }
                onAttachmentDelete={onAttachmentDelete}
                onFilesDrop={handleDrop}
                onFilesInput={handleInput}
                messages={messages}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
