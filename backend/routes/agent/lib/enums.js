import {
  automationStatus,
  priorities,
  templates,
  testRunCaseStatus,
  testRunStatus,
  testTypes,
} from '../../../config/enums.js';

function indexForUid(values, uid, field) {
  const index = values.findIndex((value) => value === uid);
  if (index === -1) {
    throw new Error(`${field} must be one of: ${values.join(', ')}`);
  }
  return index;
}

function parseCaseEnums(input) {
  return {
    priority: indexForUid(priorities, input.priority, 'priority'),
    type: indexForUid(testTypes, input.type, 'type'),
    automationStatus: indexForUid(automationStatus, input.automationStatus, 'automationStatus'),
    template: indexForUid(templates, input.template, 'template'),
  };
}

function parseRunState(uid) {
  return indexForUid(testRunStatus, uid, 'state');
}

function defaultRunCaseStatus() {
  return indexForUid(testRunCaseStatus, 'untested', 'runCaseStatus');
}

export { parseCaseEnums, parseRunState, defaultRunCaseStatus };
