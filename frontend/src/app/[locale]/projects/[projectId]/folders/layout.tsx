import { use } from "react";
import { useTranslations } from 'next-intl';
import FoldersPane from './FoldersPane';
import ResizablePanes from '@/components/ResizablePane';

export default function FoldersLayout(
  props: {
    children: React.ReactNode;
    params: Promise<{ projectId: string; locale: string }>;
  }
) {
  const params = use(props.params);

  const {
    children
  } = props;

  const t = useTranslations('Folders');
  const messages = {
    folder: t('folder'),
    newFolder: t('new_folder'),
    editFolder: t('edit_folder'),
    deleteFolder: t('delete_folder'),
    folderName: t('folder_name'),
    folderDetail: t('folder_detail'),
    close: t('close'),
    create: t('create'),
    update: t('update'),
    pleaseEnter: t('please_enter'),
    delete: t('delete'),
    areYouSure: t('are_you_sure'),
  };

  return (
    <ResizablePanes
      minLeftWidth={15}
      minRightWidth={40}
      defaultLeftWidth={20}
      leftPane={<FoldersPane projectId={params.projectId} messages={messages} locale={params.locale} />}
      rightPane={children}
    />
  );
}
