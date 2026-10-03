import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useOsintStore } from '@/stores/osint-store'
import { OSINT_PLATFORM_COLORS } from '@/lib/colors'
import { OsintModal } from '@/components/ui/OsintModal'
import type { OsintPost } from '@/lib/osint-client'

const PLATFORM_ICONS: Record<string, string> = {
  reddit: 'R/',
  mastodon: 'M',
  bluesky: 'B',
}

export function OsintSection() {
  const [open, setOpen] = useState(true)
  const [modalPost, setModalPost] = useState<OsintPost | null>(null)
  const { posts, platformToggles, togglePlatform, version, count } = useOsintStore()

  const sortedPosts = useMemo(() => {
    void version
    const arr = [...posts.values()]
      .filter(p => platformToggles.get(p.platform) !== false)
      .sort((a, b) => b.time - a.time)
    return arr.slice(0, 50)
  }, [version, posts, platformToggles])

  const platforms = ['reddit', 'mastodon', 'bluesky'] as const

  return (
    <div className="border-b border-zinc-800">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={cn('text-[10px] transition-transform', open && 'rotate-90')}>▶</span>
          <span className="font-display text-[13px] font-semibold tracking-[2px] text-teal-400 uppercase">OSINT</span>
          <span className="font-mono text-[11px] text-zinc-500">{count}</span>
        </div>
      </button>

      {open && (
        <div className="px-3 pb-2">
          {/* Platform toggles */}
          <div className="flex gap-1 mb-2">
            {platforms.map(p => (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border transition-colors',
                  platformToggles.get(p) !== false
                    ? `${OSINT_PLATFORM_COLORS[p]} border-current`
                    : 'text-zinc-600 border-zinc-800',
                )}
              >
                {PLATFORM_ICONS[p]} {p}
              </button>
            ))}
          </div>

          {/* Posts list */}
          <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
            {sortedPosts.map(post => (
              <button
                key={post.id}
                onClick={() => setModalPost(post)}
                className="block w-full text-left px-2 py-1.5 rounded hover:bg-zinc-800/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={cn(
                    'font-mono text-[9px] uppercase tracking-wider px-1 rounded',
                    OSINT_PLATFORM_COLORS[post.platform],
                  )}>
                    {post.platform.slice(0, 3)}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-600">{post.author}</span>
                  <span className="font-mono text-[9px] text-zinc-700 ml-auto">{post.locationName}</span>
                </div>
                <div className="font-mono text-[11px] text-zinc-400 truncate">{post.text}</div>
              </button>
            ))}
            {sortedPosts.length === 0 && (
              <div className="text-center py-3 font-mono text-[11px] text-zinc-600">
                {count === 0 ? 'Loading OSINT...' : 'No geolocated posts'}
              </div>
            )}
          </div>
        </div>
      )}
      <OsintModal post={modalPost} onClose={() => setModalPost(null)} />
    </div>
  )
}
