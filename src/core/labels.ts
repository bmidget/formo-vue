import type { FormoConfig, FieldNode } from '../types'
import { humanize } from './utils'
import { getTranslator } from '../i18n/translator'

/**
 * Resolve a node's label:
 *
 *  1. an explicit `label` (`false`/`null` = no label)
 *  2. labels by path, `parent.alias`, then alias — from `config.labels`, the i18n
 *     bridge (`config.t`) and the locale catalogs (`locales.fr.labels`)
 *  3. the alias (humanized by default)
 *
 * Explicit and humanized labels go through `translate` / `locales.xx.texts`.
 */
export function resolveLabel(
  node: FieldNode,
  path: string,
  config: FormoConfig,
  parentAlias?: string | number,
): string {
  if (node.label === false || node.label === null) return ''
  const tr = getTranslator(config)

  // An explicit label is a translatable text (the text is the key, like Laravel's `__('Email')`, or a key for your i18n `translate`)
  if (typeof node.label === 'string') return tr.text(node.label)

  const genericPath = path.replace(/\[\d+\]/g, '')
  const keys = [path, genericPath, parentAlias !== undefined ? `${parentAlias}.${node.alias}` : '', String(node.alias)]
  const found = tr.label([...new Set(keys.filter(Boolean))])
  // Like Formo: the label file's text still goes through translation
  if (found) return tr.text(found)
  return tr.text(config.humanizeLabels ? humanize(node.alias) : String(node.alias))
}

/** Text for buttons: label, value, then the alias — translated */
export function resolveButtonText(node: FieldNode, config: FormoConfig): string {
  const raw =
    (typeof node.label === 'string' && node.label) ||
    (typeof node.val === 'string' && node.val) ||
    humanize(node.alias)
  return getTranslator(config).text(raw)
}
