'use client';
import { useState, useEffect, useContext, useRef } from 'react';
import { Plus } from 'lucide-react';
import { Tree } from 'react-arborist';
import FolderDialog from './FolderDialog';
import FolderItem from './FolderItem';
import { fetchFolders, createFolder, updateFolder, deleteFolder } from './foldersControl';
import { Button } from '@/components/heroui';
import { usePathname, useRouter } from '@/src/i18n/routing';
import { TokenContext } from '@/utils/TokenProvider';
import useGetCurrentIds from '@/utils/useGetCurrentIds';
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog';
import { FolderType, FoldersMessages, TreeNodeData } from '@/types/folder';
import { logError } from '@/utils/errorHandler';
import { buildFolderTree } from '@/utils/buildFolderTree';
import { emitMoveEvent } from '@/utils/testCaseMoveEvent';

type Props = {
  projectId: string;
  messages: FoldersMessages;
  locale: string;
};

function useElementHeight<T extends HTMLElement>() {
  const elementRef = useRef<T>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    const updateHeight = (nextHeight: number) => {
      const normalizedHeight = Math.max(0, Math.floor(nextHeight));
      setHeight((currentHeight) => (currentHeight === normalizedHeight ? currentHeight : normalizedHeight));
    };

    updateHeight(element.getBoundingClientRect().height);

    if (typeof ResizeObserver === 'undefined') {
      const handleResize = () => updateHeight(element.getBoundingClientRect().height);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        updateHeight(entry.contentRect.height);
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [elementRef, height] as const;
}

export default function FoldersPane({ projectId, messages, locale }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const context = useContext(TokenContext);
  const [treeData, setTreeData] = useState<TreeNodeData[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<FolderType | null>(null);
  const [treeViewportRef, treeHeight] = useElementHeight<HTMLDivElement>();
  const { folderId } = useGetCurrentIds();
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null);
  const [parentFolderId, setParentFolderId] = useState<number | null>(null);

  useEffect(() => {
    async function fetchDataEffect() {
      if (!context.isSignedIn()) {
        return;
      }
      try {
        const fetchedFolders: FolderType[] = await fetchFolders(context.token.access_token, Number(projectId));
        const tree = buildFolderTree(fetchedFolders);
        setTreeData(tree);

        if (tree.length === 0) {
          return;
        }

        const selectedFolderFromUrl = fetchedFolders.find((folder) => folder.id === folderId);
        setSelectedFolder(selectedFolderFromUrl ? selectedFolderFromUrl : null);

        if (pathname === `/projects/${projectId}/folders`) {
          const smallestFolderId = Math.min(...fetchedFolders.map((folder) => folder.id));
          router.push(`/projects/${projectId}/folders/${smallestFolderId}/cases`, { locale });
        }
      } catch (error: unknown) {
        logError('Error fetching folders:', error);
      }
    }

    fetchDataEffect();
  }, [context, folderId, locale, pathname, projectId, router]);

  const openDialogForCreate = (folderId: number | null = null) => {
    setParentFolderId(folderId);
    setIsFolderDialogOpen(true);
    setEditingFolder(null);
  };

  const closeDialog = () => {
    setIsFolderDialogOpen(false);
    setEditingFolder(null);
    setParentFolderId(null);
  };

  const onSubmit = async (name: string, detail: string) => {
    if (editingFolder) {
      await updateFolder(context.token.access_token, editingFolder.id, name, detail, projectId, parentFolderId);
    } else {
      await createFolder(context.token.access_token, name, detail, projectId, parentFolderId);
    }
    const fetchedFolders: FolderType[] = await fetchFolders(context.token.access_token, Number(projectId));
    const tree = buildFolderTree(fetchedFolders);
    setTreeData(tree);
    closeDialog();
  };

  const onEditClick = (folder: FolderType) => {
    setEditingFolder(folder);
    setParentFolderId(folder.parentFolderId);
    setIsFolderDialogOpen(true);
  };

  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [deleteFolderId, setDeleteFolderId] = useState<number | null>(null);

  const closeDeleteConfirmDialog = () => {
    setIsDeleteConfirmDialogOpen(false);
    setDeleteFolderId(null);
  };

  const onDeleteClick = (deleteFolderId: number) => {
    setDeleteFolderId(deleteFolderId);
    setIsDeleteConfirmDialogOpen(true);
  };

  const onConfirm = async () => {
    if (deleteFolderId) {
      await deleteFolder(context.token.access_token, deleteFolderId);
      const fetchedFolders: FolderType[] = await fetchFolders(context.token.access_token, Number(projectId));
      const tree = buildFolderTree(fetchedFolders);
      setTreeData(tree);
      router.push(`/projects/${projectId}/folders`, { locale });
      closeDeleteConfirmDialog();
    }
  };

  // **************************************************************************
  // move test case
  // **************************************************************************
  const handleDragOver = (e: React.DragEvent) => {
    e.stopPropagation();
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropFolderId: string) => {
    e.stopPropagation();
    const ids = JSON.parse(e.dataTransfer.getData('application/json'));
    emitMoveEvent(ids, Number(dropFolderId));
  };

  return (
    <>
      <div className="flex h-full min-h-[calc(100vh-64px)] flex-col">
        <div className="shrink-0 border-b border-black/10 bg-white/70 p-2 dark:border-white/10 dark:bg-neutral-950">
          <Button
            startContent={<Plus size={16} />}
            size="sm"
            variant="bordered"
            className="w-full justify-center"
            isDisabled={!context.isProjectDeveloper(Number(projectId))}
            onPress={() => openDialogForCreate()}
          >
            {messages.newFolder}
          </Button>
        </div>

        <div ref={treeViewportRef} data-testid="folder-tree-viewport" className="min-h-0 flex-1 overflow-hidden">
          {treeData.length > 0 && treeHeight > 0 && (
            <Tree
              data={treeData}
              className="w-full"
              indent={16}
              rowHeight={42}
              overscanCount={5}
              paddingTop={20}
              paddingBottom={20}
              padding={20}
              width="100%"
              height={treeHeight}
              openByDefault={false}
              disableDrop={true}
              disableDrag={true}
            >
              {(props) => (
                <div onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, props.node.id)}>
                  <FolderItem
                    {...props}
                    projectId={projectId}
                    selectedFolder={selectedFolder}
                    locale={locale}
                    messages={messages}
                    openDialogForCreate={openDialogForCreate}
                    onEditClick={onEditClick}
                    onDeleteClick={onDeleteClick}
                  />
                </div>
              )}
            </Tree>
          )}
        </div>
      </div>

      <FolderDialog
        isOpen={isFolderDialogOpen}
        editingFolder={editingFolder}
        onCancel={closeDialog}
        onSubmit={onSubmit}
        messages={messages}
      />

      <DeleteConfirmDialog
        isOpen={isDeleteConfirmDialogOpen}
        onCancel={closeDeleteConfirmDialog}
        onConfirm={onConfirm}
        closeText={messages.close}
        confirmText={messages.areYouSure}
        deleteText={messages.delete}
      />
    </>
  );
}
