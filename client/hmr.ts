class HotModuleWebSocket extends EventTarget {

  private _socket: WebSocket
  private _listeners: OnMessage[] = []
  private _messageQueue: Message[] = []

  constructor(url: string) {
    super()
    const connect = (): WebSocket => {
      let socket = new WebSocket(url)
      socket.addEventListener('open', () => {
        console.log(`[HMR] - connected to server at ${url}`)
        this._messageQueue.forEach(message => this.send(message))
        this._messageQueue = []
      }, { once: true })
      socket.addEventListener('message', ({ data }) => {
        const message = JSON.parse(data)
        this._listeners.forEach(listener => listener(message))
      })
      socket.addEventListener('close', () => {
        console.log(`[HMR] - reconnecting...`)
        setTimeout(() => { this._socket = connect() }, 1000)
      }, { once: true })
      return socket
    }
    this._socket = connect()
  }

  listen(onMessage: (message: Message) => void): void {
    this._listeners.push(onMessage)
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
  console.log(`[HMR] - received "update" ${message.url}`)
  handleUpdate(message.url)
})

const hotModules = new Map<string, HotModule>()

async function handleUpdate(url: string): Promise<void> {
  const mod = hotModules.get(url)
  if (mod == null) return
  mod.disposes.splice(0).forEach(dispose => dispose(mod.data))
  const updatedAt = Date.now()
  for (const { deps, callback } of mod.accepts.splice(0)) {
    const modules = await Promise.all(deps.map(url => (
      import(`${url}?q=${updatedAt}`)
    )))
    callback(modules)
  }
}

export function createHotContext(url: string): HotContext {
  const mod = hotModules.get(url)
  mod != null && (mod.accepts = [])
  return new HotContext(url)
}

export class HotContext {

  constructor(private url: string) {}

  acceptDeps(deps: string[], callback: AcceptCallback['callback'] = () => {}) {
    const mod: HotModule = hotModules.get(this.url) ?? {
      url: this.url,
      accepts: [],
      disposes: []
    }
    mod.accepts.push({ deps, callback })
    hotModules.set(this.url, mod)
  }

  accept(): void
  accept(callback: (mod: ModuleNamespace | undefined) => void): void
  accept(dep: string, callback: (mod: ModuleNamespace | undefined) => void): void
  accept(deps: readonly string[], callback: (mods: ModuleNamespace[] | undefined) => void): void
  accept(deps?: any, callback?: (...args: any[]) => void): void {
    if (deps == null || typeof deps === 'function') {
      this.acceptDeps([this.url], ([mod]) => deps?.(mod))
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

  dispose(callback: DisposeCallback): void {
    const mod: HotModule = hotModules.get(this.url) ?? {
      url: this.url,
      accepts: [],
      disposes: []
    }
    mod.disposes.push(callback)
  }

  invalidate(): void {
    // TODO: tell the server to re-perform hmr propagation from this module as root
  }

}

type Message =
  | { type: 'reload' }
  | { type: 'update', url: string }

type OnMessage = (message: Message) => void

type ModuleNamespace = Record<string, any> & {
  [Symbol.toStringTag]: 'Module'
}

type AcceptCallback = {
  deps: string[]
  callback: (modules: Array<ModuleNamespace | undefined>) => void
}

type DisposeCallback = (data: any) => void

type HotModule = {
  url: string
  data?: any
  accepts: AcceptCallback[]
  disposes: DisposeCallback[]
}
