import { Plus, Trash } from 'lucide-react';
import { TextArea, Button, Tooltip, Avatar } from '@/components/heroui';
import { CaseMessages, StepType } from '@/types/case';

type Props = {
  isDisabled: boolean;
  steps: StepType[];
  onStepUpdate: (stepId: number, step: StepType) => void;
  onStepPlus: (newStepNo: number) => void;
  onStepDelete: (stepId: number) => void;
  messages: CaseMessages;
};

export default function StepsEditor({ isDisabled, steps, onStepUpdate, onStepPlus, onStepDelete, messages }: Props) {
  // sort steps by junction table's column
  const sortedSteps = steps.slice().sort((a, b) => {
    const stepNoA = a.caseSteps.stepNo;
    const stepNoB = b.caseSteps.stepNo;
    return stepNoA - stepNoB;
  });

  // filter steps
  const filteredSteps = sortedSteps.filter((entry) => entry.editState !== 'deleted');

  return (
    <div className="space-y-3">
      {filteredSteps.map((step) => (
        <div
          key={step.uid || step.id}
          className="grid grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-start gap-3 rounded-lg border border-black/10 bg-white p-3 shadow-sm shadow-black/[0.02] transition-colors hover:border-black/20 dark:border-white/10 dark:bg-neutral-900 dark:hover:border-white/20"
        >
          <Avatar
            className="mt-1 bg-neutral-950 text-white dark:bg-neutral-100 dark:text-neutral-950"
            size="sm"
            name={step.caseSteps.stepNo.toString()}
          />
          <div className="grid min-w-0 gap-3 xl:grid-cols-2">
            <div className="min-w-0">
              <TextArea
                size="sm"
                variant="bordered"
                label={messages.detailsOfTheStep}
                value={step.step}
                onValueChange={(changeValue) => {
                  onStepUpdate(step.id, { ...step, step: changeValue });
                }}
              />
            </div>
            <div className="min-w-0">
              <TextArea
                size="sm"
                variant="bordered"
                label={messages.expectedResult}
                value={step.result}
                onValueChange={(changeValue) => {
                  onStepUpdate(step.id, { ...step, result: changeValue });
                }}
              />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Tooltip content={messages.deleteThisStep} placement="left">
              <Button
                isIconOnly
                size="sm"
                isDisabled={isDisabled}
                variant="light"
                className="rounded-full"
                onPress={() => onStepDelete(step.id)}
              >
                <Trash size={16} />
              </Button>
            </Tooltip>
            <Tooltip content={messages.insertStep} placement="left">
              <Button
                isIconOnly
                isDisabled={isDisabled}
                size="sm"
                variant="light"
                className="rounded-full"
                onPress={() => onStepPlus(step.caseSteps.stepNo + 1)}
              >
                <Plus size={16} />
              </Button>
            </Tooltip>
          </div>
        </div>
      ))}
    </div>
  );
}
