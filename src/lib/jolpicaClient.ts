const API_ROOT = 'https://api.jolpi.ca/ergast/f1'
type Json = { [key: string]: unknown } | unknown[] | string | number | boolean | null

function mergePages(left: Json, right: Json): Json {
  if (Array.isArray(left) && Array.isArray(right)) return [...left, ...right]
  if (left && right && typeof left === 'object' && typeof right === 'object' && !Array.isArray(left) && !Array.isArray(right)) {
    const output = { ...left } as Record<string, Json>
    for (const [key, value] of Object.entries(right)) output[key] = key in output ? mergePages(output[key], value as Json) : value as Json
    return output
  }
  return right
}

export async function fetchJolpica<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
  const url = new URL(`${API_ROOT}/${endpoint.replace(/^\//, '')}`)
  url.searchParams.set('limit', '100')
  url.searchParams.set('offset', '0')
  const firstResponse = await fetch(url, { signal })
  if (!firstResponse.ok) throw new Error(`Jolpica request failed (${firstResponse.status})`)
  let merged = await firstResponse.json() as Json
  const metadata = merged && !Array.isArray(merged) && typeof merged === 'object' ? (merged as Record<string, Json>).MRData : null
  const total = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? Number((metadata as Record<string, Json>).total ?? 0) : 0
  for (let offset = 100; offset < total; offset += 100) {
    url.searchParams.set('offset', String(offset))
    const pageResponse = await fetch(url, { signal })
    if (!pageResponse.ok) throw new Error(`Jolpica request failed (${pageResponse.status})`)
    merged = mergePages(merged, await pageResponse.json() as Json)
  }
  return merged as T
}
