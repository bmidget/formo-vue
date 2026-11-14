import type { FormoLocaleMessages, FormoUiStrings } from '../../types'

/**
 * English — the built-in default (Kohana's messages/validation.php wording).
 *
 * Placeholders: `:field` (label), `:value`, `:param1`…, `:params`, `:other`.
 * Laravel names work too (`:attribute`, `:min`, `:max`, `:size`, `:values`…),
 * so Laravel lang files can be used as-is — see `fromLaravelValidation()`.
 */
export const validation: Record<string, string> = {
  default: ':field is invalid',
  required: ':field must not be empty',
  email: ':field must be an email address',
  url: ':field must be a url',
  min: ':field must be at least :param1 characters long',
  max: ':field must not exceed :param1 characters long',
  length: ':field must be exactly :param1 characters long',
  numeric: ':field must contain only digits',
  integer: ':field must be a whole number',
  decimal: ':field must be a number',
  digits: ':field must be :param1 digits',
  between: ':field must be within the range of :param1 to :param2',
  min_value: ':field must be :param1 or more',
  max_value: ':field must be :param1 or less',
  regex: ':field does not match the required format',
  alpha: ':field must contain only letters',
  alpha_num: ':field must contain only letters and numbers',
  alpha_dash: ':field must contain only numbers, letters and dashes',
  alpha_spaces: ':field must contain only letters and spaces',
  is: ':field must be :param1',
  is_not: ':field must not be :param1',
  one_of: ':field must be one of the available options',
  not_one_of: ':field is not an allowed value',
  confirmed: ':field must be the same as :other',
  matches: ':field must be the same as :other',
  date: ':field must be a date',
  phone: ':field must be a phone number',
  color: ':field must be a color',
  ip: ':field must be an ip address',
  ext: ':field must be a file of type: :params',
  mimes: ':field must be a file of type: :params',
  image: ':field must be an image',
  size: ':field must be smaller than :param1 KB',
  upload_size: ':field must be smaller than :param1',
  dimensions: ':field must be :param1 x :param2 pixels',
  min_items: 'Choose at least :param1 :field',
  max_items: 'Choose at most :param1 :field',
  html5_range: ':field must be between :min and :max',
  // Laravel's conditional requirements
  required_if: ':field must not be empty',
  required_unless: ':field must not be empty',
  required_with: ':field must not be empty',
  required_with_all: ':field must not be empty',
  required_without: ':field must not be empty',
  required_without_all: ':field must not be empty',
  // Laravel's Password rule helpers
  mixed_case: ':field must contain at least one uppercase and one lowercase letter',
  letters: ':field must contain at least one letter',
  numbers: ':field must contain at least one number',
  symbols: ':field must contain at least one symbol',
  // Request errors (form-level)
  csrf_mismatch: 'Your session has expired. Please refresh the page and try again.',
  request_failed: 'Something went wrong (:status). Please try again.',
}

/** How rules read in a requirements checklist (`errorDisplay: 'checklist'`) */
export const requirements: Record<string, string> = {
  required: 'Required',
  email: 'A valid email address',
  url: 'A valid URL',
  min: 'At least :param1 characters',
  max: 'At most :param1 characters',
  length: 'Exactly :param1 characters',
  numeric: 'Digits only',
  integer: 'A whole number',
  decimal: 'A number',
  digits: 'Exactly :param1 digits',
  between: 'Between :param1 and :param2',
  min_value: ':param1 or more',
  max_value: ':param1 or less',
  alpha: 'Letters only',
  alpha_num: 'Letters and numbers only',
  alpha_dash: 'Letters, numbers, dashes and underscores only',
  alpha_spaces: 'Letters and spaces only',
  confirmed: 'Matches :other',
  matches: 'Matches :other',
  min_items: 'At least :param1 selected',
  max_items: 'At most :param1 selected',
  mixed_case: 'Uppercase and lowercase letters',
  letters: 'At least one letter',
  numbers: 'At least one number',
  symbols: 'At least one symbol',
}

export const ui: FormoUiStrings = {
  add: 'Add another',
  remove: 'Remove',
  rowLabel: ':label #:index',
  errorSummary: 'Please fix the following:',
  yes: 'Yes',
  no: 'No',
  empty: '—',
  met: 'Met:',
  notMet: 'Not met:',
  checklistSummary: ':field: :met of :total requirements met',
}

export const en: FormoLocaleMessages = { validation, requirements, ui }
