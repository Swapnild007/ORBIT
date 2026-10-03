import type { NewsEvent, NewsCategory } from '@/types'
import { extractLocations } from './geo-extract'

/** Classify a GDELT article into a NewsCategory based on themes/title */
export function classifyArticle(title: string, themes: string[] = []): NewsCategory {
  const text = [title, ...themes].join(' ').toLowerCase()
  if (/\b(war|military|attack|bomb|strike|armed|weapon|troops|battle)\b/.test(text)) return 'conflict'
  if (/\b(elect|vote|parliament|government|president|minister|senate|congress|diplomacy|treaty)\b/.test(text)) return 'politics'
  if (/\b(earthquake|flood|hurricane|tornado|wildfire|tsunami|disaster|cyclone|eruption)\b/.test(text)) return 'disaster'
  if (/\b(economy|stock|market|trade|gdp|inflation|bank|finance|recession|tariff)\b/.test(text)) return 'economy'
  if (/\b(tech|cyber|ai|software|silicon|data|internet|computer|hack|robot)\b/.test(text)) return 'technology'
  if (/\b(health|disease|virus|pandemic|hospital|vaccine|medical|who|outbreak)\b/.test(text)) return 'health'
  if (/\b(climate|environment|pollution|carbon|emission|deforest|biodiversity|ocean)\b/.test(text)) return 'environment'
  return 'other'
}

interface GdeltArticle {
  url: string
  title: string
  seendate: string
  socialimage?: string
  domain?: string
  language?: string
  sourcecountry?: string
  tone?: number
  themes?: string[]
}

interface GdeltGeoEvent {
  lat: number
  lon: number
  name: string
  count: number
  tone: number
}

/** Parse GDELT Doc API response */
export function parseGdeltArticles(json: { articles?: GdeltArticle[] }): Omit<NewsEvent, 'lat' | 'lon'>[] {
  if (!json.articles) return []
  return json.articles.map((a, i) => ({
    id: `gdelt-art-${i}-${Date.now()}`,
    title: a.title ?? 'Untitled',
    url: a.url ?? '',
    source: a.domain ?? 'unknown',
    category: classifyArticle(a.title ?? '', a.themes),
    tone: a.tone ?? 0,
    articleCount: 1,
    imageUrl: a.socialimage || null,
    time: a.seendate ? new Date(a.seendate).getTime() : Date.now(),
    lastUpdate: Date.now(),
  }))
}

/** Parse GDELT Geo API GeoJSON response */
export function parseGdeltGeo(json: GeoJSON.FeatureCollection): NewsEvent[] {
  const events: NewsEvent[] = []
  if (!json.features) return events

  for (let i = 0; i < json.features.length; i++) {
    const f = json.features[i]
    if (!f.geometry || f.geometry.type !== 'Point') continue
    const coords = (f.geometry as GeoJSON.Point).coordinates
    const props = (f.properties ?? {}) as Record<string, unknown>
    const name = (props.name as string) ?? ''
    const tone = (props.tone as number) ?? 0
    const count = (props.count as number) ?? (props.articlecount as number) ?? 1
    const urllist = (props.urllist as string) ?? ''
    const url = urllist.split('<br/>')[0]?.trim() || ''

    events.push({
      id: `gdelt-geo-${i}-${Date.now()}`,
      title: name || `Event cluster (${count} articles)`,
      url,
      source: 'GDELT',
      category: classifyArticle(name),
      lat: coords[1],
      lon: coords[0],
      tone,
      articleCount: count,
      imageUrl: null,
      time: Date.now(),
      lastUpdate: Date.now(),
    })
  }

  return events
}

// ─── NewsData.io ──────────────────────────────────────────────────────────

interface NewsdataArticle {
  article_id?: string
  title?: string
  link?: string
  description?: string
  content?: string
  pubDate?: string
  image_url?: string | null
  source_id?: string
  country?: string[]
  category?: string[]
  sentiment?: string
}

export function parseNewsdataArticles(json: { results?: NewsdataArticle[] }): NewsEvent[] {
  if (!Array.isArray(json?.results)) return []
  const events: NewsEvent[] = []

  for (const a of json.results) {
    if (!a.title) continue
    const searchText = `${a.title} ${a.description ?? ''}`
    const locations = extractLocations(searchText)
    if (locations.length === 0) continue
    const loc = locations[0]

    events.push({
      id: `newsdata-${a.article_id ?? events.length}`,
      title: a.title,
      url: a.link ?? '',
      source: 'NewsData',
      category: classifyArticle(a.title, a.category),
      lat: loc.lat,
      lon: loc.lon,
      tone: a.sentiment === 'positive' ? 3 : a.sentiment === 'negative' ? -3 : 0,
      articleCount: 1,
      imageUrl: a.image_url || null,
      time: a.pubDate ? new Date(a.pubDate).getTime() : Date.now(),
      lastUpdate: Date.now(),
    })
  }
  return events
}

// ─── Currents API ─────────────────────────────────────────────────────────

interface CurrentsArticle {
  id?: string
  title?: string
  description?: string
  url?: string
  image?: string
  published?: string
  category?: string[]
  language?: string
}

export function parseCurrentsArticles(json: { news?: CurrentsArticle[] }): NewsEvent[] {
  if (!Array.isArray(json?.news)) return []
  const events: NewsEvent[] = []

  for (const a of json.news) {
    if (!a.title) continue
    const searchText = `${a.title} ${a.description ?? ''}`
    const locations = extractLocations(searchText)
    if (locations.length === 0) continue
    const loc = locations[0]

    events.push({
      id: `currents-${a.id ?? events.length}`,
      title: a.title,
      url: a.url ?? '',
      source: 'Currents',
      category: classifyArticle(a.title, a.category),
      lat: loc.lat,
      lon: loc.lon,
      tone: 0,
      articleCount: 1,
      imageUrl: a.image && a.image !== 'None' ? a.image : null,
      time: a.published ? new Date(a.published).getTime() : Date.now(),
      lastUpdate: Date.now(),
    })
  }
  return events
}

// ─── RSS Feed Parser ──────────────────────────────────────────────────────

export function parseRssItems(xml: string, sourceName: string): NewsEvent[] {
  const events: NewsEvent[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let match: RegExpExecArray | null

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const title = block.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/)?.[1]
      ?? block.match(/<title>(.*?)<\/title>/)?.[1] ?? ''
    const link = block.match(/<link>(.*?)<\/link>/)?.[1]
      ?? block.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? ''
    const desc = block.match(/<description><!\[CDATA\[(.*?)\]\]>|<description>(.*?)<\/description>/)?.[1]
      ?? block.match(/<description>(.*?)<\/description>/)?.[1] ?? ''
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? ''

    if (!title) continue
    const plainDesc = desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const searchText = `${title} ${plainDesc}`
    const locations = extractLocations(searchText)
    if (locations.length === 0) continue
    const loc = locations[0]

    events.push({
      id: `rss-${sourceName.toLowerCase().replace(/\s+/g, '')}-${events.length}-${Date.now()}`,
      title,
      url: link,
      source: sourceName,
      category: classifyArticle(title),
      lat: loc.lat,
      lon: loc.lon,
      tone: 0,
      articleCount: 1,
      imageUrl: null,
      time: pubDate ? new Date(pubDate).getTime() : Date.now(),
      lastUpdate: Date.now(),
    })
  }
  return events
}
