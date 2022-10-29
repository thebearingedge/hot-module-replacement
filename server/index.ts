import fs from 'node:fs'
import url from 'node:url'
import path from 'node:path'
import http from 'node:http'
import esbuild from 'esbuild'
import chokidar from 'chokidar'
import { WebSocketServer } from 'ws'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const clientDir = path.resolve(__dirname, '..', 'client')

const WANTS_HMR = /if\s*\(import\.meta\.hot\)/

const server = http.createServer(async (req, res) => {
  const { pathname: file } = new URL(`req://${req.url ?? '/'}`)
  try {
    if (file === '/') {
      fs.createReadStream(path.join(clientDir, 'index.html'))
        .pipe(res.writeHead(200, {
          'Content-Type': 'text/html'
        }))
      return
    }
    if (file === '/__hmr-client.ts') {
      const ts = await fs.promises.readFile(path.join(__dirname, file), 'utf8')
      const { code } = await esbuild.transform(ts, {
        loader: 'ts',
        sourcemap: 'inline',
        sourcefile: file,
      })
      res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(code)
      return
    }
    if (path.extname(file) === '.ts') {
      const ts = await fs.promises.readFile(path.join(clientDir, file), 'utf8')
      const { code } = await esbuild.transform(ts, {
        loader: 'ts',
        sourcemap: 'inline',
        sourcefile: file,
        banner: WANTS_HMR.test(ts)
          ? `import{__hmr}from'/__hmr-client.ts';import.meta.hot=__hmr('${file}')`
          : ''
      })
      res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(code)
      return
    }
    res.statusCode = 404
    res.end(`Cannot ${req.method} ${req.url}`)
  } catch (err) {
    console.error(err)
    res.writeHead(500).end()
  }
})

const wss = new WebSocketServer({
  noServer: true,
  clientTracking: true
})

wss.once('connection', () => {
  setTimeout(() => {
    wss.clients.forEach(ws => ws.send(JSON.stringify({ type: 'reload' })))
  }, 100)
})

const watcher = chokidar.watch(['**/*.ts'], {
  cwd: clientDir,
  awaitWriteFinish: {
    stabilityThreshold: 100
  }
})

watcher.on('change', path => {
  wss.clients.forEach(ws => ws.send(JSON.stringify({ type: 'update', url: `/${path}` })))
})

server.on('upgrade', (req, socket, head) => {
  if (req.headers['sec-websocket-protocol'] === 'hot-module-replacement') {
    wss.handleUpgrade(req, socket, head, (ws, req) => wss.emit('connection', ws, req))
  }
})

server.listen(3000, () => {
  console.log('listening on port 3000')
})
