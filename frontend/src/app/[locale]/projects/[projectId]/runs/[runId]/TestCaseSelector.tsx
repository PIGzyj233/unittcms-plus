import { useState, useMemo, ReactNode } from 'react';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Selection,
  SortDescriptor,
  Chip,
} from '@/components/heroui';
import { CaseType } from '@/types/case';
import { RunMessages } from '@/types/run';
import { PriorityMessages } from '@/types/priority';
import TestCasePriority from '@/components/TestCasePriority';

type Props = {
  cases: CaseType[];
  selectedKeys: Selection;
  onSelectionChange: React.Dispatch<React.SetStateAction<Selection>>;
  messages: RunMessages;
  priorityMessages: PriorityMessages;
};

export default function TestCaseSelector({
  cases,
  selectedKeys,
  onSelectionChange,
  messages,
  priorityMessages,
}: Props) {
  const headerColumns = [
    { name: messages.id, uid: 'id', sortable: true },
    { name: messages.title, uid: 'title', sortable: true },
    { name: messages.folderPath, uid: 'folderPath', sortable: true },
    { name: messages.priority, uid: 'priority', sortable: true },
    { name: messages.tags, uid: 'tags', sortable: false },
    { name: messages.membership, uid: 'membership', sortable: false },
  ];

  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'id',
    direction: 'ascending',
  });

  const sortedItems = useMemo(() => {
    return [...cases].sort((a: CaseType, b: CaseType) => {
      const firstValue = a[sortDescriptor.column as keyof CaseType];
      const secondValue = b[sortDescriptor.column as keyof CaseType];
      const first = Array.isArray(firstValue) ? firstValue.join(' / ') : firstValue ?? '';
      const second = Array.isArray(secondValue) ? secondValue.join(' / ') : secondValue ?? '';
      const cmp = first < second ? -1 : first > second ? 1 : 0;

      return sortDescriptor.direction === 'descending' ? -cmp : cmp;
    });
  }, [sortDescriptor, cases]);

  const membershipLabel = (testCase: CaseType) => {
    const runCase = testCase.RunCases?.[0];
    if (!runCase) {
      return messages.notIncluded;
    }
    if (runCase.editState === 'new') {
      return messages.pendingInclude;
    }
    if (runCase.editState === 'deleted') {
      return messages.pendingExclude;
    }
    return messages.included;
  };

  const renderCell = (testCase: CaseType, columnKey: string): ReactNode => {
    const cellValue = testCase[columnKey as keyof CaseType];

    switch (columnKey) {
      case 'title':
        return <div>{cellValue as string}</div>;
      case 'priority':
        return (
          <div>
            <TestCasePriority priorityValue={cellValue as number} priorityMessages={priorityMessages} />
          </div>
        );
      case 'folderPath':
        return <div>{testCase.folderPath?.join(' / ') || '-'}</div>;
      case 'tags':
        return (
          <div className="flex gap-1 flex-wrap">
            {testCase.Tags && testCase.Tags.length > 0 ? (
              testCase.Tags.map((tag) => (
                <Chip key={tag.id} size="sm" variant="flat">
                  {tag.name}
                </Chip>
              ))
            ) : (
              <span>-</span>
            )}
          </div>
        );
      case 'membership':
        return <span>{membershipLabel(testCase)}</span>;
      default:
        return cellValue as string;
    }
  };

  const classNames = useMemo(
    () => ({
      wrapper: ['min-w-3xl'],
      th: ['bg-transparent', 'text-default-500', 'border-b', 'border-divider'],
      td: [
        // changing the rows border radius
        // first
        'group-data-[first=true]:first:before:rounded-none',
        'group-data-[first=true]:last:before:rounded-none',
        // middle
        'group-data-[middle=true]:before:rounded-none',
        // last
        'group-data-[last=true]:first:before:rounded-none',
        'group-data-[last=true]:last:before:rounded-none',
      ],
    }),
    []
  );

  const handleSelectionChange = (keys: Selection) => {
    onSelectionChange(keys);
  };

  return (
    <>
      <Table
        isCompact
        removeWrapper
        aria-label="Tese cases table"
        classNames={classNames}
        selectedKeys={selectedKeys}
        selectionMode="multiple"
        sortDescriptor={sortDescriptor}
        onSelectionChange={handleSelectionChange}
        onSortChange={setSortDescriptor}
      >
        <TableHeader columns={headerColumns}>
          {(column) => (
            <TableColumn
              key={column.uid}
              align="start"
              allowsSorting={column.sortable}
            >
              {column.name}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody emptyContent={messages.noCasesFound} items={sortedItems}>
          {(item) => (
            <TableRow key={item.id}>
              {(columnKey) => <TableCell>{renderCell(item, columnKey as string)}</TableCell>}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
