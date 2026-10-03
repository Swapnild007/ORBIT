import { extractLocations } from './geo-extract'

export interface OsintMedia {
  type: 'image' | 'video'
  url: string
  previewUrl?: string
  alt?: string
}

export interface OsintLinkCard {
  url: string
  title: string
  description: string
  image?: string
}

export interface OsintComment {
  id: string
  author: string
  text: string
  htmlContent?: string
  time: number
  score?: number
  replies?: OsintComment[]
}

export interface OsintPost {
  id: string
  platform: 'reddit' | 'mastodon' | 'bluesky'
  author: string
  text: string
  fullText: string
  htmlContent?: string
  url: string
  lat: number
  lon: number
  locationName: string
  time: number
  lastUpdate: number
  media: OsintMedia[]
  linkCard?: OsintLinkCard
  score?: number
  commentCount?: number
  repostCount?: number
  subreddit?: string
  tags?: string[]
}

export function parseRedditPosts(json: unknown): OsintPost[] {
  const data = json as { data?: { children?: Array<{ data: {
    id?: string; author?: string; title?: string; selftext?: string
    url?: string; permalink?: string; created_utc?: number
    score?: number; num_comments?: number; subreddit?: string
    is_self?: boolean; post_hint?: string
    thumbnail?: string; url_overridden_by_dest?: string
    preview?: { images?: Array<{ source?: { url?: string; width?: number; height?: number } }> }
  } }> } }

  if (!Array.isArray(data?.data?.children)) return []

  const posts: OsintPost[] = []
  for (const child of data.data!.children!) {
    const d = child.data
    if (!d.title) continue
    const searchText = `${d.title} ${d.selftext ?? ''}`
    const locations = extractLocations(searchText)
    if (locations.length === 0) continue

    const loc = locations[0]

    // Extract media
    const media: OsintMedia[] = []
    if (d.preview?.images?.length) {
      for (const img of d.preview.images) {
        if (img.source?.url) {
          media.push({ type: 'image', url: img.source.url.replace(/&amp;/g, '&'), alt: d.title })
        }
      }
    } else if (d.post_hint === 'image' && d.url_overridden_by_dest) {
      media.push({ type: 'image', url: d.url_overridden_by_dest, alt: d.title })
    }

    // Extract link card for non-self posts
    let linkCard: OsintLinkCard | undefined
    if (!d.is_self && d.url_overridden_by_dest) {
      const thumb = d.thumbnail && !['self', 'default', 'nsfw', 'spoiler', ''].includes(d.thumbnail) ? d.thumbnail : undefined
      linkCard = {
        url: d.url_overridden_by_dest,
        title: d.title ?? '',
        description: '',
        image: thumb,
      }
    }

    posts.push({
      id: `reddit-${d.id}`,
      platform: 'reddit',
      author: d.author ?? 'unknown',
      text: d.title ?? '',
      fullText: d.selftext ?? '',
      url: d.permalink ? `https://reddit.com${d.permalink}` : d.url ?? '',
      lat: loc.lat,
      lon: loc.lon,
      locationName: loc.name,
      time: (d.created_utc ?? 0) * 1000,
      lastUpdate: Date.now(),
      media,
      linkCard,
      score: d.score,
      commentCount: d.num_comments,
      subreddit: d.subreddit,
    })
  }

  return posts
}

