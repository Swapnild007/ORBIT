/**
 * End-to-end test for the hexdb proxy server.
 * Run: bun run test-hexdb.ts
 * Requires: hexdb-proxy server running on port 4003
 */

const PROXY = 'http://localhost:4003'
const TEST_HEX = 'A63DF3' // N501DA - Delta Air Lines A321
const TEST_CALLSIGN = 'DAL' // Delta callsign prefix

let passed = 0
let failed = 0

function assert(condition: boolean, msg: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`)
    passed++
  } else {
    console.log(`  ✗ ${msg}${detail ? ` — ${detail}` : ''}`)
    failed++
  }
}

async function testLookup() {
  console.log('\n── /lookup endpoint ──')

  // Test basic lookup
  const res = await fetch(`${PROXY}/lookup?hex=${TEST_HEX}&callsign=${TEST_CALLSIGN}`)
  assert(res.ok, `GET /lookup returns 200 (got ${res.status})`)

  const data = await res.json()
  console.log('  Response:', JSON.stringify(data, null, 2))

  // Aircraft data
  assert(data.aircraft !== null, 'aircraft is not null')
  if (data.aircraft) {
    assert(data.aircraft.Registration === 'N501DA', `Registration is N501DA (got ${data.aircraft.Registration})`)
    assert(data.aircraft.Manufacturer === 'Airbus', `Manufacturer is Airbus (got ${data.aircraft.Manufacturer})`)
    assert(data.aircraft.RegisteredOwners === 'Delta Air Lines', `Owner is Delta (got ${data.aircraft.RegisteredOwners})`)
  }

  // hasImage flag
  assert(typeof data.hasImage === 'boolean', `hasImage is boolean (got ${typeof data.hasImage})`)
  assert(data.hasImage === true, `hasImage is true for N501DA (got ${data.hasImage})`)

  // Route (may or may not have data depending on active flights)
  console.log(`  ℹ route: ${data.route ? JSON.stringify(data.route) : 'null (no active route)'}`)
  console.log(`  ℹ origin: ${data.origin ? data.origin.airport : 'null'}`)
  console.log(`  ℹ destination: ${data.destination ? data.destination.airport : 'null'}`)
}

async function testImage() {
  console.log('\n── /image endpoint ──')

  const res = await fetch(`${PROXY}/image?hex=${TEST_HEX}`)
  assert(res.ok, `GET /image returns 200 (got ${res.status})`)

  const contentType = res.headers.get('Content-Type')
  assert(contentType?.includes('image/') === true, `Content-Type is image/* (got ${contentType})`)

  const cors = res.headers.get('Access-Control-Allow-Origin')
  assert(cors === '*', `CORS header present (got ${cors})`)

  const body = await res.arrayBuffer()
  assert(body.byteLength > 1000, `Image body has content (${body.byteLength} bytes)`)

  // Check JPEG magic bytes
  const bytes = new Uint8Array(body)
  const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8
  assert(isJpeg, `Body starts with JPEG magic bytes (got 0x${bytes[0]?.toString(16)},0x${bytes[1]?.toString(16)})`)
}

async function testImageNotFound() {
  console.log('\n── /image 404 for unknown hex ──')

  const res = await fetch(`${PROXY}/image?hex=000000`)
  assert(res.status === 404, `GET /image returns 404 for unknown hex (got ${res.status})`)
}

async function testLookupNoImage() {
  console.log('\n── /lookup for hex without image ──')

  // Use a hex that likely has aircraft data but no image
  const res = await fetch(`${PROXY}/lookup?hex=000001`)
  assert(res.ok, `GET /lookup returns 200 even for unknown hex (got ${res.status})`)

  const data = await res.json()
  // Should not crash, just return nulls
  assert(data.aircraft === null || data.aircraft !== undefined, 'aircraft field exists')
  console.log(`  ℹ hasImage: ${data.hasImage}`)
}

async function testDirectHexdbImageEndpoint() {
  console.log('\n── Direct hexdb.io verification ──')

  // Step 1: hex-image-thumb returns a URL, not an image
  const thumbRes = await fetch(`https://hexdb.io/hex-image-thumb?hex=${TEST_HEX}`)
  assert(thumbRes.ok, `hexdb.io thumb endpoint returns 200 (got ${thumbRes.status})`)

  const thumbText = (await thumbRes.text()).trim()
  assert(thumbText.startsWith('http'), `Response is a URL (got "${thumbText.substring(0, 80)}")`)
  console.log(`  ℹ Resolved URL: ${thumbText}`)

  // Step 2: The resolved URL should return actual image bytes
  const imgRes = await fetch(thumbText)
  assert(imgRes.ok, `Resolved image URL returns 200 (got ${imgRes.status})`)

  const imgType = imgRes.headers.get('Content-Type')
  assert(imgType?.includes('image/') === true, `Resolved URL returns image/* (got ${imgType})`)

  const imgBody = await imgRes.arrayBuffer()
  assert(imgBody.byteLength > 1000, `Image has content (${imgBody.byteLength} bytes)`)
}

async function main() {
  console.log('=== HexDB Proxy Test Suite ===')

  // First check if proxy is running
  try {
    const check = await fetch(`${PROXY}/lookup?hex=test`)
    await check.text()
  } catch (e) {
    console.error(`\n✗ Cannot connect to proxy at ${PROXY}. Is hexdb-proxy running?`, e)
    process.exit(1)
  }

  await testDirectHexdbImageEndpoint()
  await testLookup()
  await testImage()
  await testImageNotFound()
  await testLookupNoImage()

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
