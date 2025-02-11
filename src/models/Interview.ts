import { DateTime } from 'luxon';
import * as InterviewScreen from './InterviewScreen';
import * as SubmissionAction from './SubmissionAction';
import * as InterviewSettings from './InterviewSetting';
import { SerializedInterviewRead } from '../api/models/SerializedInterviewRead';
import { SerializedInterviewCreate } from '../api/models/SerializedInterviewCreate';
import { SerializedInterviewUpdate } from '../api/models/SerializedInterviewUpdate';
import { SerializedInterviewReadWithScreensAndActions } from '../api/models/SerializedInterviewReadWithScreensAndActions';

const LANGUAGE_DELIMITER = ';';

/**
 * All the metadata data for an interview.
 */
type Interview = {
  readonly allowedLanguages: readonly string[];
  readonly createdDate: DateTime;
  readonly defaultLanguage: string;
  readonly description: string;
  readonly id: string;
  readonly name: string;
  readonly notes: string;
  readonly ownerId: string;
  readonly published: boolean;
  readonly vanityUrl?: string;
};

// TODO: change name to WithSettingsScreensAndActions or just
// 'FullInterview' or something
/**
 * Interview model with its associated screens loaded.
 */
interface InterviewWithScreensAndActions extends Interview {
  readonly interviewSettings: readonly InterviewSettings.T[];
  readonly screens: readonly InterviewScreen.T[];
  readonly submissionActions: readonly SubmissionAction.T[];
}

/**
 * The Interview model used during creation.
 * `id` and `createdDate` are removed because they get set by the database.
 */
type InterviewCreate = Omit<Interview, 'id' | 'createdDate'>;

/**
 * The Interview model used during an update request. This model allows
 * updating nested actions but screens are not included in this model.
 */
type InterviewUpdate = Interview & {
  readonly interviewSettings: ReadonlyArray<
    InterviewSettings.T | InterviewSettings.CreateT
  >;

  /**
   * Allow the `submissionActions` to include either fully specified actions
   * or the "Create" variants which still don't have an assigned id.
   */
  readonly submissionActions: ReadonlyArray<
    SubmissionAction.T | SubmissionAction.CreateT
  >;
};

export const QueryKeys = {
  allInterviews: ['allInterviews'],
  getInterview: (interviewId: string) => ['interview', interviewId],
};

export const ALL_INTERVIEWS_URL = '/';

/**
 * Returns a URL which can be used to execute a given interview.
 * see: routes in App.tsx
 */
export function getRunUrl(interview: Interview): string {
  return `/interview/${interview.id}/run`;
}

/**
 * Returns a URL for the configure page of an interview.
 */
export function getConfigurePageURL(interviewOrId: Interview | string): string {
  const interviewId =
    typeof interviewOrId === 'string' ? interviewOrId : interviewOrId.id;
  return `/interview/${interviewId}/configure`;
}

/**
 * Create a new empty interview
 */
export function create(values: {
  description: string;
  name: string;
  ownerId: string;
}): InterviewCreate {
  return {
    ownerId: values.ownerId,
    description: values.description,
    name: values.name,
    published: false,
    notes: '',
    allowedLanguages: ['en'],
    defaultLanguage: 'en',
  };
}

export function getStartingScreens(
  interview: InterviewWithScreensAndActions,
): InterviewScreen.T[] {
  const startingScreens = interview.screens.filter(
    screen =>
      screen.isInStartingState && screen.startingStateOrder !== undefined,
  );
  const sortedScreens = startingScreens.sort(
    (scr1, scr2) =>
      (scr2.startingStateOrder ?? 0) - (scr1.startingStateOrder ?? 0),
  );
  return sortedScreens;
}

export function updateNotes(interview: Interview, notes: string): Interview {
  return {
    ...interview,
    notes,
  };
}

/**
 * Deserialize a SerializedInterviewRead model from the backend.
 */
export function deserialize(
  rawObj: SerializedInterviewReadWithScreensAndActions,
): InterviewWithScreensAndActions;
export function deserialize(rawObj: SerializedInterviewRead): Interview;
export function deserialize(
  rawObj:
    | SerializedInterviewRead
    | SerializedInterviewReadWithScreensAndActions,
): Interview | InterviewWithScreensAndActions {
  const datetime = DateTime.fromISO(rawObj.createdDate);
  if ('screens' in rawObj) {
    return {
      ...rawObj,
      createdDate: datetime,
      screens: rawObj.screens?.map(InterviewScreen.deserialize),
      submissionActions: rawObj.submissionActions?.map(
        SubmissionAction.deserialize,
      ),
      interviewSettings: rawObj.interviewSettings?.map(
        InterviewSettings.deserialize,
      ),
      allowedLanguages: rawObj.allowedLanguages.split(LANGUAGE_DELIMITER),
    };
  }

  return {
    ...rawObj,
    createdDate: datetime,
    allowedLanguages: rawObj.allowedLanguages.split(LANGUAGE_DELIMITER),
  };
}

/** Serialize an InterviewUpdate or Create model */
export function serialize(
  interview: InterviewUpdate,
): SerializedInterviewUpdate;
export function serialize(
  interview: InterviewCreate,
): SerializedInterviewCreate;
export function serialize(
  interview: InterviewUpdate | InterviewCreate,
): SerializedInterviewCreate | SerializedInterviewUpdate {
  if ('createdDate' in interview) {
    return {
      ...interview,
      submissionActions: interview.submissionActions.map(action =>
        'tempId' in action
          ? SubmissionAction.serializeCreate(action)
          : SubmissionAction.serialize(action),
      ),
      interviewSettings: interview.interviewSettings.map(setting =>
        'tempId' in setting
          ? InterviewSettings.serializeCreate(setting)
          : InterviewSettings.serialize(setting),
      ),
      createdDate: interview.createdDate?.toISO(),
      allowedLanguages: interview.allowedLanguages.join(LANGUAGE_DELIMITER),
    };
  }
  return {
    ...interview,
    allowedLanguages: interview.allowedLanguages.join(LANGUAGE_DELIMITER),
  };
}

export type { Interview as T };
export type { InterviewWithScreensAndActions as WithScreensAndActions };
export type { InterviewCreate as CreateT };
export type { InterviewUpdate as UpdateT };
export type { SerializedInterviewRead as SerializedT };
