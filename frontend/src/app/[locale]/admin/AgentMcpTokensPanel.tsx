'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Clipboard, KeyRound, Plus, RefreshCw, Trash2 } from 'lucide-react';

import {
  Button,
  Chip,
  Input,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  addToast,
} from '@/components/heroui';
import { AdminMessages } from '@/types/user';
import { McpTokenRecord, createMcpToken, fetchMcpTokens, revokeMcpToken } from '@/utils/mcpTokenControl';
import { logError } from '@/utils/errorHandler';

type Props = {
  jwt: string;
  messages: AdminMessages;
};

function formatDate(value: string | null, emptyLabel: string) {
  if (!value) return emptyLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return emptyLabel;
  return date.toLocaleString();
}

function statusColor(status: McpTokenRecord['status']) {
  if (status === 'active') return 'success';
  if (status === 'expired') return 'warning';
  return 'danger';
}

export default function AgentMcpTokensPanel({ jwt, messages }: Props) {
  const [tokens, setTokens] = useState<McpTokenRecord[]>([]);
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [plainToken, setPlainToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  const canCreate = name.trim().length > 0 && !isCreating;

  const headerColumns = useMemo(
    () => [
      { name: messages.mcpTokenName, uid: 'name' },
      { name: messages.mcpTokenPrefix, uid: 'tokenPrefix' },
      { name: messages.mcpTokenStatus, uid: 'status' },
      { name: messages.mcpTokenLastUsed, uid: 'lastUsedAt' },
      { name: messages.mcpTokenExpires, uid: 'expiresAt' },
      { name: messages.mcpTokenCreator, uid: 'createdBy' },
      { name: '', uid: 'actions' },
    ],
    [messages]
  );

  async function loadTokens() {
    setIsLoading(true);
    try {
      const data = await fetchMcpTokens(jwt);
      setTokens(data.tokens);
    } catch (error: unknown) {
      logError('Failed to fetch MCP tokens', error);
      addToast({ title: 'Error', color: 'danger', description: messages.mcpTokenLoadError });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (jwt) {
      loadTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jwt]);

  async function handleCreate() {
    if (!canCreate) return;
    setIsCreating(true);
    try {
      const data = await createMcpToken(jwt, {
        name: name.trim(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      setPlainToken(data.token);
      setName('');
      setExpiresAt('');
      setTokens((prevTokens) => [data.record, ...prevTokens]);
      addToast({ title: 'Success', color: 'success', description: messages.mcpTokenCreated });
    } catch (error: unknown) {
      logError('Failed to create MCP token', error);
      addToast({ title: 'Error', color: 'danger', description: messages.mcpTokenCreateError });
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCopy() {
    if (!plainToken) return;
    await navigator.clipboard.writeText(plainToken);
    addToast({ title: 'Success', color: 'success', description: messages.mcpTokenCopied });
  }

  async function handleRevoke(record: McpTokenRecord) {
    setRevokingId(record.id);
    try {
      const data = await revokeMcpToken(jwt, record.id);
      setTokens((prevTokens) => prevTokens.map((token) => (token.id === record.id ? data.record : token)));
      addToast({ title: 'Success', color: 'success', description: messages.mcpTokenRevoked });
    } catch (error: unknown) {
      logError('Failed to revoke MCP token', error);
      addToast({ title: 'Error', color: 'danger', description: messages.mcpTokenRevokeError });
    } finally {
      setRevokingId(null);
    }
  }

  function renderCell(record: McpTokenRecord, columnKey: string) {
    switch (columnKey) {
      case 'name':
        return <span className="font-medium">{record.name}</span>;
      case 'status':
        return (
          <Chip size="sm" color={statusColor(record.status)}>
            {
              messages[
                `mcpTokenStatus${record.status[0].toUpperCase()}${record.status.slice(1)}` as keyof AdminMessages
              ]
            }
          </Chip>
        );
      case 'lastUsedAt':
        return formatDate(record.lastUsedAt, messages.mcpTokenNeverUsed);
      case 'expiresAt':
        return formatDate(record.expiresAt, messages.mcpTokenNoExpiry);
      case 'createdBy':
        return record.createdBy?.username || record.createdBy?.email || messages.mcpTokenUnknownCreator;
      case 'actions':
        return (
          <Button
            isIconOnly
            aria-label={messages.mcpTokenRevoke}
            title={messages.mcpTokenRevoke}
            size="sm"
            color="danger"
            variant="light"
            isDisabled={record.status === 'revoked'}
            isLoading={revokingId === record.id}
            onPress={() => handleRevoke(record)}
          >
            <Trash2 size={16} />
          </Button>
        );
      default:
        return record[columnKey as keyof McpTokenRecord] as string;
    }
  }

  return (
    <section className="mt-10 w-full">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-2">
          <KeyRound size={20} />
          <h3 className="font-bold">{messages.agentMcp}</h3>
        </div>
        <Button
          isIconOnly
          aria-label={messages.mcpTokenRefresh}
          title={messages.mcpTokenRefresh}
          size="sm"
          variant="light"
          isLoading={isLoading}
          onPress={loadTokens}
        >
          <RefreshCw size={16} />
        </Button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]">
        <Input
          label={messages.mcpTokenName}
          value={name}
          onValueChange={setName}
          placeholder={messages.mcpTokenNamePlaceholder}
          maxLength={120}
        />
        <Input
          label={messages.mcpTokenExpires}
          type="datetime-local"
          value={expiresAt}
          onChange={(event) => setExpiresAt(event.target.value)}
        />
        <Button
          color="primary"
          isDisabled={!canCreate}
          isLoading={isCreating}
          startContent={<Plus size={16} />}
          onPress={handleCreate}
        >
          {messages.mcpTokenCreate}
        </Button>
      </div>

      {plainToken && (
        <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Check size={16} />
            <span>{messages.mcpTokenPlaintextTitle}</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 overflow-x-auto rounded bg-background px-3 py-2 text-xs">{plainToken}</code>
            <Button variant="bordered" startContent={<Clipboard size={16} />} onPress={handleCopy}>
              {messages.mcpTokenCopy}
            </Button>
            <Button variant="light" onPress={() => setPlainToken('')}>
              {messages.close}
            </Button>
          </div>
        </div>
      )}

      <Table isCompact aria-label="Agent MCP token table">
        <TableHeader columns={headerColumns}>
          {(column) => <TableColumn key={column.uid}>{column.name}</TableColumn>}
        </TableHeader>
        <TableBody emptyContent={messages.mcpTokenNoTokens} items={tokens}>
          {(item) => (
            <TableRow key={item.id}>
              {(columnKey) => <TableCell>{renderCell(item, columnKey as string)}</TableCell>}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  );
}
