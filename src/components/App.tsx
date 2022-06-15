import { useMemo } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Interview } from '../types';
import AllInterviewsView from './AllInterviewsView';
import AppContext, { AppGlobalState } from './AppContext';
import Header from './Header';
import SingleInterviewView from './SingleInterviewView';

// TODO: eventually this should be removed and we should
// load information from browser cache. In the future we
// shouldn't even use browser cache - we should use an
// actual backend store.
const ALL_INTERVIEWS: readonly Interview[] = [
  {
    createdDate: new Date(),
    description: 'A sample interview to run a guessing game',
    id: 'guessing-game',
    name: 'Guessing Game',
    screens: [
      {
        displayName: 'Name',
        id: 'NAME',
        questions: [],
      },
      {
        displayName: 'Guess',
        id: 'GUESS',
        questions: [],
      },
      {
        displayName: 'Incorrect Guess',
        id: 'INCORRECT_GUESS',
        questions: [],
      },
      {
        displayName: 'Correct Ending',
        id: 'CORRECT_ENDING',
        questions: [],
      },
    ],
  },
];

export default function App(): JSX.Element {
  const globalState: AppGlobalState = useMemo(
    () => ({
      allInterviews: ALL_INTERVIEWS,
    }),
    [],
  );

  return (
    <AppContext.Provider value={globalState}>
      <div className="flex flex-col h-screen bg-gray-100">
        <Header />
        <Routes>
          <Route path="/" element={<AllInterviewsView />} />
          <Route
            path="/interview/:interviewId/*"
            element={<SingleInterviewView />}
          />
        </Routes>
      </div>
    </AppContext.Provider>
  );
}
