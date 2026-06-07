import { getFilenameFromContentDisposition } from '@/utils/request';
import { logError } from '@/utils/errorHandler';
import Config from '@/config/config';
const apiServer = Config.apiServer;
import { CaseType } from '@/types/case';

async function fetchCase(jwt: string, caseId: number) {
  const url = `${apiServer}/cases/${caseId}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: unknown) {
    logError('Error fetching data', error);
  }
}

async function fetchCases(
  jwt: string,
  folderId: number,
  search?: string,
  priority?: number[],
  type?: number[],
  tag?: number[],
  includeSubfolders = true
) {
  const queryParams = new URLSearchParams();
  queryParams.set('folderId', String(folderId));

  if (!includeSubfolders) {
    queryParams.set('includeSubfolders', 'false');
  }

  if (search) {
    queryParams.set('search', search);
  }

  if (priority && priority.length > 0) {
    queryParams.set('priority', priority.join(','));
  }

  if (type && type.length > 0) {
    queryParams.set('type', type.join(','));
  }

  if (tag && tag.length > 0) {
    queryParams.set('tag', tag.join(','));
  }

  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';

  const url = `${apiServer}/cases${query}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data || [];
  } catch (error: unknown) {
    logError('Error fetching data', error);
    return [];
  }
}

async function createCase(jwt: string, folderId: string, title: string, description: string) {
  const newCase = {
    title: title,
    state: 0,
    priority: 2,
    type: 0,
    automationStatus: 0,
    description: description,
    template: 0,
    preConditions: '',
    expectedResults: '',
  };

  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(newCase),
  };

  const url = `${apiServer}/cases?folderId=${folderId}`;

  try {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error: unknown) {
    logError('Error creating case', error);
  }
}

async function updateCase(jwt: string, updateCaseData: CaseType) {
  const fetchOptions = {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(updateCaseData),
  };

  const url = `${apiServer}/cases/${updateCaseData.id}`;
  try {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error: unknown) {
    logError('Error updating project', error);
  }
}

export async function moveCases(jwt: string, moveCaseIds: number[], targetFolderId: number, projectId: number) {
  const fetchOptions = {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ caseIds: moveCaseIds, targetFolderId }),
  };
  const url = `${apiServer}/cases/move?projectId=${projectId}`;
  try {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error: unknown) {
    logError('Error updating project', error);
  }
}

async function deleteCases(jwt: string, deleteCaseIds: number[], projectId: number) {
  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ caseIds: deleteCaseIds }),
  };

  const url = `${apiServer}/cases/bulkdelete?projectId=${projectId}`;

  try {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
  } catch (error: unknown) {
    logError('Error deleting cases', error);
  }
}

async function cloneCases(jwt: string, moveCaseIds: number[], targetFolderId: number, projectId: number) {
  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ caseIds: moveCaseIds, targetFolderId }),
  };
  const url = `${apiServer}/cases/clone?projectId=${projectId}`;
  try {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error: unknown) {
    logError('Error cloning project', error);
  }
}

type ExportCasesOptions = {
  search?: string;
  priority?: number[];
  caseTypes?: number[];
  tag?: number[];
  includeSubfolders?: boolean;
};

async function exportCases(jwt: string, folderId: number, downloadType: string, options: ExportCasesOptions = {}) {
  if (downloadType !== 'json' && downloadType !== 'csv') {
    console.error('export type error. type:', downloadType);
    return;
  }
  const queryParams = new URLSearchParams();
  queryParams.set('folderId', String(folderId));
  queryParams.set('type', downloadType);
  if (options.includeSubfolders === false) {
    queryParams.set('includeSubfolders', 'false');
  }
  if (options.search) {
    queryParams.set('search', options.search);
  }
  if (options.priority && options.priority.length > 0) {
    queryParams.set('priority', options.priority.join(','));
  }
  if (options.caseTypes && options.caseTypes.length > 0) {
    queryParams.set('caseType', options.caseTypes.join(','));
  }
  if (options.tag && options.tag.length > 0) {
    queryParams.set('tag', options.tag.join(','));
  }
  const url = `${apiServer}/cases/download?${queryParams.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const disposition = response.headers.get('content-disposition');
    const filename = getFilenameFromContentDisposition(disposition) ?? `cases.${downloadType}`;

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(objectUrl);
  } catch (error: unknown) {
    logError('Error fetching data', error);
  }
}

async function importCases(jwt: string, folderId: number, file: File) {
  const url = `${apiServer}/cases/import?folderId=${folderId}`;
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
      body: formData,
    });

    const data = await response.json();
    return data;
  } catch (error: unknown) {
    logError('Error importing data', error);
  }
}

export { fetchCase, fetchCases, updateCase, createCase, deleteCases, cloneCases, exportCases, importCases };
