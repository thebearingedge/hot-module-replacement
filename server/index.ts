import fs from 'node:fs'
import url from 'node:url'
import path from 'node:path'
import http from 'node:http'
import esbuild from 'esbuild'
import { WebSocketServer } from 'ws'

const clientDir = path.resolve(url.fileURLToPath(new URL('../client', import.meta.url)))

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
          ? `import{createHotContext}from'/hmr.ts';import.meta.hot=createHotContext('${url}')`
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

const wss = new WebSocketServer({ server, path: '/__hmr' })

wss.on('connection', (_ws, _req) => {
  console.log('[HMR] - client connected...')
})

server.listen(3000, () => {
  console.log('listening on port 3000')
})
