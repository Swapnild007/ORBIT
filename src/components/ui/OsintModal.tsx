import { useEffect, useCallback, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { OSINT_PLATFORM_COLORS } from '@/lib/colors'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/Tooltip'
import type { OsintPost, OsintMedia, OsintLinkCard, OsintComment } from '@/lib/osint-client'

interface OsintModalProps {
  post: OsintPost | null
  onClose: () => void
}

interface ExtractedArticle {
  title: string | null
  content: string | null
  excerpt: string | null
  siteName: string | null
  byline: string | null
  error?: string
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toISOString().replace('T', ' ').slice(0, 19) + 'Z'
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

function isLinkSharePost(post: OsintPost): boolean {
  if (!post.linkCard?.url) return false
  const text = post.fullText ?? post.text
  // Strip URLs before counting words
  const textWithoutLinks = text.replace(/https?:\/\/\S+/g, '').replace(/\S+\.\S+\/\S+/g, '')
  const wordCount = textWithoutLinks.trim().split(/\s+/).filter(Boolean).length
  return wordCount < 25
}

function MediaGallery({ media }: { media: OsintMedia[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (media.length === 0) return null

  return (
    <>
      <div className={cn(
        'grid gap-2 mt-3',
        media.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
      )}>
        {media.map((m, i) => (
          m.type === 'image' ? (
            <button
              key={i}
              onClick={() => setExpanded(expanded === m.url ? null : m.url)}
              className="overflow-hidden rounded-lg border border-zinc-700 hover:border-zinc-500 transition-colors cursor-pointer"
            >
              <img
                src={m.previewUrl ?? m.url}
                alt={m.alt ?? ''}
                className="w-full max-h-[300px] object-cover"
                loading="lazy"
              />
            </button>
          ) : (
            <video
              key={i}
              src={m.url}
              poster={m.previewUrl}
              controls
              className="w-full max-h-[300px] rounded-lg border border-zinc-700"
            />
          )
        ))}
      </div>
      {expanded && (
        <button
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 cursor-pointer"
          onClick={() => setExpanded(null)}
        >
          <img src={expanded} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
        </button>
      )}
    </>
  )
}

function LinkCardView({ card, onClick }: { card: OsintLinkCard; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-3 w-full flex text-left overflow-hidden rounded-lg border border-zinc-700 hover:border-zinc-500 transition-colors bg-zinc-800/50 cursor-pointer"
    >
      {card.image && (
        <img
          src={card.image}
          alt=""
          className="w-[120px] h-[90px] object-cover flex-shrink-0"
          loading="lazy"
        />
      )}
      <div className="flex-1 min-w-0 p-3">
        <div className="font-mono text-[11px] text-zinc-300 line-clamp-2 leading-tight">{card.title}</div>
        {card.description && (
          <div className="font-mono text-[10px] text-zinc-500 mt-1 line-clamp-2">{card.description}</div>
        )}
        <div className="font-mono text-[9px] text-teal-500 mt-1">Click to load full article — {extractDomain(card.url)}</div>
      </div>
    </button>
  )
}

function EngagementBar({ post }: { post: OsintPost }) {
  const items: Array<{ label: string; value: number }> = []
  if (post.score != null) items.push({ label: post.platform === 'reddit' ? 'upvotes' : 'likes', value: post.score })
  if (post.commentCount != null) items.push({ label: 'replies', value: post.commentCount })
  if (post.repostCount != null) items.push({ label: post.platform === 'mastodon' ? 'boosts' : 'reposts', value: post.repostCount })

  if (items.length === 0) return null

  return (
    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-800">
      {items.map(({ label, value }) => (
        <span key={label} className="font-mono text-[10px] text-zinc-500">
          <span className="text-zinc-400">{formatNumber(value)}</span> {label}
        </span>
      ))}
    </div>
  )
}

function ArticleContent({ article }: { article: ExtractedArticle }) {
  return (
    <div className="mt-4 pt-4 border-t border-zinc-700">
      {/* Article source */}
      {(article.siteName || article.byline) && (
        <div className="flex items-center gap-2 mb-3">
          {article.siteName && (
            <span className="font-mono text-[10px] text-sky-400/70 bg-sky-950/40 px-1.5 py-0.5 rounded">{article.siteName}</span>
          )}
          {article.byline && (
            <span className="font-mono text-[10px] text-zinc-500">{article.byline}</span>
          )}
        </div>
      )}

      {/* Article title */}
      {article.title && (
        <h2 className="font-body text-[17px] font-semibold text-zinc-100 leading-snug mb-3">{article.title}</h2>
      )}

      {/* Article body */}
      {article.content && (
        <div
          className="osint-article-content font-body text-[14px] text-zinc-300 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
      )}
    </div>
  )
}

function useArticleExtract(url: string | null) {
  const [article, setArticle] = useState<ExtractedArticle | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchArticle = useCallback(async (articleUrl: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/article/extract?url=${encodeURIComponent(articleUrl)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as ExtractedArticle
      if (data.content) {
        setArticle(data)
      } else {
        setArticle(null)
      }
    } catch {
      setArticle(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-fetch when URL is provided
  useEffect(() => {
    if (url) {
      setArticle(null)
      fetchArticle(url)
    } else {
      setArticle(null)
      setLoading(false)
    }
  }, [url, fetchArticle])

  return { article, loading, fetchArticle }
}

function useOsintComments(post: OsintPost | null) {
  const [comments, setComments] = useState<OsintComment[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const fetchComments = useCallback(async () => {
    if (!post || loaded) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ platform: post.platform, url: post.url })
      // For Mastodon, extract the numeric ID from our prefixed ID
      if (post.platform === 'mastodon') {
        const numericId = post.id.replace('mast-', '')
        params.set('id', numericId)
      }
      const res = await fetch(`/api/osint/comments?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { comments: OsintComment[] }
      setComments(data.comments ?? [])
    } catch {
      setComments([])
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [post, loaded])

  // Reset when post changes
  useEffect(() => {
    setComments([])
    setLoaded(false)
    setLoading(false)
  }, [post?.id])

  return { comments, loading, loaded, fetchComments }
}

function CommentItem({ comment, depth = 0 }: { comment: OsintComment; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth >= 2)
  const hasReplies = comment.replies && comment.replies.length > 0

  return (
    <div className={cn('mt-2', depth > 0 && 'ml-4 pl-3 border-l border-zinc-800')}>
      <div className="flex items-center gap-2 mb-0.5">
        <span className="font-mono text-[11px] text-zinc-300 font-semibold">{comment.author}</span>
        {comment.score != null && (
          <span className="font-mono text-[10px] text-zinc-600">{formatNumber(comment.score)} pts</span>
        )}
        <span className="font-mono text-[9px] text-zinc-700">
          {new Date(comment.time).toISOString().slice(0, 16).replace('T', ' ')}
        </span>
      </div>
      {comment.htmlContent ? (
        <div
          className="font-body text-[12px] text-zinc-400 leading-relaxed osint-html-content"
          dangerouslySetInnerHTML={{ __html: comment.htmlContent }}
        />
      ) : (
        <div className="font-body text-[12px] text-zinc-400 leading-relaxed whitespace-pre-wrap">
          {comment.text}
        </div>
      )}
      {hasReplies && (
        <>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="font-mono text-[10px] text-zinc-600 hover:text-zinc-400 mt-1 cursor-pointer"
          >
            {collapsed
              ? `▸ ${comment.replies!.length} ${comment.replies!.length === 1 ? 'reply' : 'replies'}`
              : '▾ hide replies'}
          </button>
          {!collapsed && comment.replies!.map(reply => (
            <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
          ))}
        </>
      )}
    </div>
  )
}

function CommentsSection({ post }: { post: OsintPost }) {
  const { comments, loading, loaded, fetchComments } = useOsintComments(post)
  const [expanded, setExpanded] = useState(false)

  const handleToggle = () => {
    if (!loaded && !loading) fetchComments()
    setExpanded(!expanded)
  }

  return (
    <div className="mt-4 pt-4 border-t border-zinc-700">
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 w-full text-left cursor-pointer group"
      >
        <span className="font-mono text-[10px] text-zinc-600 group-hover:text-zinc-400 transition-colors">
          {expanded ? '▾' : '▸'}
        </span>
        <span className="font-display text-[12px] font-semibold tracking-[1.5px] text-zinc-500 uppercase group-hover:text-zinc-400 transition-colors">
          Comments
        </span>
        {post.commentCount != null && (
          <span className="font-mono text-[10px] text-zinc-600">({post.commentCount})</span>
        )}
      </button>

      {expanded && (
        <div className="mt-2">
          {loading && (
            <div className="flex items-center gap-2 py-3">
              <div className="w-3 h-3 border-2 border-zinc-600 border-t-teal-400 rounded-full animate-spin" />
              <span className="font-mono text-[11px] text-zinc-500">Loading comments...</span>
            </div>
          )}
          {loaded && comments.length === 0 && !loading && (
            <div className="font-mono text-[11px] text-zinc-600 py-2">No comments found</div>
          )}
          {comments.map(comment => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      )}
    </div>
  )
}

export function OsintModal({ post: postProp, onClose }: OsintModalProps) {
  // Snapshot the post when a new one is selected to prevent re-renders
  // from store version updates causing content to flicker
  const snapshotRef = useRef<OsintPost | null>(null)
  if (postProp === null) {
    snapshotRef.current = null
  } else if (!snapshotRef.current || snapshotRef.current.id !== postProp.id) {
    snapshotRef.current = postProp
  }
  const post = snapshotRef.current

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (!post) return
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [post, handleKeyDown])

  // Determine the article URL to extract
  const articleUrl = post?.linkCard?.url ?? null
  const autoFetch = post ? (
    (post.platform === 'reddit' && post.linkCard?.url) ||
    (post.platform === 'bluesky' && post.linkCard?.url) ||
    (post.platform === 'mastodon' && post.linkCard?.url)
  ) : false

  const { article: extractedArticle, loading, fetchArticle } = useArticleExtract(autoFetch ? articleUrl : null)

  if (!post) return null

  const isLinkShare = isLinkSharePost(post)

  // For link-share posts, fall back to linkCard data if extraction fails
  const article: ExtractedArticle | null = extractedArticle ?? (
    isLinkShare && !loading && post.linkCard ? {
      title: post.linkCard.title || post.text,
      content: post.linkCard.description ? `<p>${post.linkCard.description}</p>` : null,
      excerpt: post.linkCard.description || null,
      siteName: extractDomain(post.linkCard.url),
      byline: null,
    } : null
  )

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" />

      {/* Modal */}
      <div
        className="relative w-[700px] max-w-[90vw] max-h-[85vh] bg-zinc-900 border border-zinc-700 rounded-lg flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-700 bg-zinc-900 flex-shrink-0">
          {isLinkShare && article ? (
            <>
              {article.siteName && (
                <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-950/60 text-sky-400">
                  {article.siteName}
                </span>
              )}
              <span className="font-mono text-[10px] text-zinc-600">
                via @{post.author} on {post.platform}
              </span>
              <div className="flex-1" />
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={post.linkCard!.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
                    >
                      ↗ OPEN ARTICLE
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>Open article</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          ) : (
            <>
              <span className={cn(
                'font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded',
                OSINT_PLATFORM_COLORS[post.platform],
              )}>
                {post.platform}
              </span>
              <span className="font-mono text-[11px] text-zinc-400">{post.author}</span>
              {post.subreddit && (
                <span className="font-mono text-[10px] text-orange-400/70">r/{post.subreddit}</span>
              )}
              <div className="flex-1" />
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
                    >
                      ↗ NEW TAB
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>Open in new tab</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 text-lg leading-none px-1.5 py-0.5 rounded hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-zinc-700">
          {isLinkShare && article ? (
            /* ── Link-share post: render as article ── */
            <>
              {/* Location + date */}
              <div className="flex items-center gap-2 mb-3">
                {post.locationName && (
                  <span className="font-mono text-[10px] text-teal-400/70 bg-teal-950/40 px-1.5 py-0.5 rounded">{post.locationName}</span>
                )}
                <span className="font-mono text-[10px] text-zinc-600">{formatTime(post.time)}</span>
              </div>

              {/* Article source + byline */}
              {article.byline && (
                <div className="font-mono text-[11px] text-zinc-500 mb-2">{article.byline}</div>
              )}

              {/* Article title */}
              <h2 className="font-body text-[17px] font-semibold text-zinc-100 leading-snug mb-4">{article.title}</h2>

              {/* Article body */}
              {article.content && (
                <div
                  className="osint-article-content font-body text-[14px] text-zinc-300 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: article.content }}
                />
              )}

              {/* Engagement */}
              <EngagementBar post={post} />

              {/* Comments */}
              <CommentsSection post={post} />

              {/* Source link */}
              <div className="mt-4 pt-3 border-t border-zinc-800">
                <a
                  href={post.linkCard!.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] text-sky-400 hover:text-sky-300 hover:underline"
                >
                  ↗ {extractDomain(post.linkCard!.url)} — view original article
                </a>
              </div>
            </>
          ) : isLinkShare && loading ? (
            /* ── Link-share post: loading article ── */
            <>
              <div className="flex items-center gap-2 mb-4">
                {post.locationName && (
                  <span className="font-mono text-[10px] text-teal-400/70 bg-teal-950/40 px-1.5 py-0.5 rounded">{post.locationName}</span>
                )}
                <span className="font-mono text-[10px] text-zinc-600">{formatTime(post.time)}</span>
              </div>

              {/* Show link card title as preview while loading */}
              {post.linkCard?.title && (
                <h2 className="font-body text-[17px] font-semibold text-zinc-100 leading-snug mb-4">{post.linkCard.title}</h2>
              )}

              <div className="flex items-center gap-2 py-4">
                <div className="w-3 h-3 border-2 border-zinc-600 border-t-teal-400 rounded-full animate-spin" />
                <span className="font-mono text-[11px] text-zinc-500">Loading article from {post.linkCard ? extractDomain(post.linkCard.url) : ''}...</span>
              </div>
            </>
          ) : (
            /* ── Regular post or link-share fallback ── */
            <>
              {/* Meta line */}
              <div className="flex items-center gap-2 mb-3">
                {post.locationName && (
                  <span className="font-mono text-[10px] text-teal-400/70 bg-teal-950/40 px-1.5 py-0.5 rounded">{post.locationName}</span>
                )}
                <span className="font-mono text-[10px] text-zinc-600">{formatTime(post.time)}</span>
              </div>

              {/* Post title (Reddit) */}
              {post.platform === 'reddit' && !article && (
                <h2 className="font-body text-[15px] text-zinc-200 leading-snug mb-2">{post.text}</h2>
              )}

              {/* Post content (social media post text) */}
              {!article && (
                <>
                  {post.htmlContent ? (
                    <div
                      className="font-body text-[13px] text-zinc-300 leading-relaxed osint-html-content"
                      dangerouslySetInnerHTML={{ __html: post.htmlContent }}
                    />
                  ) : post.fullText ? (
                    <div className="font-body text-[13px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
                      {post.fullText}
                    </div>
                  ) : null}
                </>
              )}

              {/* Media from social post */}
              <MediaGallery media={post.media} />

              {/* Link card (clickable to load article if not auto-fetched) */}
              {post.linkCard && !article && !loading && !autoFetch && (
                <LinkCardView card={post.linkCard} onClick={() => fetchArticle(post.linkCard!.url)} />
              )}

              {/* Loading state */}
              {loading && (
                <div className="mt-4 pt-4 border-t border-zinc-700 flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-zinc-600 border-t-teal-400 rounded-full animate-spin" />
                  <span className="font-mono text-[11px] text-zinc-500">Loading article...</span>
                </div>
              )}

              {/* Extracted article content */}
              {article && <ArticleContent article={article} />}

              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {post.tags.map(tag => (
                    <span key={tag} className="font-mono text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Engagement */}
              <EngagementBar post={post} />

              {/* Comments — collapsed by default */}
              <CommentsSection post={post} />

              {/* Source link at bottom */}
              {post.linkCard?.url && (
                <div className="mt-4 pt-3 border-t border-zinc-800">
                  <a
                    href={post.linkCard.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[10px] text-sky-400 hover:text-sky-300 hover:underline"
                  >
                    ↗ {extractDomain(post.linkCard.url)} — view original
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
