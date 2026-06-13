import { useContext, useEffect, useState } from 'react';
import { ChevronDown, SearchIcon } from 'lucide-react';
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Selection,
  addToast,
} from '@/components/heroui';
import { priorities, testRunCaseStatus, testTypes } from '@/config/selection';
import { PriorityMessages } from '@/types/priority';
import { RunMessages } from '@/types/run';
import { TestRunCaseStatusMessages } from '@/types/status';
import { TagType } from '@/types/tag';
import { TestTypeMessages } from '@/types/testType';
import { TokenContext } from '@/utils/TokenProvider';
import { logError } from '@/utils/errorHandler';
import { fetchTags } from '@/utils/tagsControls';

type ExecutionRunFilterProps = {
  messages: RunMessages;
  projectId: string;
  activeSearchFilter: string;
  activeStatusFilters: number[];
  activeTagFilters: number[];
  activePriorityFilters: number[];
  activeTypeFilters: number[];
  onFilterChange: (
    search: string,
    status: number[],
    tagIds: number[],
    priorityIndices: number[],
    typeIndices: number[]
  ) => void;
  priorityMessages: PriorityMessages;
  testRunCaseStatusMessages: TestRunCaseStatusMessages;
  testTypeMessages: TestTypeMessages;
};

type Tag = Pick<TagType, 'id' | 'name'>;

function selectionToNumberList(selection: Selection) {
  if (selection === 'all' || selection.size === 0) {
    return [];
  }

  return Array.from(selection)
    .map((key) => parseInt(key as string, 10))
    .filter((id) => !isNaN(id));
}

