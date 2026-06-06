function validateObject(value, shape, label) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error(`${label} must be an object`);
  }

  const allowed = new Set([...(shape.required || []), ...(shape.optional || [])]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${label}.${key} is not allowed`);
    }
  }

  for (const key of shape.required || []) {
    if (value[key] === undefined || value[key] === null || value[key] === '') {
      throw new Error(`${label}.${key} is required`);
    }
  }

  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

export { validateObject, requireArray };
