import { Trash, ArrowDownToLine, ArrowUpFromLine, File } from 'lucide-react';
import Image from 'next/image';
import { ChangeEvent, DragEvent } from 'react';
import { isImage } from './isImage';
import { Button, Tooltip, Card, CardBody } from '@/components/heroui';
import { AttachmentType, CaseMessages } from '@/types/case';
import Config from '@/config/config';

const apiServer = Config.apiServer;

type Props = {
  isDisabled: boolean;
  attachments: AttachmentType[];
  onAttachmentDownload: (attachmentId: number, downloadFileName: string) => void;
  onAttachmentDelete: (attachmentId: number) => void;
  onFilesDrop: (event: DragEvent<HTMLElement>) => void;
  onFilesInput: (event: ChangeEvent) => void;
  messages: CaseMessages;
};

export default function CaseAttachmentsEditor({
  isDisabled = false,
  attachments = [],
  onAttachmentDownload,
  onAttachmentDelete,
  onFilesDrop,
  onFilesInput,
  messages,
}: Props) {
  const images: AttachmentType[] = [];
  const others: AttachmentType[] = [];

  attachments.forEach((attachment) => {
    if (isImage(attachment)) {
      images.push(attachment);
    } else {
      others.push(attachment);
    }
  });
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {images.map((image, index) => (
          <Card
            key={index}
            radius="sm"
            className="overflow-hidden border border-black/10 shadow-sm dark:border-white/10"
          >
            <CardBody className="gap-3 p-3">
              <Image
                alt={image.title}
                src={`${apiServer}/uploads/${image.filename}`}
                width={160}
                height={160}
                className="aspect-video h-auto w-full rounded-md object-cover"
                unoptimized
              />
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-medium">{image.title}</p>
                <Tooltip content={messages.delete}>
                  <Button
                    isIconOnly
                    size="sm"
                    isDisabled={isDisabled}
                    variant="light"
                    className="rounded-full"
                    onPress={() => onAttachmentDelete(image.id)}
                  >
                    <Trash size={16} />
                  </Button>
                </Tooltip>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {others.length > 0 && (
        <div className="mt-3 grid gap-2">
          {others.map((file, index) => (
            <Card key={index} radius="sm" className="border border-black/10 shadow-sm dark:border-white/10">
              <CardBody className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <File size={16} className="shrink-0 text-neutral-500" />
                    <p className="min-w-0 truncate text-sm font-medium">{file.title}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Tooltip content={messages.download}>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        className="rounded-full"
                        onPress={() => onAttachmentDownload(file.id, file.title)}
                      >
                        <ArrowDownToLine size={16} />
                      </Button>
                    </Tooltip>
                    <Tooltip content={messages.delete}>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        className="rounded-full"
                        onPress={() => onAttachmentDelete(file.id)}
                      >
                        <Trash size={16} />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <div
        className="mt-4 flex w-full items-center justify-center"
        onDrop={(event) => {
          if (isDisabled) {
            return;
          }
          onFilesDrop(event);
        }}
        onDragOver={(event) => event.preventDefault()}
      >
        <label
          htmlFor="dropzone-file"
          className={`flex h-32 w-full flex-col items-center justify-center rounded-lg border border-dashed border-black/15 bg-neutral-50/80 transition-colors hover:bg-neutral-100 dark:border-white/15 dark:bg-neutral-900/70 dark:hover:bg-neutral-800 ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        >
          <div className="flex flex-col items-center justify-center px-4 py-5 text-center">
            <ArrowUpFromLine size={22} className="mb-2 text-neutral-500" />
            <p className="mb-1 text-sm text-neutral-600 dark:text-neutral-300">
              <span className="font-semibold">{messages.clickToUpload}</span>
              <span>{messages.orDragAndDrop}</span>
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{messages.maxFileSize}: 50 MB</p>
          </div>
          <input
            id="dropzone-file"
            type="file"
            className="hidden"
            disabled={isDisabled}
            onChange={(e) => onFilesInput(e)}
            multiple
          />
        </label>
      </div>
    </>
  );
}
