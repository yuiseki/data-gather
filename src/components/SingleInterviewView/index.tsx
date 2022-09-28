import { Route, Routes, useParams } from 'react-router-dom';
import useInterview from '../../hooks/useInterview';
import useInterviewConditionalActions from '../../hooks/useInterviewConditionalActions';
import useInterviewScreenEntries from '../../hooks/useInterviewScreenEntries';
import useInterviewScreens from '../../hooks/useInterviewScreens';
import ConfigureCard from './ConfigureCard';
import ScreenCard from './ScreenCard';
import Sidebar from './Sidebar';

export default function SingleInterviewView(): JSX.Element {
  const { interviewId } = useParams();
  const interview = useInterview(interviewId);
  const screens = useInterviewScreens(interview?.id);
  const entries = useInterviewScreenEntries(interview?.id);
  const actions = useInterviewConditionalActions(interview?.id);

  if (interview === undefined) {
    return <p>Could not find interview</p>;
  }

  return (
    <div className="flex h-full w-full flex-1 items-center overflow-y-hidden p-0">
      <Sidebar interview={interview} screens={screens} />
      <div
        className="flex h-full w-4/5 flex-col items-center space-y-4 overflow-scroll p-14"
        id="scrollContainer"
      >
        <Routes>
          <Route
            path="configure"
            element={<ConfigureCard interview={interview} />}
          />
          {screens?.map(screen => (
            <Route
              key={screen.id}
              path={`/screen/${screen.id}`}
              element={
                <ScreenCard
                  key={screen.id}
                  screen={screen}
                  entries={entries?.get(screen.id) ?? []}
                  actions={actions?.get(screen.id) ?? []}
                />
              }
            />
          ))}
        </Routes>
      </div>
    </div>
  );
}