export default function ExecutionRunFilter({
  messages,
  projectId,
  activeSearchFilter = '',
  activeStatusFilters = [],
  activeTagFilters = [],
  activePriorityFilters = [],
  activeTypeFilters = [],
  onFilterChange,
  priorityMessages,
  testRunCaseStatusMessages,
  testTypeMessages,
}: ExecutionRunFilterProps) {
  const tokenContext = useContext(TokenContext);
  const [search, setSearch] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<Selection>(new Set([]));
  const [selectedTags, setSelectedTags] = useState<Selection>(new Set([]));
  const [selectedPriorities, setSelectedPriorities] = useState<Selection>(new Set([]));
  const [selectedTypes, setSelectedTypes] = useState<Selection>(new Set([]));
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    const fetchDataEffect = async () => {
      try {
        const tagsResponse = (await fetchTags(tokenContext.token.access_token, projectId)) || [];
        setTags(tagsResponse);
      } catch (error) {
        logError('Error fetching case tags', error);
        addToast({ title: 'Error', description: 'Error fetching tags', color: 'danger' });
      }
    };
    fetchDataEffect();
  }, [projectId, tokenContext.token.access_token]);

  useEffect(() => {
    setSearch(activeSearchFilter || '');
  }, [activeSearchFilter]);

  useEffect(() => {
    setSelectedStatuses(activeStatusFilters.length > 0 ? new Set(activeStatusFilters.map(String)) : new Set([]));
  }, [activeStatusFilters]);

  useEffect(() => {
    setSelectedTags(activeTagFilters.length > 0 ? new Set(activeTagFilters.map(String)) : new Set([]));
  }, [activeTagFilters]);

  useEffect(() => {
    setSelectedPriorities(activePriorityFilters.length > 0 ? new Set(activePriorityFilters.map(String)) : new Set([]));
  }, [activePriorityFilters]);

  useEffect(() => {
    setSelectedTypes(activeTypeFilters.length > 0 ? new Set(activeTypeFilters.map(String)) : new Set([]));
  }, [activeTypeFilters]);

  const handleApplyFilter = () => {
    onFilterChange(
      search,
      selectionToNumberList(selectedStatuses),
      selectionToNumberList(selectedTags),
      selectionToNumberList(selectedPriorities),
      selectionToNumberList(selectedTypes)
    );
  };

  const handleClearFilter = () => {
    setSearch('');
    setSelectedStatuses(new Set([]));
    setSelectedTags(new Set([]));
    setSelectedPriorities(new Set([]));
    setSelectedTypes(new Set([]));
    onFilterChange('', [], [], [], []);
  };

  return (
    <div className="p-3">
      <div className="mb-3 space-y-1">
        <h3 className="text-default-500 text-small">{messages.caseTitleOrDescription}</h3>
        <Input
          variant="bordered"
          classNames={{
            base: 'max-w-full h-8',
            mainWrapper: 'h-full',
            input: 'text-small',
          }}
          size="sm"
          startContent={<SearchIcon size={18} />}
          type="search"
          value={search}
          onValueChange={setSearch}
          maxLength={100}
        />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="flex-col space-y-1">
          <h3 className="text-default-500 text-small">{messages.status}</h3>
          <Dropdown>
            <DropdownTrigger>
              <Button size="sm" variant="bordered" className="w-32" endContent={<ChevronDown size={16} />}>
                {selectedStatuses === 'all' || selectedStatuses.size === 0
                  ? messages.selectStatus
                  : `${selectedStatuses.size} ${messages.selected}`}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Run Case Status filter"
              selectionMode="multiple"
              selectedKeys={selectedStatuses}
              onSelectionChange={setSelectedStatuses}
            >
              {testRunCaseStatus.map((status, index) => (
                <DropdownItem key={String(index)} textValue={testRunCaseStatusMessages[status.uid]}>
                  <span className="text-sm">{testRunCaseStatusMessages[status.uid]}</span>
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        </div>

        <div className="flex-col space-y-1">
          <h3 className="text-default-500 text-small">{messages.tags}</h3>
          <Dropdown>
            <DropdownTrigger>
              <Button size="sm" variant="bordered" className="w-32" endContent={<ChevronDown size={16} />}>
                {selectedTags === 'all' || selectedTags.size === 0
                  ? messages.selectTags
                  : `${selectedTags.size} ${messages.selected}`}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              className="max-h-[50vh] overflow-y-auto"
              aria-label="Tag filter"
              selectionMode="multiple"
              selectedKeys={selectedTags}
              onSelectionChange={setSelectedTags}
            >
              {tags.map((tag) => (
                <DropdownItem key={tag.id.toString()} textValue={tag.name}>
                  <span className="text-sm">{tag.name}</span>
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        </div>

        <div className="flex-col space-y-1">
          <h3 className="text-default-500 text-small">{messages.priority}</h3>
          <Dropdown>
            <DropdownTrigger>
              <Button size="sm" variant="bordered" className="w-32" endContent={<ChevronDown size={16} />}>
                {selectedPriorities === 'all' || selectedPriorities.size === 0
                  ? messages.selectPriorities
                  : `${selectedPriorities.size} ${messages.selected}`}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Priority filter"
              selectionMode="multiple"
              selectedKeys={selectedPriorities}
              onSelectionChange={setSelectedPriorities}
            >
              {priorities.map((priority, index) => (
                <DropdownItem key={String(index)} textValue={priorityMessages[priority.uid]}>
                  <span className="text-sm">{priorityMessages[priority.uid]}</span>
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        </div>

        <div className="flex-col space-y-1">
          <h3 className="text-default-500 text-small">{messages.type}</h3>
          <Dropdown>
            <DropdownTrigger>
              <Button size="sm" variant="bordered" className="w-32" endContent={<ChevronDown size={16} />}>
                {selectedTypes === 'all' || selectedTypes.size === 0
                  ? messages.selectTypes
                  : `${selectedTypes.size} ${messages.selected}`}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              className="max-h-[50vh] overflow-y-auto"
              aria-label="Type filter"
              selectionMode="multiple"
              selectedKeys={selectedTypes}
              onSelectionChange={setSelectedTypes}
            >
              {testTypes.map((testType, index) => (
                <DropdownItem key={String(index)} textValue={testTypeMessages[testType.uid]}>
                  <span className="text-sm">{testTypeMessages[testType.uid]}</span>
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>

      <div className="flex justify-end">
        <Button className="me-2" size="sm" variant="light" onPress={handleClearFilter}>
          {messages.clearAll}
        </Button>
        <Button size="sm" variant="solid" color="primary" onPress={handleApplyFilter}>
          {messages.apply}
        </Button>
      </div>
    </div>
  );
}
