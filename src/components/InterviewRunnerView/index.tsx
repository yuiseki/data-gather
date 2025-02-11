import * as React from 'react';
import {
  Interview as Engine,
  Moderator,
  ResponseConsumer,
} from '@dataclinic/interview';
import { useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import useInterview from '../../hooks/useInterview';
import useInterviewScreenEntries from '../../hooks/useInterviewScreenEntries';
import useInterviewScreens from '../../hooks/useInterviewScreens';
import InterviewRunnerScreen from './InterviewRunnerScreen';
import useInterviewConditionalActions from '../../hooks/useInterviewConditionalActions';
import * as InterviewScreen from '../../models/InterviewScreen';
import * as InterviewScreenEntry from '../../models/InterviewScreenEntry';
import * as SubmissionAction from '../../models/SubmissionAction';
import ConfigurableScript from '../../script/ConfigurableScript';
import { FastAPIService } from '../../api/FastAPIService';
import assertUnreachable from '../../util/assertUnreachable';
import type { ResponseData } from '../../script/types';
import { useToast } from '../ui/Toast';
import useHTTPErrorToast from '../../hooks/useHTTPErrorToast';
import InterviewCompletionScreen from './InterviewCompletionScreen';
import Modal from '../ui/Modal';

const api = new FastAPIService();

type Props = {
  interviewId: string;
  onInterviewReset: () => void;
  onStartNewInterview: () => void;
};

function getSpecialValueForSubmission(
  specialValueType: SubmissionAction.SpecialValueType,
): string {
  switch (specialValueType) {
    case SubmissionAction.SpecialValueType.NOW_DATE:
      return new Date().toISOString();
    default:
      return assertUnreachable(specialValueType);
  }
}

function BaseInterviewRunnerView({
  interviewId,
  onInterviewReset,
  onStartNewInterview,
}: Props): JSX.Element | null {
  const interview = useInterview(interviewId);
  const screens = useInterviewScreens(interviewId);
  const actions = useInterviewConditionalActions(interviewId);
  const [currentScreen, setCurrentScreen] = React.useState<
    InterviewScreen.T | undefined
  >(undefined);
  const [responseConsumer, setResponseConsumer] = React.useState<
    ResponseConsumer | undefined
  >(undefined);
  const [completedResponseData, setCompletedResponseData] = React.useState<
    ResponseData | undefined
  >();
  const entries = useInterviewScreenEntries(interviewId);
  const { mutate: airtableUpdateRecord, isLoading: isUpdatingAirtableRecord } =
    useMutation({
      mutationFn: (data: {
        baseId: string;
        fields: { [fieldName: string]: string };
        recordId: string;
        tableId: string;
      }) =>
        api.airtable.updateAirtableRecord(
          data.baseId,
          data.tableId,
          data.recordId,
          interviewId,
          data.fields,
        ),
    });

  const { mutate: airtableCreateRecord, isLoading: isCreatingAirtableRecord } =
    useMutation({
      mutationFn: (data: {
        baseId: string;
        fields: { [fieldName: string]: string };
        tableId: string;
      }) =>
        api.airtable.createAirtableRecord(
          data.baseId,
          data.tableId,
          interviewId,
          data.fields,
        ),
    });
  const raiseHTTPErrorToast = useHTTPErrorToast();
  const [errorOnComplete, setErrorOnComplete] = React.useState<
    { errorMessage: string; errorTitle: string } | undefined
  >();

  const onInterviewComplete = React.useCallback(
    (responseData: ResponseData): void => {
      if (interview) {
        const allEntries: Map<InterviewScreenEntry.Id, InterviewScreenEntry.T> =
          Object.keys(responseData).reduce(
            (map, responseKey) =>
              map.set(
                responseData[responseKey].entry.id,
                responseData[responseKey].entry,
              ),
            new Map(),
          );

        // handle all on-submit actions
        interview.submissionActions.forEach(submissionAction => {
          const { config: actionConfig } = submissionAction;
          switch (actionConfig.type) {
            case SubmissionAction.ActionType.EDIT_ROW: {
              const actionPayload = actionConfig.payload;
              const entryTarget = allEntries.get(actionPayload.entryId);

              if (
                entryTarget &&
                entryTarget.responseType ===
                  InterviewScreenEntry.ResponseType.AIRTABLE
              ) {
                const baseId = entryTarget.responseTypeOptions.selectedBase;
                const tableId = entryTarget.responseTypeOptions.selectedTable;
                const airtableRecordId = ConfigurableScript.getResponseValue(
                  responseData,
                  entryTarget.responseKey,
                  actionPayload.primaryKeyField,
                );

                if (airtableRecordId) {
                  // get all fields mapped to their values collected from the
                  // entry responses
                  const fields: { [fieldId: string]: string } = {};
                  submissionAction.fieldMappings.forEach(
                    (entryLookupConfig, fieldId) => {
                      const { entryId, responseFieldKey, specialValueType } =
                        entryLookupConfig;
                      let responseValue = '';
                      if (entryId) {
                        const entry = allEntries.get(entryId);
                        if (entry) {
                          responseValue =
                            ConfigurableScript.getResponseValue(
                              responseData,
                              entry.responseKey,
                              responseFieldKey,
                            ) ?? '';
                        }
                      } else if (specialValueType) {
                        responseValue =
                          getSpecialValueForSubmission(specialValueType);
                      }

                      // ignore empty values
                      if (responseValue !== '') {
                        fields[fieldId] = responseValue;
                      }
                    },
                  );

                  airtableUpdateRecord(
                    {
                      baseId,
                      tableId,
                      fields,
                      recordId: airtableRecordId,
                    },
                    {
                      onError: error => {
                        const { errorMessage, errorTitle } =
                          raiseHTTPErrorToast({ error });
                        setErrorOnComplete({ errorMessage, errorTitle });
                      },
                    },
                  );
                }
              }
              break;
            }

            case SubmissionAction.ActionType.INSERT_ROW: {
              const { baseTarget, tableTarget } = actionConfig.payload;

              // collect all field values
              // TODO: this is duplicate code from the EDIT_ROW section. We
              // should get a reusable function to collect fieldMappings.
              const fields: { [fieldId: string]: string } = {};
              submissionAction.fieldMappings.forEach(
                (entryLookupConfig, fieldId) => {
                  const { entryId, responseFieldKey, specialValueType } =
                    entryLookupConfig;
                  let responseValue = '';
                  if (entryId) {
                    const entry = allEntries.get(entryId);
                    if (entry) {
                      responseValue =
                        ConfigurableScript.getResponseValue(
                          responseData,
                          entry.responseKey,
                          responseFieldKey,
                        ) ?? '';
                    }
                  } else if (specialValueType) {
                    responseValue =
                      getSpecialValueForSubmission(specialValueType);
                  }

                  // ignore empty values
                  if (responseValue !== '') {
                    fields[fieldId] = responseValue;
                  }
                },
              );

              airtableCreateRecord(
                {
                  fields,
                  baseId: baseTarget,
                  tableId: tableTarget,
                },
                {
                  onError: error => {
                    const { errorMessage, errorTitle } = raiseHTTPErrorToast({
                      error,
                    });
                    setErrorOnComplete({ errorMessage, errorTitle });
                  },
                },
              );
              break;
            }
            default:
              assertUnreachable(actionConfig);
          }
        });
      }
    },
    [
      interview,
      airtableUpdateRecord,
      airtableCreateRecord,
      raiseHTTPErrorToast,
    ],
  );

  // Construct and run an interview on component load.
  React.useEffect(() => {
    if (!interview || !screens || !actions) {
      return;
    }

    // Load screens for interview and index them by their ID
    const indexedScreens: Map<string, InterviewScreen.WithChildrenT> =
      new Map();
    screens.forEach(screen => indexedScreens.set(screen.id, screen));

    // Create a script from the interview definition
    const script: ConfigurableScript = new ConfigurableScript(
      interview,
      actions,
      indexedScreens,
    );

    // Moderator, when prompted to ask, will set state on this component so that it will
    // display the correct screen.
    const moderator: Moderator<InterviewScreen.T> = {
      ask(consumer: ResponseConsumer, screen: InterviewScreen.T) {
        setResponseConsumer(consumer);
        setCurrentScreen(screen);
      },
    };

    // Build interview from script and moderator, and kick it off.
    const engine: Engine<InterviewScreen.T> = new Engine<InterviewScreen.T>(
      script,
      moderator,
    );
    engine.run((result: ResponseData) => {
      setCompletedResponseData(result);
      onInterviewComplete(result);
    });
  }, [interview, screens, actions, onInterviewComplete]);

  return (
    <div>
      {completedResponseData && interview ? (
        <InterviewCompletionScreen
          interview={interview}
          isUpdatingBackend={
            isUpdatingAirtableRecord || isCreatingAirtableRecord
          }
          onStartNewInterview={onStartNewInterview}
          error={errorOnComplete}
          responseData={completedResponseData}
        />
      ) : (
        <div>
          {interview && currentScreen && entries && responseConsumer && (
            <InterviewRunnerScreen
              interview={interview}
              screen={currentScreen}
              entries={entries.get(currentScreen.id) ?? []}
              responseConsumer={responseConsumer}
              onInterviewReset={onInterviewReset}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function InterviewRunnerView(props: {
  interviewId: string;
}): JSX.Element | null {
  const { interviewId } = props;
  const toaster = useToast();
  const [isResetConfirmationModalOpen, setIsResetConfirmationModalOpen] =
    React.useState(false);

  // keep track of a counter just to reset the interview easily by resetting its key
  const [resetCounter, setResetCounter] = React.useState(1);
  const onInterviewResetRequest = React.useCallback(() => {
    setIsResetConfirmationModalOpen(true);
  }, []);

  const onInterviewResetConfirm = React.useCallback(() => {
    setResetCounter(prev => prev + 1);
    toaster.notifySuccess(
      'Reset interview',
      'The interview has been restarted',
    );
    setIsResetConfirmationModalOpen(false);
  }, [toaster]);

  const onStartNewInterview = React.useCallback(() => {
    setResetCounter(prev => prev + 1);
  }, []);

  return (
    <>
      <BaseInterviewRunnerView
        key={resetCounter}
        interviewId={interviewId}
        onInterviewReset={onInterviewResetRequest}
        onStartNewInterview={onStartNewInterview}
      />
      {isResetConfirmationModalOpen && (
        <Modal
          useConfirmButton
          confirmIsDangerous
          onConfirmClick={onInterviewResetConfirm}
          isOpen={isResetConfirmationModalOpen}
          onDismiss={() => setIsResetConfirmationModalOpen(false)}
          title="Reset interview?"
        >
          Are you sure you want to reset this interview? Any current responses
          will be lost.
        </Modal>
      )}
    </>
  );
}

/**
 * Runs an interview based on the ID of the interview in the URL params.
 */
export function InterviewRunnerViewRoute(): JSX.Element | null {
  const { interviewId } = useParams();

  if (interviewId) {
    return <InterviewRunnerView interviewId={interviewId} />;
  }
  return null;
}
