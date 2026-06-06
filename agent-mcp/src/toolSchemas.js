import { z } from 'zod';

const positiveInteger = z.number().int().positive();
const stringOrNumber = z.union([z.string(), z.number()]);
const optionalText = z.string().optional();
const idempotencyKey = z.string().min(1).optional();
const operationToken = z.string().min(1);
const emptyInputSchema = z.object({}).strict();

const stepInputSchema = z
  .object({
    step: z.string(),
    result: z.string(),
  })
  .strict();

const projectInputSchema = z
  .object({
    projectId: positiveInteger,
  })
  .strict();

const searchCasesInputSchema = projectInputSchema
  .extend({
    folderId: positiveInteger.optional(),
    priority: z.array(stringOrNumber).optional(),
    type: z.array(stringOrNumber).optional(),
    tagIds: z.array(positiveInteger).optional(),
    includedInRunId: positiveInteger.optional(),
    keyword: z.string().max(100).optional(),
  })
  .strict();

const getCaseInputSchema = projectInputSchema
  .extend({
    caseId: positiveInteger,
  })
  .strict();

const folderPathInputSchema = projectInputSchema
  .extend({
    path: z.array(z.string()).min(1),
    detail: z.string().optional().nullable(),
    idempotencyKey,
  })
  .strict();

const folderPathCommitInputSchema = folderPathInputSchema
  .extend({
    operationToken,
  })
  .strict();

const candidateInputSchema = z
  .object({
    title: z.string(),
    folderId: positiveInteger,
    priority: stringOrNumber,
    type: stringOrNumber,
    automationStatus: stringOrNumber,
    template: stringOrNumber,
    description: optionalText,
    preConditions: optionalText,
    expectedResults: optionalText,
    steps: z.array(stepInputSchema).optional(),
    tagIds: z.array(positiveInteger).optional(),
    suggestedTags: z.array(z.string()).optional(),
    source: optionalText,
    rationale: optionalText,
    allowStrongDuplicate: z.boolean().optional(),
  })
  .strict();

const createCandidateInputSchema = projectInputSchema.merge(candidateInputSchema).strict();

const listCandidateInputSchema = projectInputSchema
  .extend({
    status: z.string().optional(),
  })
  .strict();

const acceptCandidatesInputSchema = projectInputSchema
  .extend({
    candidateIds: z.array(positiveInteger),
    createMissingTags: z.boolean().optional(),
    allowPartial: z.boolean().optional(),
    idempotencyKey,
  })
  .strict();

const acceptCandidatesCommitInputSchema = acceptCandidatesInputSchema
  .extend({
    operationToken,
  })
  .strict();

const runInputSchema = projectInputSchema
  .extend({
    name: z.string(),
    configurations: z.string().optional(),
    description: z.string().optional(),
    state: stringOrNumber.optional(),
    caseIds: z.array(positiveInteger),
    allowPartial: z.boolean().optional(),
    idempotencyKey,
  })
  .strict();

const runCommitInputSchema = runInputSchema
  .extend({
    operationToken,
  })
  .strict();

const addCasesToRunInputSchema = projectInputSchema
  .extend({
    runId: positiveInteger,
    caseIds: z.array(positiveInteger),
    allowPartial: z.boolean().optional(),
    idempotencyKey,
  })
  .strict();

const addCasesToRunCommitInputSchema = addCasesToRunInputSchema
  .extend({
    operationToken,
  })
  .strict();

export {
  acceptCandidatesCommitInputSchema,
  acceptCandidatesInputSchema,
  addCasesToRunCommitInputSchema,
  addCasesToRunInputSchema,
  candidateInputSchema,
  createCandidateInputSchema,
  emptyInputSchema,
  folderPathCommitInputSchema,
  folderPathInputSchema,
  getCaseInputSchema,
  listCandidateInputSchema,
  projectInputSchema,
  runCommitInputSchema,
  runInputSchema,
  searchCasesInputSchema,
};
