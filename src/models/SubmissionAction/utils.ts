import { v4 as uuidv4 } from 'uuid';
import assertUnreachable from '../../util/assertUnreachable';
import * as SubmissionAction from './types';

export const ACTION_TYPES: readonly SubmissionAction.ActionType[] =
  Object.values(SubmissionAction.ActionType);

/**
 * Create a new empty SubmissionAction
 */
export function create(
  values: Omit<SubmissionAction.T, 'id' | 'config' | 'fieldMappings'> & {
    type: SubmissionAction.ActionType;
  },
): SubmissionAction.CreateT {
  return {
    order: values.order,
    interviewId: values.interviewId,
    fieldMappings: new Map(),
    tempId: uuidv4(),
    config: {
      type: values.type,
      payload: {},
    },
  };
}

export function actionTypeToDisplayName(
  actionType: SubmissionAction.ActionType,
): string {
  switch (actionType) {
    case SubmissionAction.ActionType.EDIT_ROW:
      return 'Edit Row';
    case SubmissionAction.ActionType.INSERT_ROW:
      return 'Insert Row';
    default:
      return assertUnreachable(actionType);
  }
}
