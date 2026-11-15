import type { RuntimeCallback, RuntimeRule } from './ir'

/**
 * What `formFromModel()` produces: a Formo form definition, framework-neutral.
 *
 * The subset of formo-vue's `FieldDef` that doesn't involve Vue: components and
 * views are referenced by name, rules are strings / objects / functions. It is
 * assignable to `FieldDef`, so it goes straight into `useFormo()`, `<FormoForm>`
 * or the `Formo` builder — and a future React Native renderer can read it too.
 */

/** A Standard Schema (zod, valibot, arktype…) */
export interface StandardSchemaLike {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (value: unknown) => unknown
  }
}

export type SpecRule =
  | string
  | RuntimeRule
  | { rule: string | RuntimeRule; params?: unknown[]; message?: string; label?: string }
  | StandardSchemaLike

export type SpecOption = { value: unknown; label: string; disabled?: boolean }

export type SpecCondition = boolean | { when: string; is?: unknown; not?: unknown; filled?: boolean }

export interface FieldSpec {
  alias?: string | number
  driver?: string
  val?: unknown
  label?: string | false | null
  message?: string
  /** `[{ value, label }]`, `['a', 'b']` or `{ value: label }` */
  opts?: SpecOption[] | Array<string | number> | Record<string, string>
  blank?: boolean | string
  attr?: Record<string, unknown>
  rules?: SpecRule[]
  required?: boolean
  errorMessages?: Record<string, string>
  editable?: boolean
  exclude?: SpecCondition
  filters?: string[]
  callbacks?: { pass?: RuntimeCallback[]; fail?: RuntimeCallback[] }
  config?: {
    messages?: Record<string, string>
    inputRules?: Record<string, never[]>
    htmlConstraintRules?: boolean
    /** What input names start with — `false`: bare names (`email`, `address[street]`) */
    namePrefix?: string | false
    request?: { rootKey?: string }
  }
  /** A component registered by name (`createFormo({ components })`) */
  component?: string
  /** A view name from the theme (`'floating'`), or `false` for the bare control */
  view?: string | false
  /** Children, keyed by alias */
  fields?: Record<string, FieldSpec>
  blueprint?: boolean
  min?: number
  max?: number
  [key: string]: unknown
}
