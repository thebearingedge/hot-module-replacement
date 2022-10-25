let socket = (function connect(): WebSocket {

  const SOCKET_URL = `ws://${window.location.host}/__hmr`
  const _socket = new WebSocket(SOCKET_URL)

  _socket.addEventListener('open', event => {
    console.log(`[HMR] - connected to server at ${SOCKET_URL}...`)
  })

  _socket.addEventListener('close', event => {
    console.log('[HMR] - reconnecting...')
    setTimeout(() => { socket = connect() }, 1000)
  })

  return _socket
})()
