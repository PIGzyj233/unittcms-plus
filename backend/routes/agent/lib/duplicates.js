import { Op } from 'sequelize';

function normalizeTitle(title) {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

async function findDuplicateWarnings({ Candidate, Case, projectId, folderIds, title }) {
  const normalized = normalizeTitle(title);
  const formalCases = await Case.findAll({ where: { folderId: { [Op.in]: folderIds } } });
  const draftCandidates = await Candidate.findAll({ where: { projectId, status: 'draft' } });

  const exactFormal = formalCases.filter((entry) => normalizeTitle(entry.title) === normalized);
  const exactDraft = draftCandidates.filter((entry) => normalizeTitle(entry.title) === normalized);
  const warnings = [];

  if (exactFormal.length > 0) {
    warnings.push({
      strength: 'strong',
      resourceType: 'case',
      ids: exactFormal.map((entry) => entry.id),
      message: 'Exact title match with formal test case',
    });
  }
  if (exactDraft.length > 0) {
    warnings.push({
      strength: 'strong',
      resourceType: 'candidate',
      ids: exactDraft.map((entry) => entry.id),
      message: 'Exact title match with draft candidate',
    });
  }

  return { blocked: warnings.some((warning) => warning.strength === 'strong'), warnings };
}

export { normalizeTitle, findDuplicateWarnings };
