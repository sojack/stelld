export type LocalizedString = string | { default: string; fr?: string };

export interface FormField {
  _id: string; // stable internal ID, not serialized to SurveyJS JSON
  type: string;
  name: string;
  title: string | LocalizedString;
  isRequired: boolean;
  placeholder?: string | LocalizedString;
  inputType?: string;
  choices?: (string | LocalizedString)[];
  min?: number;
  max?: number;
}
