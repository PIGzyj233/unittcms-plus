import { describe, expect, it } from 'vitest';

import { defaultRunCaseStatus, parseCaseEnums, parseRunState } from './enums.js';
import { sendBadRequest, sendConflict, sendCreated, sendOk } from './http.js';
import { stableStringify, payloadHash } from './payloadHash.js';
import { requireArray, validateObject } from './schema.js';

function fakeResponse() {
  const calls = [];
  return {
    calls,
    status(code) {
      calls.push(['status', code]);
      return this;
    },
    json(body) {
      calls.push(['json', body]);
      return this;
    },
  };
}

describe('agent shared libraries', () => {
  it('rejects unknown fields', () => {
    expect(() =>
      validateObject({ title: 'A', unknown: true }, { required: ['title'], optional: [] }, 'candidate')
    ).toThrow('candidate.unknown is not allowed');
  });

  it('rejects missing required fields', () => {
    expect(() => validateObject({ title: '' }, { required: ['title'], optional: [] }, 'candidate')).toThrow(
      'candidate.title is required'
    );
  });

  it('rejects non-object values', () => {
    expect(() => validateObject([], { required: [], optional: [] }, 'candidate')).toThrow(
      'candidate must be an object'
    );
    expect(() => validateObject(null, { required: [], optional: [] }, 'candidate')).toThrow(
      'candidate must be an object'
    );
  });

  it('requires arrays', () => {
    const value = ['case'];

    expect(requireArray(value, 'cases')).toBe(value);
    expect(() => requireArray({ 0: 'case' }, 'cases')).toThrow('cases must be an array');
  });

  it('maps case enum UIDs to existing numeric database values', () => {
    expect(
      parseCaseEnums({
        priority: 'high',
        type: 'functional',
        automationStatus: 'automation-not-required',
        template: 'step',
      })
    ).toEqual({ priority: 1, type: 4, automationStatus: 1, template: 1 });
  });

  it('rejects unknown enum UIDs', () => {
    expect(() =>
      parseCaseEnums({
        priority: 'urgent',
        type: 'functional',
        automationStatus: 'automation-not-required',
        template: 'step',
      })
    ).toThrow('priority must be one of: critical, high, medium, low');
  });

  it('maps run enum helpers to existing numeric database values', () => {
    expect(parseRunState('done')).toBe(4);
    expect(defaultRunCaseStatus()).toBe(0);
  });

  it('creates stable hashes regardless of object key order', () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    expect(payloadHash({ b: 2, a: 1 })).toBe(payloadHash({ a: 1, b: 2 }));
    expect(payloadHash({ a: 1 })).toMatch(/^sha256:/);
  });

  it('canonicalizes JSON payload values with predictable JSON semantics', () => {
    const date = new Date('2026-06-05T10:20:30.000Z');
    const withToJSON = {
      toJSON() {
        return { b: 2, a: 1 };
      },
    };
    const sparseArray = [undefined];
    sparseArray[2] = { skip: undefined, keep: true };

    expect(stableStringify({ date })).toBe('{"date":"2026-06-05T10:20:30.000Z"}');
    expect(stableStringify(withToJSON)).toBe('{"a":1,"b":2}');
    expect(stableStringify({ keep: true, skip: undefined })).toBe('{"keep":true}');
    expect(stableStringify(sparseArray)).toBe('[null,null,{"keep":true}]');
    expect(() => stableStringify(undefined)).toThrow('payload must be JSON-compatible');
    expect(() => stableStringify({ callback: () => {} })).toThrow('payload.callback must be JSON-compatible');
  });

  it('sends consistent HTTP JSON responses', () => {
    const ok = fakeResponse();
    const created = fakeResponse();
    const conflict = fakeResponse();
    const badRequest = fakeResponse();

    expect(sendOk(ok, { id: 1 })).toBe(ok);
    expect(sendCreated(created, { id: 1 })).toBe(created);
    expect(sendConflict(conflict, 'Already exists', { error: 'Wrong message', field: 'title' })).toBe(conflict);
    expect(sendBadRequest(badRequest, 'Invalid input', { error: 'Wrong message', field: 'title' })).toBe(badRequest);

    expect(ok.calls).toEqual([
      ['status', 200],
      ['json', { id: 1 }],
    ]);
    expect(created.calls).toEqual([
      ['status', 201],
      ['json', { id: 1 }],
    ]);
    expect(conflict.calls).toEqual([
      ['status', 409],
      ['json', { error: 'Already exists', field: 'title' }],
    ]);
    expect(badRequest.calls).toEqual([
      ['status', 400],
      ['json', { error: 'Invalid input', field: 'title' }],
    ]);
  });
});
