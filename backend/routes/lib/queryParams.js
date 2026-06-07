function createBadRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function singleQueryValue(value, label) {
  if (Array.isArray(value)) {
    throw createBadRequest(`${label} must be provided once`);
  }
  return value;
}

function parseOptionalBooleanQuery(value, label, defaultValue = true) {
  if (value === undefined) return defaultValue;

  const singleValue = singleQueryValue(value, label);
  if (singleValue === 'true') return true;
  if (singleValue === 'false') return false;

  throw createBadRequest(`${label} must be true or false`);
}

export { createBadRequest, parseOptionalBooleanQuery, singleQueryValue };
