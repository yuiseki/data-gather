import Dexie, { Table } from 'dexie';
import invariant from 'invariant';
import { createContext } from 'react';
import * as ConditionalAction from '../models/ConditionalAction';
import * as Interview from '../models/Interview';
import * as InterviewScreen from '../models/InterviewScreen';
import * as InterviewScreenEntry from '../models/InterviewScreenEntry';

function isNonNullable<T>(x: T): x is NonNullable<T> {
  return x !== null && x !== undefined;
}

/**
 * This API interacts with the browser storage backend.
 *
 * All functions here should return deserialized models. Meaning, they
 * should be translated from their backend representation to a usable
 * frontend representation. For example, any dates as numerical timestamps
 * should be converted to Date objects before returning.
 */
export class InterviewStoreAPI extends Dexie {
  conditionalActions!: Table<ConditionalAction.SerializedT>;

  interviews!: Table<Interview.SerializedT>;

  interviewScreens!: Table<InterviewScreen.SerializedT>;

  interviewScreenEntries!: Table<InterviewScreenEntry.SerializedT>;

  constructor() {
    super('DataClinicInterviewApp');

    // id is our primary key
    this.version(1).stores({
      conditionalActions: '++id',
      interviewScreenEntries: '++id',
      interviewScreens: '++id',
      interviews: '++id',
    });
  }

  /**
   * Create a new empty interview
   * @param {string} name
   * @param {string} description
   */
  createInterview = async (
    name: string,
    description: string,
  ): Promise<Interview.T> => {
    const newInterview = Interview.create({ description, name });
    await this.interviews.add(Interview.serialize(newInterview));
    return newInterview;
  };

  /**
   * Get all interview ids
   * @returns {string[]} Array of all interview IDs
   */
  getInterviewIds = async (): Promise<string[]> => {
    const interviews = await this.interviews.toArray();
    return interviews.map(row => row.id);
  };

  /**
   * Get all interviews
   * @returns {Interview.T[]} Array of interview objects
   */
  getAllInterviews = async (): Promise<Interview.T[]> => {
    const serializedInterviews = await this.interviews.toArray();
    return serializedInterviews.map(Interview.deserialize);
  };

  /**
   * Get an interview by their id.
   *
   * @param {string} id
   * @returns {Interview.T | undefined} The Interview object, or undefined if
   * not found
   */
  getInterview = async (id: string): Promise<Interview.T | undefined> => {
    const interview = await this.interviews.get(id);
    if (interview) {
      return Interview.deserialize(interview);
    }
    return undefined;
  };

  /**
   * Get screens by their ids.
   *
   * @param {string[]} screenIds
   * @returns {InterviewScreen.T[]} Array of interview screens
   */
  getScreens = async (
    screenIds: readonly string[],
  ): Promise<InterviewScreen.T[]> => {
    const screens = (
      await this.interviewScreens.bulkGet([...screenIds])
    ).filter(isNonNullable);
    return screens.map(InterviewScreen.deserialize);
  };

  /**
   * Get all screens of an interview, given the interview id.
   *
   * @param {string} interviewId
   * @returns {InterviewScreen.T[]} Array of interview screens
   */
  getScreensOfInterview = async (
    interviewId: string,
  ): Promise<InterviewScreen.T[]> => {
    const interview = await this.getInterview(interviewId);
    return interview ? this.getScreens(interview.screens) : [];
  };

  /**
   * Get screen entries by their ids.
   *
   * @param {string[]} entryIds
   * @returns {InterviewScreen.T[]} Array of interview screens
   */
  getScreenEntries = async (
    entryIds: readonly string[],
  ): Promise<InterviewScreenEntry.T[]> => {
    const entries = (
      await this.interviewScreenEntries.bulkGet([...entryIds])
    ).filter(isNonNullable);
    return entries.map(InterviewScreenEntry.deserialize);
  };

