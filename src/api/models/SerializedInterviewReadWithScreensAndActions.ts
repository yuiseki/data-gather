/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { SerializedInterviewScreenRead } from './SerializedInterviewScreenRead';
import type { SerializedInterviewSettingRead } from './SerializedInterviewSettingRead';
import type { SerializedSubmissionActionRead } from './SerializedSubmissionActionRead';

/**
 * The InterviewRead model including nested screens.
 */
export type SerializedInterviewReadWithScreensAndActions = {
  description: string;
  name: string;
  notes: string;
  vanityUrl?: string;
  published: boolean;
  ownerId: string;
  defaultLanguage: string;
  allowedLanguages: string;
  id: string;
  createdDate: string;
  screens?: Array<SerializedInterviewScreenRead>;
  submissionActions?: Array<SerializedSubmissionActionRead>;
  interviewSettings?: Array<SerializedInterviewSettingRead>;
};

