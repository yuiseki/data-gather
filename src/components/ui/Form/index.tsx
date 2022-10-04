import { Children } from 'react';
import type { ReactNode, FormEvent } from 'react';
import FormInput, { isFormInput } from './FormInput';
import FormSubmitButton from './FormSubmitButton';
import FormGroup from './FormGroup';

type Props = {
  children: ReactNode;
  className?: string;
  onSubmit: (
    values: Map<string, string>,
    event: FormEvent<HTMLFormElement>,
  ) => void;
};

export default function Form({
  children,
  className,
  onSubmit,
}: Props): JSX.Element {
  const onFormSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const formElements = event.currentTarget.elements;

    const valuesMap = new Map<string, string>();
    Children.forEach(children, childNode => {
      if (isFormInput(childNode)) {
        const { name } = childNode.props;
        const elt = formElements.namedItem(name);
        if (elt instanceof HTMLInputElement) {
          valuesMap.set(name, elt.value);
        }
      }
      return undefined;
    });

    onSubmit(valuesMap, event);
  };

  return (
    <form className={className ?? 'space-y-4'} onSubmit={onFormSubmit}>
      {children}
    </form>
  );
}

Form.Input = FormInput;
Form.SubmitButton = FormSubmitButton;
Form.Group = FormGroup;
