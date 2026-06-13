import { ChevronDown, ChevronRight, Folder, FolderOpen, Plus } from 'lucide-react';
import { NodeApi } from 'react-arborist';
import { useContext } from 'react';
import { useSearchParams } from 'next/navigation';
import FolderEditMenu from './FolderEditMenu';
import { Button } from '@/components/heroui';

import { FolderType, FoldersMessages, TreeNodeData } from '@/types/folder';
import { useRouter } from '@/src/i18n/routing';
import { TokenContext } from '@/utils/TokenProvider';
import TreeItem from '@/components/TreeItem';

interface FolderItemProps {
  node: NodeApi<TreeNodeData>;
  style: React.CSSProperties;
  projectId: string;
  selectedFolder: FolderType | null;
  locale: string;
  messages: FoldersMessages;
  openDialogForCreate: (folderId: number | null) => void;
  onEditClick: (folder: FolderType) => void;
  onDeleteClick: (folderId: number) => void;
}

export default function FolderItem({
  node,
  style,
  projectId,
  selectedFolder,
  locale,
  messages,
  openDialogForCreate,
  onEditClick,
  onDeleteClick,
}: FolderItemProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const context = useContext(TokenContext);
  const isSelected = selectedFolder && node.data.folderData.id === selectedFolder.id;
  const caseCount = node.data.folderData.caseCount;
  const directCaseCount = node.data.folderData.directCaseCount;
  const hasChildren = Boolean(node.data.children && node.data.children.length > 0);
  const isOpenParent = hasChildren && node.isOpen;
  const FolderIcon = isOpenParent ? FolderOpen : Folder;
  const folderIconProps = isOpenParent
    ? { color: '#E7B23D', fill: '#F7C24E', strokeWidth: 1.8 }
    : { color: '#E7B23D', fill: '#F7C24E', strokeWidth: 1.8 };
  const directCountTitle =
    typeof caseCount === 'number' && typeof directCaseCount === 'number' && directCaseCount < caseCount
      ? `${directCaseCount} directly placed`
      : undefined;

  const toggleButton = hasChildren ? (
    <Button size="sm" className="bg-transparent rounded-full h-6 w-6 min-w-4" isIconOnly onPress={() => node.toggle()}>
      {node.isOpen ? <ChevronDown size={20} color="#F7C24E" /> : <ChevronRight size={20} color="#F7C24E" />}
    </Button>
  ) : null;

  const actions = (
    <>
      {typeof caseCount === 'number' && (
        <span
          className="mr-1 rounded-full bg-default-100 px-2 py-0.5 text-xs text-default-600"
          title={directCountTitle}
          aria-label={`Folder Scope Count ${caseCount}`}
        >
          {caseCount}
        </span>
      )}
      <Button
        size="sm"
        isIconOnly
        className="bg-transparent rounded-full"
        isDisabled={!context.isProjectDeveloper(Number(projectId))}
        onPress={() => openDialogForCreate(node.data.folderData.id)}
      >
        <Plus size={16} />
      </Button>
      <FolderEditMenu
        folder={node.data.folderData}
        isDisabled={!context.isProjectDeveloper(Number(projectId))}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
        messages={messages}
      />
    </>
  );

  const handleClick = () => {
    const currentParams = new URLSearchParams(searchParams.toString());
    const queryString = currentParams.toString();
    const url = `/projects/${projectId}/folders/${node.data.folderData.id}/cases${queryString ? `?${queryString}` : ''}`;
    router.push(url, { locale });
  };

  return (
    <TreeItem
      style={style}
      isSelected={isSelected}
      onClick={() => handleClick()}
      toggleButton={toggleButton}
      icon={<FolderIcon size={20} className="flex-shrink-0" {...folderIconProps} />}
      label={node.data.name}
      actions={actions}
    />
  );
}
