import type { HotContext } from './hmr'

declare global {
  interface ImportMeta {
    hot: HotContext
  }
}
