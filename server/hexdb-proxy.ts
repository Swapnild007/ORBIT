const HEXDB = 'https://hexdb.io'
const PORT = 4003

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/** hexdb.io/hex-image-thumb returns a text URL to the actual image, not the image itself */
async function resolveImageUrl(hex: string): Promise<string | null> {
  try {
    const res = await fetch(`${HEXDB}/hex-image-thumb?hex=${hex}`)
    if (!res.ok) return null
    const text = (await res.text()).trim()
    // Response is a URL like "https://hexdb.io/static/aircraft-images/N501DA-thumb.jpg"
    return text.startsWith('http') ? text : null
  } catch {
    return null
  }
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    // GET /lookup?hex=ICAO24&callsign=CALLSIGN
    // Returns all hexdb data in a single response
    if (url.pathname === '/lookup') {
      const hex = (url.searchParams.get('hex') ?? '').toUpperCase()
      if (!hex) return Response.json({ error: 'hex required' }, { status: 400 })
      const callsign = (url.searchParams.get('callsign') ?? '').trim()

      // Fetch aircraft + route in parallel
      const [aircraft, route] = await Promise.all([
        fetchJson(`${HEXDB}/api/v1/aircraft/${hex}`),
        callsign ? fetchJson(`${HEXDB}/api/v1/route/icao/${callsign}`) : null,
      ])

      // Fetch airports if route found
      let origin = null
      let destination = null
      const routeStr = (route as { route?: string })?.route
      if (routeStr) {
        const parts = routeStr.split('-')
        if (parts.length === 2) {
          ;[origin, destination] = await Promise.all([
            fetchJson(`${HEXDB}/api/v1/airport/icao/${parts[0]}`),
            fetchJson(`${HEXDB}/api/v1/airport/icao/${parts[1]}`),
          ])
        }
      }

      // Check image availability by resolving the actual image URL
      const imageUrl = await resolveImageUrl(hex)
      const hasImage = imageUrl !== null

      return Response.json(
        { aircraft, route, origin, destination, hasImage },
        { headers: { 'Access-Control-Allow-Origin': '*' } },
      )
    }

    // GET /image?hex=ICAO24 — resolve the image URL then proxy the actual image
    if (url.pathname === '/image') {
      const hex = (url.searchParams.get('hex') ?? '').toUpperCase()
      if (!hex) return new Response('hex required', { status: 400 })

      const realUrl = await resolveImageUrl(hex)
      if (!realUrl) return new Response('not found', { status: 404 })

      try {
        const imgRes = await fetch(realUrl)
        if (!imgRes.ok) return new Response('not found', { status: 404 })

        return new Response(imgRes.body, {
          headers: {
            'Content-Type': imgRes.headers.get('Content-Type') ?? 'image/jpeg',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=86400',
          },
        })
      } catch {
        return new Response('fetch error', { status: 502 })
      }
    }

    return new Response('not found', { status: 404 })
  },
})

console.log(`[HexDB] Proxy listening on :${PORT}`)
