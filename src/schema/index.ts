/**
 * formo-vue/schema — forms from models and schemas: every field (or `only` / `except`), with types, labels and validation.
 *
 *   source ──adapter──▶ Formo model (IR JSON v1) ──formFromModel()──▶ form definition ──▶ useFormo / <FormoForm>
 *
 *  - Adapters: `fromLaravel` (FormRequest rules), `fromJsonSchema`, `fromOpenApi`, `fromZod` —
 *    or a backend sending the IR JSON directly (`parseModel`)
 *  - `formFromModel(model, { only, except, fields, order, mode, validation… })`
 *  - `toFormValues(model, record)` loads a record into the form
 *
 * Pure TypeScript — no Vue, no DOM (enforced by `bun run check:pure`), so it can
 * serve other renderers (React Native) as is.
 */
export {
  MODEL_VERSION,
  MODEL_FIELD_TYPES,
  RUNTIME,
  parseModel,
  isFormoModel,
  consoleWarning,
  type FormoModel,
  type ModelField,
  type ModelFieldType,
  type ModelItem,
  type ModelOption,
  type ModelConstraints,
  type ModelRule,
  type ModelRelation,
  type ModelWarning,
  type WarningHandler,
  type FieldRuntime,
  type ModelRuntime,
  type RuntimeRule,
  type RuntimeCallback,
  type RuntimeCallbackContext,
} from './ir'
export { formFromModel, findModelField, modelPath, METADATA_FIELDS, type FormFromModelOptions, type FieldOverride } from './form'
export { defaultPolicy, mergeSpec, proposeDriver, type ModelPolicy, type OptionsInput, type ValidationMode } from './policy'
export { toFormValues, pickFormValues, type ToFormValuesOptions } from './values'
export { fromJsonSchema, type JsonSchema, type FromJsonSchemaOptions } from './json-schema'
export { fromOpenApi, type FromOpenApiOptions } from './openapi'
export { fromLaravel, parseLaravelRule, type LaravelRulesInput, type FromLaravelOptions } from './laravel'
export { fromZod, type FromZodOptions, type ZodLikeSchema, type ZodLikeIssue, type ZodRefinement } from './zod'
export type { FieldSpec, SpecRule, SpecOption, SpecCondition, StandardSchemaLike } from './spec'
