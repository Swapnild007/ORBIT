import { describe, it, expect } from 'vitest'
import { parseRedditPosts, parseMastodonPosts, parseBlueskyPosts } from '../osint-client'

describe('parseRedditPosts', () => {
  it('parses posts with geolocatable content', () => {
    const result = parseRedditPosts({
      data: {
        children: [
          {
            data: {
              id: 'abc123',
              author: 'user1',
              title: 'Breaking: Explosion in Kyiv',
              selftext: 'Reports coming in from the capital',
              permalink: '/r/worldnews/comments/abc123',
              created_utc: 1705300000,
            },
          },
        ],
      },
    })

    expect(result).toHaveLength(1)
    expect(result[0].platform).toBe('reddit')
    expect(result[0].author).toBe('user1')
    expect(result[0].locationName).toBe('kyiv')
    expect(result[0].lat).toBeCloseTo(50.45, 1)
    expect(result[0].time).toBe(1705300000 * 1000)
  })

  it('skips posts without geo-extractable locations', () => {
    const result = parseRedditPosts({
      data: {
        children: [
          { data: { id: '1', title: 'Cute cat video', author: 'catfan' } },
        ],
      },
    })
    expect(result).toEqual([])
  })

  it('returns empty for invalid input', () => {
    expect(parseRedditPosts({})).toEqual([])
    expect(parseRedditPosts(null)).toEqual([])
  })
})

describe('parseMastodonPosts', () => {
  it('parses posts with locations and strips HTML', () => {
    const result = parseMastodonPosts([
      {
        id: 'mast1',
        content: '<p>Protests reported in <b>Tokyo</b> today</p>',
        url: 'https://mastodon.social/@user/mast1',
        created_at: '2024-01-15T10:00:00Z',
        account: { acct: 'reporter@mastodon.social' },
      },
    ])

    expect(result).toHaveLength(1)
    expect(result[0].platform).toBe('mastodon')
    expect(result[0].locationName).toBe('tokyo')
    expect(result[0].author).toBe('reporter@mastodon.social')
  })

  it('skips posts without locations', () => {
    const result = parseMastodonPosts([
      { id: '1', content: '<p>Just had lunch</p>' },
    ])
    expect(result).toEqual([])
  })

  it('returns empty for non-array', () => {
    expect(parseMastodonPosts({})).toEqual([])
  })
})

describe('parseBlueskyPosts', () => {
  it('parses posts with locations', () => {
    const result = parseBlueskyPosts({
      posts: [
        {
          uri: 'at://did:plc:abc/app.bsky.feed.post/xyz',
          cid: 'bafyxyz',
          record: { text: 'Earthquake felt in Istanbul', createdAt: '2024-01-15T10:00:00Z' },
          author: { handle: 'reporter.bsky.social' },
        },
      ],
    })

    expect(result).toHaveLength(1)
    expect(result[0].platform).toBe('bluesky')
    expect(result[0].locationName).toBe('istanbul')
    expect(result[0].author).toBe('reporter.bsky.social')
  })

  it('skips posts without geo content', () => {
    const result = parseBlueskyPosts({
      posts: [{ record: { text: 'Nice weather today' }, author: { handle: 'user' } }],
    })
    expect(result).toEqual([])
  })

  it('returns empty for missing posts', () => {
    expect(parseBlueskyPosts({})).toEqual([])
  })
})
