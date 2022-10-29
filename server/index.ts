import fs from 'node:fs'
import url from 'node:url'
import path from 'node:path'
import http from 'node:http'
import esbuild from 'esbuild'
import chokidar from 'chokidar'
import { WebSocketServer } from 'ws'

const clientDir = path.resolve(url.fileURLToPath(new URL('../client', import.meta.url)))

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
    if (path.extname(file) === '.ts') {
      const ts = await fs.promises.readFile(path.join(clientDir, file), 'utf8')
      const { code } = await esbuild.transform(ts, {
        loader: 'ts',
        sourcemap: 'inline',
        sourcefile: file,
        banner: WANTS_HMR.test(ts)
          ? `import{__hmr}from'/hmr.ts';import.meta.hot=__hmr('${file}')`
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

const wss = new WebSocketServer({ server, path: '/__hmr', clientTracking: true })

wss.once('connection', () => {
  setTimeout(() => {
    wss.clients.forEach(ws => ws.send(JSON.stringify({ type: 'reload' })))
  }, 100)
})

const watcher = chokidar.watch(['**/*.ts'], {
  cwd: clientDir,
  ignored: ['**/*.d.ts', 'hmr.ts'],
  awaitWriteFinish: {
    stabilityThreshold: 100
  }
})

watcher.on('change', path => {
  wss.clients.forEach(ws => ws.send(JSON.stringify({ type: 'update', url: `/${path}` })))
})

server.listen(3000, () => {
  console.log('listening on port 3000')
})
