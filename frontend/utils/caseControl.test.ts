// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { exportCases, fetchCases, importCases } from './caseControl';

describe('caseControl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes Include Subfolders narrowing when fetching Test Cases', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchCases('token', 7, undefined, undefined, undefined, undefined, false);

    const url = new URL(fetchMock.mock.calls[0][0] as string, 'http://localhost');
    expect(url.pathname).toMatch(/\/cases$/);
    expect(url.searchParams.get('folderId')).toBe('7');
    expect(url.searchParams.get('includeSubfolders')).toBe('false');
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'GET' }));
  });

  it('exports the current Folder Scope and filter state', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'attachment; filename="cases.csv"' },
      blob: async () => new Blob(['csv']),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});

    await exportCases('token', 7, 'csv', {
      includeSubfolders: false,
      search: 'login & checkout=1',
      priority: [1],
      caseTypes: [4],
      tag: [3],
    });

    const url = new URL(fetchMock.mock.calls[0][0] as string, 'http://localhost');
    expect(url.pathname).toMatch(/\/cases\/download$/);
    expect(url.searchParams.get('folderId')).toBe('7');
    expect(url.searchParams.get('type')).toBe('csv');
    expect(url.searchParams.get('includeSubfolders')).toBe('false');
    expect(url.searchParams.get('search')).toBe('login & checkout=1');
    expect(url.searchParams.get('priority')).toBe('1');
    expect(url.searchParams.get('caseType')).toBe('4');
    expect(url.searchParams.get('tag')).toBe('3');
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'GET' }));
  });

  it('imports ordinary Test Cases into the requested current folder only', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => [],
    });
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['xlsx'], 'cases.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    await importCases('token', 7, file);

    const url = new URL(fetchMock.mock.calls[0][0] as string, 'http://localhost');
    expect(url.pathname).toMatch(/\/cases\/import$/);
    expect(url.searchParams.get('folderId')).toBe('7');
    expect(url.searchParams.has('includeSubfolders')).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
        body: expect.any(FormData),
      })
    );
  });
});
