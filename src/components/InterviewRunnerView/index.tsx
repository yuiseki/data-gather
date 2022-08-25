import {
  Interview as Engine,
  Moderator,
  ResponseConsumer,
} from '@dataclinic/interview';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import useInterview from '../../hooks/useInterview';
import useInterviewScreenEntries from '../../hooks/useInterviewScreenEntries';
import useInterviewScreens from '../../hooks/useInterviewScreens';
import * as InterviewScreenEntry from '../../models/InterviewScreenEntry';
import ConfigurableScript from '../../script/ConfigurableScript';
import { ScriptConfigSchema } from '../../script/ScriptConfigSchema';
import Button from '../ui/Button';
import { buildScriptConfig, InterviewScreenAdapter } from './adapters';

/**
 * Runs an interview based on the ID of the interview in the URL params.
 */
export default function InterviewRunnerView(): JSX.Element | null {
  const { interviewId } = useParams();
  const interview = useInterview(interviewId);
  const screens = useInterviewScreens(interviewId);
  const [currentScreen, setCurrentScreen] =
    useState<InterviewScreenAdapter | null>(null);
  const [responseConsumer, setResponseConsumer] =
    useState<ResponseConsumer | null>(null);
  const [complete, setComplete] = useState<boolean>(false);
  const entries = useInterviewScreenEntries(interviewId);

  // Construct and run an interview on component load.
  useEffect(() => {
    if (!interview || !screens) {
      return;
    }

    // Load screens for interview and index them by their ID
    const indexedScreens: { [screenId: string]: InterviewScreenAdapter } = {};
    screens.forEach(screen => {
      indexedScreens[screen.id] = new InterviewScreenAdapter(screen);
    });

    // Create a script from the interview definition
    // TODO: Also include actions in the script creation
    const scriptConfig: ScriptConfigSchema = buildScriptConfig(interview);
    const script: ConfigurableScript<InterviewScreenAdapter> =
      new ConfigurableScript(scriptConfig, id => indexedScreens[id]);

    // Moderator, when prompted to ask, will set state on this component so that it will
    // display the correct screen.
    const moderator: Moderator<InterviewScreenAdapter> = {
      ask(consumer: ResponseConsumer, screen: InterviewScreenAdapter) {
        setResponseConsumer(consumer);
        setCurrentScreen(screen);
      },
    };

    // Build interview from script and moderator, and kick it off.
    const engine: Engine<InterviewScreenAdapter> =
      new Engine<InterviewScreenAdapter>(script, moderator);
    engine.run(() => setComplete(true));
  }, [interview, screens]);

  return (
    <div>
      {complete ? (
        <div>Done!</div>
      ) : (
        <>
          {currentScreen && (
            <div>{currentScreen.getInterviewScreen().title}</div>
          )}
          {currentScreen && entries && (
            <div>
              {entries
                .get(currentScreen.getInterviewScreen().id)
                ?.map((entry: InterviewScreenEntry.T) => (
                  <div key={entry.id}>{entry.prompt}</div>
                ))}
            </div>
          )}
          {responseConsumer && (
            <Button onClick={() => responseConsumer.submit()}>Next</Button>
          )}
        </>
      )}
    </div>
  );
}
