import type { HotContext } from '~/server/__hmr-client'

declare global {
  interface ImportMeta {
    hot: HotContext
  }
}
