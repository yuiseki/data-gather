import * as React from 'react';
import { useParams } from 'react-router-dom';
import Form from '../../ui/Form';
import LabelWrapper from '../../ui/LabelWrapper';
import MultiSelect from '../../ui/MultiSelect';
import * as InterviewScreenEntry from '../../../models/InterviewScreenEntry';
import * as InterviewSetting from '../../../models/InterviewSetting';
import useInterview from '../../../hooks/useInterview';

type Props = {
  airtableConfig: InterviewScreenEntry.AirtableOptions;
  /**
   * Pass a way to filter the fields to show so that the UI doesn't show
   * all fields
   */
  fieldFilterFn?: (airtableField: InterviewSetting.AirtableField) => boolean;
  fieldSelectorLabel?: string;
  onAirtableConfigurationChange: (
    newConfig: InterviewScreenEntry.AirtableOptions,
  ) => void;
  useSingleField?: boolean;
};

export default function AirtableFieldSelector({
  airtableConfig,
  onAirtableConfigurationChange,
  fieldSelectorLabel = 'Select field',
  useSingleField = false,
  fieldFilterFn,
}: Props): JSX.Element {
  const { interviewId } = useParams();
  const interview = useInterview(interviewId);
  const interviewSetting = interview?.interviewSettings.find(
    intSetting => intSetting.type === InterviewSetting.SettingType.AIRTABLE,
  );
  const airtableSettings = interviewSetting?.settings;
  const bases = airtableSettings?.bases;
  const { selectedBase, selectedTable, selectedFields } = airtableConfig;

  const availableTables = React.useMemo(() => {
    if (selectedBase && bases) {
      const tables = bases
        .find(b => b.id === selectedBase)
        ?.tables?.map(t => ({
          displayValue: t.name,
          value: t.id,
        }));

      if (tables) {
        return tables;
      }
    }
    return [];
  }, [bases, selectedBase]);

  const availableFields = React.useMemo(() => {
    if (bases && selectedBase && selectedTable) {
      const fields = bases
        .find(b => b.id === selectedBase)
        ?.tables?.find(b => b.id === selectedTable)
        ?.fields?.filter(field => (fieldFilterFn ? fieldFilterFn(field) : true))
        .map(f => ({
          displayValue: f.name,
          value: f.name,
        }));
      if (fields) {
        return fields;
      }
    }
    return [];
  }, [bases, selectedBase, selectedTable, fieldFilterFn]);

  const renderFieldSelector = (): JSX.Element | null => {
    if (selectedBase && selectedTable) {
      if (useSingleField) {
        return (
          <Form.Dropdown
            label={fieldSelectorLabel}
            placeholder="Airtable field"
            name="airtableField"
            value={selectedFields[0]}
            onChange={(field: string) => {
              onAirtableConfigurationChange({
                ...airtableConfig,
                selectedFields: [field],
              });
            }}
            options={availableFields}
          />
        );
      }
      return (
        <LabelWrapper label={fieldSelectorLabel}>
          <MultiSelect
            ariaLabel="Airtable field"
            onChange={(newVals: string[]) => {
              onAirtableConfigurationChange({
                ...airtableConfig,
                selectedFields: newVals,
              });
            }}
            options={availableFields}
            placeholder="Airtable field"
            selectedValues={selectedFields}
          />
        </LabelWrapper>
      );
    }
    return null;
  };

  return (
    <div className="flex space-x-2">
      {bases && (
        <Form.Dropdown
          label="Airtable base"
          name="airtableBase"
          value={selectedBase}
          onChange={(newVal: string) => {
            onAirtableConfigurationChange({
              ...airtableConfig,
              selectedBase: newVal,
            });
          }}
          options={bases.map(b => ({
            displayValue: b.name ?? '',
            value: b.id ?? '',
          }))}
        />
      )}
      {selectedBase && (
        <Form.Dropdown
          label="Airtable table"
          name="airtableTable"
          placeholder="Airtable table"
          value={selectedTable}
          onChange={(newVal: string) => {
            onAirtableConfigurationChange({
              ...airtableConfig,
              selectedTable: newVal,
              selectedFields: [],
            });
          }}
          options={availableTables}
        />
      )}
      {renderFieldSelector()}
    </div>
  );
}
