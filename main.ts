class HotModuleWebSocket extends EventTarget {

  private _socket: WebSocket
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



class HotModuleContext implements IHotModuleContext {

  constructor(private moduleId: string) {}

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
  console.log('[HMR] - received "update"')
})

type Message =
  | { type: 'reload' }
  | { type: 'update', url: string }

type ModuleNamespace = Record<string, any> & {
  [Symbol.toStringTag]: 'Module'
}

interface IHotModuleContext {
  readonly data: any

  accept(): void
  accept(cb: (mod: ModuleNamespace | undefined) => void): void
  accept(dep: string, cb: (mod: ModuleNamespace | undefined) => void): void
  accept(
    deps: readonly string[],
    cb: (mods: Array<ModuleNamespace | undefined>) => void
  ): void

  dispose(cb: (data: any) => void): void

  decline(): void

  invalidate(): void
}
