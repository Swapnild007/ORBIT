export interface SanctionMatch {
  id: string
  name: string
  schema: string
  datasets: string[]
  countries: string[]
  score: number
}

export function parseSanctionResults(json: unknown): SanctionMatch[] {
  const data = json as { results?: Array<{
    id?: string
    caption?: string
    schema?: string
    datasets?: string[]
    properties?: {
      country?: string[]
    }
    score?: number
  }> }

  if (!Array.isArray(data?.results)) return []

  return data.results
    .filter(r => (r.score ?? 0) >= 0.7)
    .map(r => ({
      id: r.id ?? '',
      name: r.caption ?? 'Unknown',
      schema: r.schema ?? 'Thing',
      datasets: r.datasets ?? [],
      countries: r.properties?.country ?? [],
      score: r.score ?? 0,
    }))
}