  /**
   * Get all screen entries of an interview, given the interview id.
   *
   * @param {string} interviewId
   * @returns {Map<string, InterviewScreenEntry.T[]>} A Map mapping a
   * screen id to its corresponding array of screen entries.
   */
  getScreenEntriesOfInterview = async (
    interviewId: string,
  ): Promise<Map<string, InterviewScreenEntry.T[]>> => {
    const interview = await this.getInterview(interviewId);
    if (interview) {
      const screens = await this.getScreens(interview.screens);

      // get all entries for all screens
      const allEntries = await this.getScreenEntries(
        screens.flatMap(screen => screen.entries),
      );
      const allEntriesMap = allEntries.reduce(
        (map, entry) => map.set(entry.id, entry),
        new Map<string, InterviewScreenEntry.T>(),
      );

      // associate each entry back to its corresponding screen
      return screens.reduce((map, screen) => {
        const entries = screen.entries
          .map(entryId => allEntriesMap.get(entryId))
          .filter(isNonNullable);
        return map.set(screen.id, entries);
      }, new Map<string, InterviewScreenEntry.T[]>());
    }

    return new Map();
  };

  /**
   * If this interview already exists, update it. Otherwise, add it.
   * @param {Interview.T} interview
   * @returns {Interview.T} the updated interview
   */
  putInterview = async (interview: Interview.T): Promise<Interview.T> => {
    await this.interviews.put(Interview.serialize(interview));
    return interview;
  };

  /**
   * If this interview screen already exists, update it. Otherwise, add it.
   * @param {string} interviewId
   * @param {InterviewScreen.T} screen
   * @returns {InterviewScreen.T} the updated interview screen
   */
  putScreen = async (
    interviewId: string,
    screen: InterviewScreen.T,
  ): Promise<InterviewScreen.T> => {
    const interview = await this.interviews.get(interviewId);
    if (interview) {
      await this.interviewScreens.put(InterviewScreen.serialize(screen));
    } else {
      await this.addScreenToInterview(interviewId, screen);
    }
    return screen;
  };

  /**
   * Delete an interview given their id
   * This will delete all associated objects to this interview.
   * That includes their associated screens, entries, and conditional actions
   *
   * @param {string} interviewId
   */
  deleteInterview = async (interviewId: string): Promise<void> => {
    // first, get the interview by id
    const interview = await this.getInterview(interviewId);

    if (interview) {
      // get all screen ids to delete
      const screenIds = [...interview.screens];

      // get all screens (to then get entries and conditional actions)
      const screens = await this.getScreens(screenIds);

      // get all entry ids to delete
      const entryIds = screens.flatMap(screen => screen.entries);
      const actionIds = screens.flatMap(screen => screen.actions);

      // now delete all screens, entries, actions, and the interview itself
      await Promise.all([
        this.conditionalActions.bulkDelete(actionIds),
        this.interviewScreenEntries.bulkDelete(entryIds),
        this.interviewScreens.bulkDelete(screenIds),
        this.interviews.delete(interviewId),
      ]);
    }
  };

  /**
   * Add a new screen to the interview.
   * The interview must already exist otherwise this will throw an error.
   *
   * @param {string} interviewId
   * @param {InterviewScreen.T} interviewScreen
   */
  addScreenToInterview = async (
    interviewId: string,
    interviewScreen: InterviewScreen.T,
  ): Promise<[Interview.T, InterviewScreen.T]> => {
    const interview = await this.getInterview(interviewId);
    invariant(
      interview,
      `[InterviewStore] addScreenToInterview: Could not find interview with id '${interviewId}'`,
    );
    const newInterview = Interview.addScreen(interview, interviewScreen);

    return Promise.all([
      this.putInterview(newInterview),
      this.putScreen(interviewId, interviewScreen),
    ]);
  };
}

const InterviewStoreContext = createContext<InterviewStoreAPI | undefined>(
  undefined,
);

const InterviewStore = {
  API: InterviewStoreAPI,
  Context: InterviewStoreContext,
  Provider: InterviewStoreContext.Provider,
};

export default InterviewStore;
