import crypto from 'crypto';

function assertJsonCompatible(value, path) {
  if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') {
    throw new Error(`${path} must be JSON-compatible`);
  }

  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error(`${path} must be JSON-compatible`);
  }
}

function isPlainObject(value) {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function stringifyValue(value, path, seen) {
  if (value === undefined) {
    return undefined;
  }

  assertJsonCompatible(value, path);

  if (value && typeof value === 'object' && typeof value.toJSON === 'function') {
    return stringifyValue(value.toJSON(), path, seen);
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new Error(`${path} must be JSON-compatible`);
    }

    seen.add(value);
    const result = `[${Array.from({ length: value.length }, (_, index) => {
      const item = stringifyValue(value[index], `${path}[${index}]`, seen);
      return item === undefined ? 'null' : item;
    }).join(',')}]`;
    seen.delete(value);
    return result;
  }

  if (value && typeof value === 'object') {
    if (!isPlainObject(value)) {
      throw new Error(`${path} must be JSON-compatible`);
    }

    if (seen.has(value)) {
      throw new Error(`${path} must be JSON-compatible`);
    }

    seen.add(value);
    const result = `{${Object.keys(value)
      .sort()
      .flatMap((key) => {
        const item = stringifyValue(value[key], `${path}.${key}`, seen);
        return item === undefined ? [] : `${JSON.stringify(key)}:${item}`;
      })
      .join(',')}}`;
    seen.delete(value);
    return result;
  }

  return JSON.stringify(value);
}

function stableStringify(value) {
  const result = stringifyValue(value, 'payload', new WeakSet());
  if (result === undefined) {
    throw new Error('payload must be JSON-compatible');
  }
  return result;
}

function payloadHash(value) {
  return `sha256:${crypto.createHash('sha256').update(stableStringify(value)).digest('hex')}`;
}

export { stableStringify, payloadHash };
