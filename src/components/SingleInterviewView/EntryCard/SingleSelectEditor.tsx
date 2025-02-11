import * as React from 'react';
import * as IconType from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { v4 as uuidv4 } from 'uuid';
import * as InterviewSetting from '../../../models/InterviewSetting';
import * as Interview from '../../../models/Interview';
import * as InterviewScreenEntry from '../../../models/InterviewScreenEntry';
import InputText from '../../ui/InputText';
import Button from '../../ui/Button';
import LabelWrapper from '../../ui/LabelWrapper';
import AirtableFieldSelector from './AirtableFieldSelector';

type Props = {
  interview: Interview.WithScreensAndActions;
  onSelectionConfigurationChange: (
    newConfig: InterviewScreenEntry.SingleSelectOptions,
  ) => void;
  selectionConfig: InterviewScreenEntry.SingleSelectOptions;
};

function doesAirtableFieldHaveOptions(
  airtableField: InterviewSetting.AirtableField,
): boolean {
  return (
    airtableField.options !== undefined &&
    !!airtableField.options?.choices &&
    airtableField.options.choices.length > 0 &&
    airtableField.options.choices.every(
      choice => choice?.name !== '' && choice?.name !== undefined,
    )
  );
}

export default function SingleSelectEditor({
  onSelectionConfigurationChange,
  selectionConfig,
  interview,
}: Props): JSX.Element {
  const { airtableConfig, options } = selectionConfig;
  const [optionToAdd, setOptionToAdd] = React.useState<string>('');
  const interviewSetting = interview?.interviewSettings.find(
    intSetting => intSetting.type === InterviewSetting.SettingType.AIRTABLE,
  );
  const airtableSettings = interviewSetting?.settings;
  const showAirtableConfig = selectionConfig.airtableConfig !== undefined;

  const allAirtableFields = React.useMemo(
    () =>
      airtableSettings?.bases?.flatMap(base =>
        base.tables?.flatMap(table => table.fields),
      ),
    [airtableSettings?.bases],
  );

  const selectedAirtableField = React.useMemo(() => {
    if (
      airtableConfig &&
      airtableConfig.selectedFields &&
      airtableConfig.selectedFields.length > 0
    ) {
      return allAirtableFields?.find(
        field => field?.name === airtableConfig.selectedFields[0],
      );
    }
    return undefined;
  }, [airtableConfig, allAirtableFields]);

  const onAddOption = (): void => {
    const newOption = {
      id: uuidv4(),
      value: optionToAdd,
    };
    onSelectionConfigurationChange({
      ...selectionConfig,
      options: options.concat(newOption),
    });
    setOptionToAdd('');
  };

  return (
    <div className="space-y-2">
      {airtableSettings?.bases && airtableSettings.bases.length > 0 ? (
        <LabelWrapper
          inline
          label="Use options from an Airtable field?"
          labelTextClassName="mr-1"
          inlineContainerStyles={{ position: 'relative', top: 1 }}
        >
          <input
            type="checkbox"
            onChange={e => {
              const shouldShowAirtableConfig = e.target.checked;
              onSelectionConfigurationChange({
                ...selectionConfig,
                airtableConfig: shouldShowAirtableConfig
                  ? {
                      selectedTable: '',
                      selectedBase: '',
                      selectedFields: [],
                    }
                  : undefined,
              });
            }}
            checked={showAirtableConfig}
          />
        </LabelWrapper>
      ) : null}

      {/* Manual option configuration */}
      {!showAirtableConfig ? (
        <>
          <p>Options</p>
          {options.map(option => (
            <div className="space-x-2" key={option.id}>
              <InputText
                value={option.value}
                onChange={newVal => {
                  onSelectionConfigurationChange({
                    ...selectionConfig,
                    options: options.map(prevOpt =>
                      prevOpt.id === option.id
                        ? { ...prevOpt, value: newVal }
                        : prevOpt,
                    ),
                  });
                }}
              />
              <Button
                unstyled
                onClick={() => {
                  onSelectionConfigurationChange({
                    ...selectionConfig,
                    options: options.filter(
                      prevOpt => prevOpt.id !== option.id,
                    ),
                  });
                }}
              >
                <FontAwesomeIcon
                  className="hover:text-slate-400"
                  icon={IconType.faX}
                />
              </Button>
            </div>
          ))}
          <div className="space-x-2">
            <InputText
              placeholder="New option"
              onChange={setOptionToAdd}
              value={optionToAdd}
              onEnterPress={onAddOption}
            />
            <Button intent="primary" onClick={onAddOption}>
              Add
            </Button>
          </div>
        </>
      ) : null}

      {/* Airtable option configuration */}
      {showAirtableConfig && airtableConfig ? (
        <>
          <AirtableFieldSelector
            useSingleField
            airtableConfig={airtableConfig}
            onAirtableConfigurationChange={newAirtableConfig =>
              onSelectionConfigurationChange({
                ...selectionConfig,
                airtableConfig: newAirtableConfig,
              })
            }
            fieldFilterFn={doesAirtableFieldHaveOptions}
          />
          {selectedAirtableField ? (
            <ul className="ml-8 list-disc">
              {(selectedAirtableField.options?.choices ?? []).map(opt => (
                <li key={opt.id}>{opt.name}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
