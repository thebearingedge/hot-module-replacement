import type { HotContext } from './hmr.js'

declare global {
  interface ImportMeta {
    hot: HotContext
  }
}
