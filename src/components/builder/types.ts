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
  paymentAmount?: number;
  paymentCurrency?: "CAD" | "USD";
  paymentDescription?: string;

  // Non-input display element discriminator. When set, this field renders
  // as a divider, subtitle, or description in the builder, and serializes
  // to a SurveyJS `type: "html"` element with synthesized html content.
  displayKind?: "divider" | "subtitle" | "description";
  subtitleText?: LocalizedString;
  descriptionText?: LocalizedString;
}
