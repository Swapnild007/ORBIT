const API_KEY = process.env.AIS_API_KEY
if (!API_KEY) {
  console.error('Missing AIS_API_KEY environment variable')
  process.exit(1)
}

const clients = new Set<import('bun').ServerWebSocket<unknown>>()

// Connect to AISStream
let upstream: WebSocket | null = null

function connectUpstream() {
  upstream = new WebSocket('wss://stream.aisstream.io/v0/stream')

  upstream.onopen = () => {
    console.log('[AIS] Connected to AISStream.io')
    upstream!.send(JSON.stringify({
      APIKey: API_KEY,
      BoundingBoxes: [[[-90, -180], [90, 180]]],
      FilterMessageTypes: ['PositionReport'],
    }))
  }

  let relayCount = 0

  upstream.onmessage = (event) => {
    const data = typeof event.data === 'string'
      ? event.data
      : Buffer.isBuffer(event.data)
        ? event.data.toString()
        : String(event.data)

    for (const client of clients) {
      try {
        client.send(data)
      } catch {
        // Client may be closing — skip it
      }
    }

    relayCount++
    if (relayCount % 100 === 0) {
      console.log(`[AIS] Relayed ${relayCount} messages`)
    }
  }

  upstream.onclose = () => {
    console.log('[AIS] Upstream closed, reconnecting in 5s...')
    setTimeout(connectUpstream, 5000)
  }

  upstream.onerror = (err) => {
    console.error('[AIS] Upstream error:', err)
  }
}

connectUpstream()

// Local WebSocket server for browser clients
Bun.serve({
  port: 4001,
  fetch(req, server) {
    if (server.upgrade(req)) return
    return new Response('AIS Proxy WebSocket server', { status: 200 })
  },
  websocket: {
    open(ws) {
      clients.add(ws)
      console.log(`[AIS] Client connected (${clients.size} total)`)
    },
    close(ws) {
      clients.delete(ws)
      console.log(`[AIS] Client disconnected (${clients.size} total)`)
    },
    message() {
      // Browser clients don't send messages
    },
  },
})

console.log('[AIS] Proxy listening on ws://localhost:4001')
