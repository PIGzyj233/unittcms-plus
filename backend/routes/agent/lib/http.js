function sendOk(res, body) {
  return res.status(200).json(body);
}

function sendCreated(res, body) {
  return res.status(201).json(body);
}

function sendConflict(res, message, details = {}) {
  return res.status(409).json({ ...details, error: message });
}

function sendBadRequest(res, message, details = {}) {
  return res.status(400).json({ ...details, error: message });
}

export { sendOk, sendCreated, sendConflict, sendBadRequest };
