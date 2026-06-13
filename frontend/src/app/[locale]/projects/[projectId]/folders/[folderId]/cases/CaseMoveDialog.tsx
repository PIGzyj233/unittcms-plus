'use client';
import { useState } from 'react';
import { Copy, Forward } from 'lucide-react';
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Spinner,
  addToast,
} from '@/components/heroui';
import { CaseType, CasesMessages } from '@/types/case';
import { moveCases, cloneCases } from '@/utils/caseControl';

type Props = {
  isOpen: boolean;
  testCaseIds: number[];
  selectedCases?: Pick<CaseType, 'id' | 'folderPath'>[];
  projectId: string;
  targetFolderId?: number;
  isDisabled: boolean;
  onCancel: () => void;
  onMoved: () => void;
  messages: CasesMessages;
  token: string;
};

export default function CaseDialog({
  isOpen,
  testCaseIds,
  selectedCases = [],
  projectId,
  targetFolderId,
  isDisabled,
  onCancel,
  onMoved,
  messages,
  token,
}: Props) {
  const [isProcessing, setIsProcessing] = useState(false);
  const folderPathSummary = Array.from(
    selectedCases
      .reduce((summary, testCase) => {
        const folderPath = testCase.folderPath?.join(' / ') || '-';
        summary.set(folderPath, (summary.get(folderPath) || 0) + 1);
        return summary;
      }, new Map<string, number>())
      .entries()
  );
  const visibleFolderPathSummary = folderPathSummary.slice(0, 3);
  const hiddenFolderPathCount = Math.max(0, folderPathSummary.length - visibleFolderPathSummary.length);

  const handleMove = async () => {
    if (!targetFolderId) {
      return;
    }

    setIsProcessing(true);
    const success = await moveCases(token, testCaseIds, targetFolderId, Number(projectId));
    setIsProcessing(false);

    if (success) {
      addToast({
        title: 'Success',
        color: 'success',
        description: messages.casesMoved,
      });
      onMoved();
      onCancel();
    } else {
      console.error('Error moving cases');
    }
  };

  const handleClone = async () => {
    if (!targetFolderId) {
      return;
    }

    setIsProcessing(true);
    const success = await cloneCases(token, testCaseIds, targetFolderId, Number(projectId));
    setIsProcessing(false);

    if (success) {
      addToast({ title: 'Success', color: 'success', description: messages.casesCloned });
      onMoved();
      onCancel();
    } else {
      console.error('Error cloning cases');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={() => {
        onCancel();
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">{messages.selectAction}</ModalHeader>
        <ModalBody>
          <p>
            {testCaseIds.length} {messages.casesSelected}
          </p>
          {visibleFolderPathSummary.length > 0 && (
            <div className="space-y-1 text-sm text-default-500">
              {visibleFolderPathSummary.map(([folderPath, count]) => (
                <div key={folderPath}>
                  {folderPath}: {count}
                </div>
              ))}
              {hiddenFolderPathCount > 0 && <div>+ {hiddenFolderPathCount} more folders</div>}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          {isProcessing ? (
            <Spinner />
          ) : (
            <>
              <Button variant="light" size="sm" onPress={onCancel}>
                {messages.close}
              </Button>
              <Button
                color="primary"
                size="sm"
                onPress={handleClone}
                startContent={<Copy size={16} />}
                isDisabled={isDisabled}
              >
                {messages.clone}
              </Button>
              <Button
                color="primary"
                size="sm"
                onPress={handleMove}
                startContent={<Forward size={16} />}
                isDisabled={isDisabled}
              >
                {messages.move}
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
