export interface FormField {
  _id: string; // stable internal ID, not serialized to SurveyJS JSON
  type: string;
  name: string;
  title: string;
  isRequired: boolean;
  placeholder?: string;
  inputType?: string;
  choices?: string[];
  min?: number;
  max?: number;
}
