let client: HotClient

export function __hmr(url: string): HotContext {
  client ??= new HotClient(`ws://${window.location.host}`)
  const mod = client.register(url)
  mod != null && (mod.accepts = [])
  return new HotContext(url, client)
}

type HotModule = {
  url: string
  data?: any
  accepts: AcceptCallback[]
  dispose?: DisposeCallback
}

type Message =
  | { type: 'reload' }
  | { type: 'update', url: string }

class HotClient {

  #address: string
  #socket: WebSocket
  #messageQueue: Message[] = []
  modules: Map<string, HotModule> = new Map()

  constructor(address: string) {
    this.#address = address
    this.#socket = this.#connect(address)
  }

  send(message: Message): void {
    if (this.#socket.readyState !== WebSocket.OPEN) {
      this.#messageQueue.push(message)
    } else {
      this.#socket.send(JSON.stringify(message))
    }
  }

  register(url: string): HotModule {
    let mod = this.modules.get(url)
    if (mod != null) return mod
    mod = { url, accepts: [] }
    this.modules.set(url, mod)
    return mod
  }

  registerAccept(id: string, callback: AcceptCallback): void {
    const mod = this.register(id)
    mod.accepts.push(callback)
  }

  registerDispose(id: string, callback: DisposeCallback): void {
    const mod = this.register(id)
    mod.dispose = callback
  }

  #connect(address: string): WebSocket {
    const socket = new WebSocket(address, 'hot-module-replacement')
    socket.addEventListener('message', this.#handleMessage)
    socket.addEventListener('open', this.#handleOpen, { once: true })
    socket.addEventListener('close', this.#handleClose, { once: true })
    return socket
  }

  #handleOpen = (): void => {
    this.#log('connected')
    this.#messageQueue.forEach(message => this.send(message))
    this.#messageQueue = []
  }

  #handleClose = (): void => {
    this.#log('reconnecting...')
    setTimeout(() => (this.#socket = this.#connect(this.#address)), 1000)
  }

  #handleMessage = async ({ data }: MessageEvent): Promise<void> => {
    const payload = JSON.parse(data)
    if (payload.type === 'reload') {
      this.#log('received "reload"')
      setTimeout(() => window.location.reload(), 1000)
      return
    }
    if (payload.type !== 'update') {
      this.#error('received unknown', payload)
      return
    }
    const mod = this.modules.get(payload.url)
    if (mod == null) return
    await mod.dispose?.(mod.data)
    const time = Date.now()
    for (const { deps, callback } of mod.accepts.splice(0)) {
      const modules = await Promise.all(deps.map(url => import(`${url}?t=${time}`)))
      callback(modules)
    }
    this.#log(`updated ${payload.url}`)
  }

  #log(...args: any[]): void {
    console.log('[HMR] -', ...args)
  }

  #error(...args: any[]): void {
    console.error('[HMR] -', ...args)
  }

}

type ModuleNamespace = Record<string, any> & {
  [Symbol.toStringTag]: 'Module'
}

type AcceptCallback = {
  deps: string[]
  callback: (modules: Array<ModuleNamespace | undefined>) => void
}

type DisposeCallback = (data: any) => void | Promise<void>

export class HotContext {

  #id: string
  #client: HotClient

  constructor(id: string, client: HotClient) {
    this.#id = id
    this.#client = client
  }

  #acceptDeps(deps: string[], callback: AcceptCallback['callback'] = () => {}) {
    this.#client.registerAccept(this.#id, { deps, callback })
  }

  accept(): void
  accept(callback: (mod: ModuleNamespace | undefined) => void): void
  accept(dep: string, callback: (mod: ModuleNamespace | undefined) => void): void
  accept(deps: readonly string[], callback: (mods: ModuleNamespace[] | undefined) => void): void
  accept(deps?: any, callback?: (...args: any[]) => void): void {
    if (deps == null || typeof deps === 'function') {
      this.#acceptDeps([this.#id], ([mod]) => deps?.(mod))
      return
    }
    if (typeof deps === 'string') {
      this.#acceptDeps([deps], ([mod]) => callback?.(mod))
      return
    }
    if (Array.isArray(deps)) {
      this.#acceptDeps(deps, callback)
      return
    }
    throw new Error('invalid call to hot.accept()')
  }

  dispose(callback: DisposeCallback): void {
    this.#client.registerDispose(this.#id, callback)
  }

  invalidate(): void {
    // TODO: tell the server to re-perform hmr propagation from this module as root
  }

}
