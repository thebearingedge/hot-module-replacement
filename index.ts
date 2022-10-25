import fs from 'node:fs'
import url from 'node:url'
import path from 'node:path'
import http from 'node:http'
import esbuild from 'esbuild'
import { WebSocketServer } from 'ws'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    fs.createReadStream(path.join(__dirname, 'index.html'))
      .pipe(res.writeHead(200, {
        'Content-Type': 'text/html'
      }))
    return
  }

  if (req.url === '/main.ts') {
    fs.readFile(path.join(__dirname, 'main.ts'), (err, ts) => {
      if (err) {
        console.error(err)
        res.writeHead(500).end()
        return
      }
      esbuild
        .transform(ts, { loader: 'ts', sourcemap: 'inline', sourcefile: 'main.ts' })
        .then(({ code }) => res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(code))
        .catch(err => {
          console.error(err)
          res.writeHead(500).end()
        })
    })
    return
  }

  res.statusCode = 404
  res.end(`Cannot ${req.method} ${req.url}`)
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
