export interface FormField {
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
