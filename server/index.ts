import fs from 'node:fs'
import url from 'node:url'
import path from 'node:path'
import http from 'node:http'
import esbuild from 'esbuild'
import { WebSocketServer } from 'ws'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const clientDir = path.resolve(__dirname, '..', 'client')

const WANTS_HMR = /if\s*\(import\.meta\.hot\)/

const server = http.createServer(async (req, res) => {
  const { url = '/' } = req
  try {
    if (url === '/') {
      fs.createReadStream(path.join(clientDir, 'index.html'))
        .pipe(res.writeHead(200, {
          'Content-Type': 'text/html'
        }))
      return
    }
    if (path.extname(url) === '.ts') {
      const ts = await fs.promises.readFile(path.join(clientDir, url), 'utf8')
      const { code } = await esbuild.transform(ts, {
        loader: 'ts',
        sourcemap: 'inline',
        sourcefile: url,
        banner: WANTS_HMR.test(ts)
          ? `import{createHotContext}from'./hmr.ts';import.meta.hot=createHotContext('${req.url}')`
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

server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/__hmr') return
  wss.handleUpgrade(req, socket, head, ws => {
    console.log('[HMR] - client connected...')
    wss.emit('connection', ws, req)
  })
})

const wss = new WebSocketServer({ noServer: true })

server.listen(3000, () => {
  console.log('listening on port 3000')
})

type HotModule = {
  isDirty: boolean
  isHotEnabled: boolean
  isHotAccepted: boolean
  dependents: Set<string>
  dependencies: Set<string>
}

type HotModuleGraph = Map<string, HotModule>
