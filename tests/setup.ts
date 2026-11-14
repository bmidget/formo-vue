import { config } from '@vue/test-utils'

// Any Vue warning is a bug: fail the test
config.global.config.warnHandler = (msg) => {
  throw new Error(`[Vue warn] ${msg}`)
}
