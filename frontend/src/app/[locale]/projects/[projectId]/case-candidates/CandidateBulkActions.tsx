import { useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { Button, Checkbox } from '@/components/heroui';
import { AgentCandidateMessages } from '@/types/agentCandidate';

type Props = {
  selectedCount: number;
  isDisabled: boolean;
  messages: AgentCandidateMessages;
  onBulkAccept: (allowPartial: boolean) => void;
};

export default function CandidateBulkActions({ selectedCount, isDisabled, messages, onBulkAccept }: Props) {
  const [allowPartial, setAllowPartial] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Checkbox isSelected={allowPartial} onValueChange={setAllowPartial}>
        {messages.allowPartial}
      </Checkbox>
      <Button
        startContent={<CheckCheck size={16} />}
        size="sm"
        color="primary"
        isDisabled={isDisabled || selectedCount === 0}
        onPress={() => onBulkAccept(allowPartial)}
      >
        {messages.bulkAccept}
      </Button>
    </div>
  );
}