export function parseMastodonPosts(json: unknown): OsintPost[] {
  const data = json as Array<{
    id?: string; content?: string; url?: string; created_at?: string
    account?: { acct?: string }
    media_attachments?: Array<{
      type?: string; url?: string; preview_url?: string; description?: string
    }>
    card?: {
      url?: string; title?: string; description?: string; image?: string
    }
    favourites_count?: number; replies_count?: number; reblogs_count?: number
    tags?: Array<{ name?: string }>
  }>

  if (!Array.isArray(data)) return []

  const posts: OsintPost[] = []
  for (const item of data) {
    if (!item.content) continue
    const plainText = item.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const locations = extractLocations(plainText)
    if (locations.length === 0) continue

    const loc = locations[0]

    // Extract media
    const media: OsintMedia[] = []
    if (item.media_attachments?.length) {
      for (const att of item.media_attachments) {
        if (att.url && (att.type === 'image' || att.type === 'video')) {
          media.push({
            type: att.type as 'image' | 'video',
            url: att.url,
            previewUrl: att.preview_url ?? undefined,
            alt: att.description ?? undefined,
          })
        }
      }
    }

    // Extract link card
    let linkCard: OsintLinkCard | undefined
    if (item.card?.url) {
      linkCard = {
        url: item.card.url,
        title: item.card.title ?? '',
        description: item.card.description ?? '',
        image: item.card.image ?? undefined,
      }
    }

    const tags = item.tags?.map(t => t.name).filter((n): n is string => !!n)

    posts.push({
      id: `mast-${item.id}`,
      platform: 'mastodon',
      author: item.account?.acct ?? 'unknown',
      text: plainText.slice(0, 200),
      fullText: plainText,
      htmlContent: item.content,
      url: item.url ?? '',
      lat: loc.lat,
      lon: loc.lon,
      locationName: loc.name,
      time: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
      lastUpdate: Date.now(),
      media,
      linkCard,
      score: item.favourites_count,
      commentCount: item.replies_count,
      repostCount: item.reblogs_count,
      tags: tags?.length ? tags : undefined,
    })
  }

  return posts
}

export function parseBlueskyPosts(json: unknown): OsintPost[] {
  // Support both search format ({ posts: [...] }) and feed format ({ feed: [{ post: ... }] })
  const data = json as {
    posts?: Array<{
      uri?: string; cid?: string
      record?: { text?: string; createdAt?: string; facets?: Array<{
        features?: Array<{ $type?: string; tag?: string }>
      }> }
      author?: { handle?: string }
      embed?: {
        $type?: string
        images?: Array<{ thumb?: string; alt?: string; fullsize?: string }>
        external?: { uri?: string; title?: string; description?: string; thumb?: string }
      }
      likeCount?: number; replyCount?: number; repostCount?: number
    }>
    feed?: Array<{ post: {
      uri?: string; cid?: string
      record?: { text?: string; createdAt?: string; facets?: Array<{
        features?: Array<{ $type?: string; tag?: string }>
      }> }
      author?: { handle?: string }
      embed?: {
        $type?: string
        images?: Array<{ thumb?: string; alt?: string; fullsize?: string }>
        external?: { uri?: string; title?: string; description?: string; thumb?: string }
      }
      likeCount?: number; replyCount?: number; repostCount?: number
    } }>
  }

  const rawPosts = data?.posts ?? data?.feed?.map(f => f.post) ?? []
  if (!Array.isArray(rawPosts)) return []

  const posts: OsintPost[] = []
  for (const item of rawPosts) {
    const text = item.record?.text ?? ''
    if (!text) continue
    const locations = extractLocations(text)
    if (locations.length === 0) continue

    const loc = locations[0]

    // Extract media from embed
    const media: OsintMedia[] = []
    if (item.embed?.images?.length) {
      for (const img of item.embed.images) {
        if (img.thumb || img.fullsize) {
          media.push({
            type: 'image',
            url: img.fullsize ?? img.thumb!,
            previewUrl: img.thumb ?? undefined,
            alt: img.alt ?? undefined,
          })
        }
      }
    }

    // Extract link card from embed
    let linkCard: OsintLinkCard | undefined
    if (item.embed?.external?.uri) {
      linkCard = {
        url: item.embed.external.uri,
        title: item.embed.external.title ?? '',
        description: item.embed.external.description ?? '',
        image: item.embed.external.thumb ?? undefined,
      }
    }

    // Extract hashtags from facets
    const tags: string[] = []
    if (item.record?.facets) {
      for (const facet of item.record.facets) {
        for (const feature of facet.features ?? []) {
          if (feature.$type === 'app.bsky.richtext.facet#tag' && feature.tag) {
            tags.push(feature.tag)
          }
        }
      }
    }

    posts.push({
      id: `bsky-${item.cid ?? item.uri}`,
      platform: 'bluesky',
      author: item.author?.handle ?? 'unknown',
      text: text.slice(0, 200),
      fullText: text,
      url: item.uri ?? '',
      lat: loc.lat,
      lon: loc.lon,
      locationName: loc.name,
      time: item.record?.createdAt ? new Date(item.record.createdAt).getTime() : Date.now(),
      lastUpdate: Date.now(),
      media,
      linkCard,
      score: item.likeCount,
      commentCount: item.replyCount,
      repostCount: item.repostCount,
      tags: tags.length ? tags : undefined,
    })
  }

  return posts
}
