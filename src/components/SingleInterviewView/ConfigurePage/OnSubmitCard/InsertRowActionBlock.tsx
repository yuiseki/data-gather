import * as React from 'react';
import * as R from 'remeda';
import * as InterviewScreenEntry from '../../../../models/InterviewScreenEntry';
import * as InterviewSetting from '../../../../models/InterviewSetting';
import * as Interview from '../../../../models/Interview';
import * as SubmissionAction from '../../../../models/SubmissionAction';
import Dropdown from '../../../ui/Dropdown';
import LabelWrapper from '../../../ui/LabelWrapper';
import FieldToQuestionBlock from './FieldToQuestionBlock';
import type { EditableAction } from './types';

type Props = {
  action: EditableAction;
  actionConfig: SubmissionAction.WithPartialPayload<SubmissionAction.InsertRowActionConfig>;
  defaultLanguage: string;
  entries: readonly InterviewScreenEntry.WithScreenT[];
  interview: Interview.UpdateT;
  onActionChange: (
    actionToReplace: EditableAction,
    newAction: EditableAction,
  ) => void;
};

export default function EditRowActionBlock({
  action,
  actionConfig,
  defaultLanguage,
  entries,
  interview,
  onActionChange,
}: Props): JSX.Element {
  const interviewSetting = interview?.interviewSettings.find(
    intSetting => intSetting.type === InterviewSetting.SettingType.AIRTABLE,
  );
  const airtableSettings = interviewSetting?.settings;

  const allTables = React.useMemo(
    () =>
      airtableSettings && airtableSettings.bases
        ? airtableSettings?.bases?.flatMap(base => base.tables)
        : [],
    [airtableSettings],
  );

  const tableToBaseIdLookup = React.useMemo(
    () =>
      R.pipe(
        airtableSettings?.bases ?? [],
        R.flatMapToObj(base =>
          (base.tables ?? []).map(table => [table.id, base.id]),
        ),
      ),
    [airtableSettings],
  );

  const selectedTable = React.useMemo(
    () =>
      allTables.find(table => table?.id === actionConfig.payload.tableTarget),
    [allTables, actionConfig],
  );

  const tableOptions = React.useMemo(
    () =>
      allTables.map(table => ({
        value: table ? table.id : '',
        displayValue: table ? table.name : '',
      })),
    [allTables],
  );

  const onChangeTableTarget = (tableId: string): void => {
    const newConfig = {
      type: actionConfig.type,
      payload: {
        ...action.config.payload,
        baseTarget: tableToBaseIdLookup[tableId],
        tableTarget: tableId,
      },
    };

    onActionChange(action, { ...action, config: newConfig });
  };

  const onFieldMappingChange = (
    fieldMappings: ReadonlyMap<
      SubmissionAction.FieldId,
      SubmissionAction.EntryResponseLookupConfig
    >,
  ): void => {
    onActionChange(action, { ...action, fieldMappings });
  };

  return (
    <div className="space-y-4">
      <LabelWrapper label="Airtable table">
        <Dropdown
          value={actionConfig.payload.tableTarget}
          options={tableOptions}
          onChange={onChangeTableTarget}
          placeholder="Select table"
        />
      </LabelWrapper>
      {selectedTable && (
        <>
          <p>Map each column to the question response that should be used.</p>
          <FieldToQuestionBlock
            entries={entries}
            airtableTable={selectedTable}
            fieldMappings={action.fieldMappings}
            onFieldMappingChange={onFieldMappingChange}
            defaultLanguage={defaultLanguage}
            interview={interview}
          />
        </>
      )}
    </div>
  );
}
