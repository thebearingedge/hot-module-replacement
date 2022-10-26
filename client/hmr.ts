class HotModuleWebSocket {

  private _socket: WebSocket
  private _messageQueue: Message[] = []

  constructor(url: string) {
    const connect = (): WebSocket => {
      let socket = new WebSocket(url)
      socket.addEventListener('open', () => {
        console.log(`[HMR] - connected to server at ${url}`)
        this._messageQueue.forEach(message => this.send(message))
        this._messageQueue = []
      }, { once: true })
      socket.addEventListener('close', () => {
        console.log(`[HMR] - reconnecting...`)
        setTimeout(() => { this._socket = connect() }, 1000)
      }, { once: true })
      return socket
    }
    this._socket = connect()
  }

  listen(onMessage: (message: Message) => void): void {
    this._socket.addEventListener('message', ({ data }) => {
      onMessage(JSON.parse(data) as Message)
    })
  }

  send(message: Message): void {
    if (this._socket.readyState !== WebSocket.OPEN) {
      this._messageQueue.push(message)
    } else {
      this._socket.send(JSON.stringify(message))
    }
  }

}

const socket = new HotModuleWebSocket(`ws://${window.location.host}/__hmr`)

socket.listen(message => {
  if (message.type === 'reload') {
    console.log('[HMR] - received "reload"')
    window.location.reload()
    return
  }
  if (message.type !== 'update') {
    console.error('[HMR] - received unknown', message)
    return
  }
  // TODO: apply update
  console.log('[HMR] - received "update"')
})

const hotModules = new Map<string, HotModule>()
const hotData = new Map<string, Record<string, any>>()
const disposeCallbacks = new Map<string, (data: unknown) => void | Promise<void>>()

export function createHotContext(moduleId: string): HotContext {
  hotData.set(moduleId, hotData.get(moduleId) ?? {})
  const mod = hotModules.get(moduleId)
  mod != null && (mod.callbacks = [])
  return new HotContext(moduleId)
}

export class HotContext {

  constructor(private moduleId: string) {}

  get data(): any {
    return hotData.get(this.moduleId)
  }

  acceptDeps(deps: string[], fn: HotCallback['fn'] = () => {}) {
    const mod: HotModule = hotModules.get(this.moduleId) ?? {
      moduleId: this.moduleId,
      callbacks: []
    }
    mod.callbacks.push({ deps, fn })
    hotModules.set(this.moduleId, mod)
    console.log('[HMR] - registered', this.moduleId)
  }

  accept(): void
  accept(callback: (mod: ModuleNamespace | undefined) => void): void
  accept(dep: string, callback: (mod: ModuleNamespace | undefined) => void): void
  accept(deps: readonly string[], callback: (mods: ModuleNamespace[] | undefined) => void): void
  accept(deps?: any, callback?: (...args: any[]) => void): void {
    if (deps == null || typeof deps === 'function') {
      this.acceptDeps([this.moduleId], ([mod]) => deps?.(mod))
      return
    }
    if (typeof deps === 'string') {
      this.acceptDeps([deps], ([mod]) => callback?.(mod))
      return
    }
    if (Array.isArray(deps)) {
      this.acceptDeps(deps, callback)
      return
    }
    throw new Error('invalid call to hot.accept()')
  }

  dispose(callback: (data: any) => void): void {
    disposeCallbacks.set(this.moduleId, callback)
  }

  invalidate(): void {
    // TODO: tell the server to re-perform hmr propagation from this module as root
  }

}

type Message =
  | { type: 'reload' }
  | { type: 'update', url: string }

type ModuleNamespace = Record<string, any> & {
  [Symbol.toStringTag]: 'Module'
}

type HotCallback = {
  deps: string[]
  fn: (modules: Array<ModuleNamespace | undefined>) => void
}

type HotModule = {
  moduleId: string
  callbacks: HotCallback[]
}
