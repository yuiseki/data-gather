import { v4 as uuidv4 } from 'uuid';

/**
 * Represents a single question asked to the interview subject
 */
interface InterviewScreenEntry {
  readonly id: string;

  /**  The name to display on the sidebar */
  readonly name: string;

  /**  The text of the question */
  readonly prompt: string;

  /** The id associated with the resposnse to the question */
  readonly responseId: string;

  /** The data type expected as a response */
  readonly responseType: string;

  /** The screen that this entry belongs to */
  readonly screenId: string;

  /** Additional flavor text associated with the question */
  readonly text: string;
}

type SerializedInterviewScreenEntry = InterviewScreenEntry;

export function deserialize(
  rawObj: SerializedInterviewScreenEntry,
): InterviewScreenEntry {
  return rawObj;
}

export function create(values: {
  name: string;
  prompt: string;
  responseType: string;
  screenId: string;
  text: string;
}): InterviewScreenEntry {
  return {
    id: uuidv4(),
    name: values.name,
    prompt: values.prompt,
    responseId: uuidv4(),
    responseType: values.responseType,
    screenId: values.screenId,
    text: values.text,
  };
}

/**
 * Convert from deserialized type to serialized
 */
export function serialize(
  interviewScreen: InterviewScreenEntry,
): SerializedInterviewScreenEntry {
  return interviewScreen;
}

/**
 * Returns an entry corresponding to the given id from a list of entries
 *
 * @param entryId
 * @param entries
 */
export function getEntryById(
  entryId: string,
  entries: InterviewScreenEntry[] | null,
): InterviewScreenEntry | null {
  if (entries === null) return null;

  // eslint-disable-next-line no-restricted-syntax
  for (const entry of entries) {
    if (entry.id === entryId) return entry;
  }
  return null;
}

export type { InterviewScreenEntry as T };
export type { SerializedInterviewScreenEntry as SerializedT };
