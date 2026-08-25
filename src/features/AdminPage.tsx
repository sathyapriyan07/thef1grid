import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { importEntity, writeImportLog } from '../lib/f1Importer'
import {
  adminTables,
  createAdminRow,
  deleteAdminRow,
  getAdminRows,
  updateAdminRow,
  type AdminTable,
} from '../lib/f1Repository'
import { supabase } from '../lib/supabaseClient'
import { useSupabaseSession } from '../lib/useSupabaseSession'

const importEntities: Array<Parameters<typeof importEntity>[0]> = [
  'seasons',
  'circuits',
  'teams',
  'drivers',
  'races',
  'results',
  'qualifying_results',
  'sprint_results',
  'pitstops',
  'laps',
  'driver_standings',
  'constructor_standings',
  'status',
]

const editableFields: Record<AdminTable, string[]> = {
  seasons: ['external_ref', 'year', 'url'],
  circuits: ['external_ref', 'name', 'location', 'country', 'lat', 'lng', 'url', 'image_url'],
  teams: ['external_ref', 'name', 'nationality', 'url', 'logo_url', 'color_hex'],
  drivers: ['external_ref', 'driver_ref', 'code', 'permanent_number', 'given_name', 'family_name', 'dob', 'nationality', 'url', 'headshot_url'],
  races: ['external_ref', 'season_id', 'round', 'circuit_id', 'name', 'date', 'time', 'url'],
  sessions: ['external_ref', 'race_id', 'type', 'date', 'time'],
  status: ['external_ref', 'status_text'],
  results: ['external_ref', 'race_id', 'driver_id', 'team_id', 'grid', 'position', 'position_text', 'points', 'laps', 'status_id', 'fastest_lap_rank', 'fastest_lap_time'],
  qualifying_results: ['external_ref', 'race_id', 'driver_id', 'team_id', 'position', 'q1', 'q2', 'q3'],
  sprint_results: ['external_ref', 'race_id', 'driver_id', 'team_id', 'grid', 'position', 'points', 'laps', 'status_id'],
  laps: ['external_ref', 'race_id', 'driver_id', 'lap_number', 'position', 'time_ms'],
  pitstops: ['external_ref', 'race_id', 'driver_id', 'stop_number', 'lap', 'time', 'duration_ms'],
  session_entries: ['external_ref', 'session_id', 'driver_id', 'team_id'],
  driver_standings: ['external_ref', 'season_id', 'race_id', 'driver_id', 'team_id', 'points', 'position', 'wins'],
  constructor_standings: ['external_ref', 'season_id', 'race_id', 'team_id', 'points', 'position', 'wins'],
  media: ['entity_type', 'entity_id', 'url', 'type'],
  driver_podiums: ['driver_id', 'season_id', 'image_url'],
}

const systemFields = new Set(['id', 'source', 'is_overridden', 'overrides', 'created_at', 'updated_at'])
const relationSources = ['seasons', 'circuits', 'races', 'drivers', 'teams', 'sessions', 'status'] as const
const relationFields: Record<string, typeof relationSources[number]> = {
  season_id: 'seasons',
  circuit_id: 'circuits',
  race_id: 'races',
  driver_id: 'drivers',
  team_id: 'teams',
  session_id: 'sessions',
  status_id: 'status',
}

const summaryFields: Partial<Record<AdminTable, string[]>> = {
  seasons: ['year', 'external_ref', 'url'],
  circuits: ['name', 'location', 'country'],
  teams: ['name', 'nationality', 'color_hex'],
  drivers: ['family_name', 'code', 'nationality'],
  races: ['name', 'season_id', 'round', 'circuit_id', 'date', 'time'],
  sessions: ['type', 'race_id', 'date', 'time'],
  status: ['status_text'],
  results: ['driver_id', 'race_id', 'team_id', 'position', 'points'],
  qualifying_results: ['driver_id', 'race_id', 'team_id', 'position'],
  sprint_results: ['driver_id', 'race_id', 'team_id', 'position', 'points'],
  laps: ['driver_id', 'race_id', 'lap_number', 'time_ms'],
  pitstops: ['driver_id', 'race_id', 'stop_number', 'lap', 'duration_ms'],
  session_entries: ['driver_id', 'team_id', 'session_id'],
  driver_standings: ['driver_id', 'season_id', 'race_id', 'team_id', 'points', 'position'],
  constructor_standings: ['team_id', 'season_id', 'race_id', 'points', 'position'],
  media: ['entity_type', 'entity_id', 'type', 'url'],
  driver_podiums: ['driver_id', 'season_id', 'image_url'],
}

function relationLabel(table: typeof relationSources[number], row: Record<string, unknown>) {
  if (table === 'seasons') return String(row.year ?? row.id)
  if (table === 'drivers') return String(row.family_name ?? row.name ?? row.id)
  if (table === 'status') return String(row.status_text ?? row.id)
  if (table === 'sessions') return `${row.type ?? ''} ${row.date ?? ''}`.trim() || String(row.id)
  return String(row.name ?? row.id)
}

function formatValue(value: unknown): string {
  if (value == null || value === '') return '—'
  if (Array.isArray(value)) return value.map(formatValue).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function labelFor(key: string) {
  return key.replaceAll('_', ' ')
}

function visibleEntries(row: Record<string, unknown>) {
  return Object.entries(row).filter(([key]) => !systemFields.has(key))
}

export default function AdminPage({ importOnly = false }: { importOnly?: boolean }) {
  const params = useParams<{ table?: string }>()
  const requestedTable = adminTables.includes(params.table as AdminTable) ? params.table as AdminTable : undefined
  const showImport = importOnly || !requestedTable
  const signedIn = useSupabaseSession()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [season, setSeason] = useState('2025')
  const [round, setRound] = useState('')
  const [entity, setEntity] = useState<Parameters<typeof importEntity>[0]>('races')
  const [table, setTable] = useState<AdminTable>(requestedTable ?? 'races')
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [draft, setDraft] = useState('{}')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [podiumDriverId, setPodiumDriverId] = useState('')
  const [podiumSeasonId, setPodiumSeasonId] = useState('')
  const [relationSearch, setRelationSearch] = useState<Record<string, string>>({})
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [podiumImageFile, setPodiumImageFile] = useState<File | null>(null)
  const [podiumImagePreview, setPodiumImagePreview] = useState('')
  const [driverPodiumSeasonId, setDriverPodiumSeasonId] = useState('')

  useEffect(() => {
    if (!requestedTable) return
    setTable(requestedTable)
    setEditing(null)
    setSearchTerm('')
    setPodiumDriverId('')
    setPodiumSeasonId('')
    setRelationSearch({})
  }, [requestedTable])

  useEffect(() => {
    if (!imageFile) return
    const url = URL.createObjectURL(imageFile)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  useEffect(() => {
    if (!podiumImageFile) return
    const url = URL.createObjectURL(podiumImageFile)
    setPodiumImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [podiumImageFile])

  const rows = useQuery({ queryKey: ['admin', table], queryFn: () => getAdminRows(table), enabled: signedIn, retry: false })
  const podiumRows = useQuery({ queryKey: ['admin', 'driver_podiums'], queryFn: () => getAdminRows('driver_podiums'), enabled: signedIn, retry: false })
  const relations = useQuery({
    queryKey: ['admin-relations'],
    queryFn: async () => Object.fromEntries(await Promise.all(relationSources.map(async (name) => [name, await getAdminRows(name)]))),
    enabled: signedIn,
    retry: false,
  })

  const parsedDraft = useMemo(() => {
    try {
      return JSON.parse(draft) as Record<string, unknown>
    } catch {
      return null
    }
  }, [draft])

  const formFields = editing
    ? [...new Set([...editableFields[table], ...Object.keys(editing)])].filter((field) => !systemFields.has(field))
    : editableFields[table]

  const relationOptions = (field: string) => {
    const source = relationFields[field]
    return source ? (relations.data?.[source] ?? []) : []
  }

  const selectedDriverPodium = editing && table === 'drivers' && driverPodiumSeasonId
    ? (podiumRows.data ?? []).find((row) => String(row.driver_id) === String(editing.id) && String(row.season_id) === driverPodiumSeasonId)
    : undefined

  useEffect(() => {
    if (table !== 'drivers' || !editing || podiumImageFile) return
    setPodiumImagePreview(String(selectedDriverPodium?.image_url ?? ''))
  }, [table, editing, driverPodiumSeasonId, selectedDriverPodium, podiumImageFile])

  const displayRow = (row: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        const source = relationFields[key]
        const related = source && value != null
          ? relationOptions(key).find((candidate: Record<string, unknown>) => String(candidate.id) === String(value))
          : undefined
        return [key, related ? relationLabel(source, related) : value]
      }),
    )

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return (rows.data ?? []).filter((row) => {
      if (table === 'driver_podiums') {
        const driverId = podiumDriverId.trim().toLowerCase()
        const seasonId = podiumSeasonId.trim().toLowerCase()
        if (driverId && !String(row.driver_id ?? '').toLowerCase().includes(driverId)) return false
        if (seasonId && !String(row.season_id ?? '').toLowerCase().includes(seasonId)) return false
      }
      if (!term) return true
      const displayed = displayRow(row)
      return `${JSON.stringify(row)} ${JSON.stringify(displayed)}`.toLowerCase().includes(term)
    })
  }, [rows.data, searchTerm, podiumDriverId, podiumSeasonId, table, relations.data])

  const rowSummary = (row: Record<string, unknown>) => {
    const displayed = displayRow(row)
    const keys = summaryFields[table] ?? Object.keys(displayed)
    const orderedKeys = [...keys, ...Object.keys(displayed)]
      .filter((key, index, list) => list.indexOf(key) === index)
      .filter((key) => !systemFields.has(key))

    const title =
      orderedKeys
        .map((key) => displayed[key])
        .find((value) => value != null && value !== '')
      ?? row.id

    const chips = orderedKeys
      .map((key) => [key, displayed[key]] as const)
      .filter(([, value]) => value != null && value !== '')

    return {
      title: formatValue(title),
      chips,
    }
  }

  async function signIn() {
    if (!supabase) {
      setMessage('Set VITE_USE_SUPABASE=true first.')
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setMessage(error ? error.message : 'Signed in.')
  }

  async function runImport() {
    setBusy(true)
    setMessage(`Importing ${entity}...`)
    const empty = { processed: 0, created: 0, updated: 0, errors: [] as string[] }
    try {
      const result = await importEntity(entity, season, round)
      await writeImportLog(entity, season, result)
      setMessage(`Stored ${result.processed} ${entity}.`)
      await queryClient.invalidateQueries({ queryKey: ['admin', entity] })
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Import failed'
      await writeImportLog(entity, season, empty, detail)
      setMessage(detail)
    } finally {
      setBusy(false)
    }
  }

  function editRow(row: Record<string, unknown>) {
    setEditing(row)
    setDraft(JSON.stringify(row, null, 2))
    setRelationSearch({})
    setImageFile(null)
    setImagePreview(String(table === 'drivers' ? row.headshot_url ?? '' : table === 'teams' ? row.logo_url ?? '' : row.image_url ?? ''))
    setPodiumImageFile(null)
    setPodiumImagePreview('')
    setDriverPodiumSeasonId(table === 'drivers' ? String((podiumRows.data ?? []).find((podium) => String(podium.driver_id) === String(row.id))?.season_id ?? '') : '')
    setMessage('')
  }

  function startNewRecord() {
    setEditing({})
    setDraft('{}')
    setRelationSearch({})
    setImageFile(null)
    setImagePreview('')
    setPodiumImageFile(null)
    setPodiumImagePreview('')
    setDriverPodiumSeasonId('')
  }

  async function uploadDriverImage(driverId: string, file: File) {
    if (!supabase) throw new Error('Supabase is disabled. Set VITE_USE_SUPABASE=true.')
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${driverId}/${crypto.randomUUID()}.${extension}`
    const { error } = await supabase.storage.from('driver-images').upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    })
    if (error) throw error
    return supabase.storage.from('driver-images').getPublicUrl(path).data.publicUrl
  }

  async function uploadTeamLogo(teamId: string, file: File) {
    if (!supabase) throw new Error('Supabase is disabled. Set VITE_USE_SUPABASE=true.')
    const extension = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `${teamId}/${crypto.randomUUID()}.${extension}`
    const { error } = await supabase.storage.from('team-logos').upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    })
    if (error) throw error
    return supabase.storage.from('team-logos').getPublicUrl(path).data.publicUrl
  }

  async function uploadPodiumImage(podiumId: string, file: File) {
    if (!supabase) throw new Error('Supabase is disabled. Set VITE_USE_SUPABASE=true.')
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${podiumId}/${crypto.randomUUID()}.${extension}`
    const { error } = await supabase.storage.from('podium-images').upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    })
    if (error) throw error
    return supabase.storage.from('podium-images').getPublicUrl(path).data.publicUrl
  }

  function updateDraft(field: string, value: string) {
    setDraft((current) => JSON.stringify({ ...JSON.parse(current), [field]: value === '' ? null : value }, null, 2))
  }

  async function saveRow() {
    setBusy(true)
    try {
      const parsed = JSON.parse(draft) as Record<string, unknown>
      const { id, created_at: _createdAt, updated_at: _updatedAt, ...values } = parsed
      const saved = id
        ? await updateAdminRow(table, String(id), values)
        : await createAdminRow(table, values)
      if (table === 'drivers' && imageFile) {
        const imageUrl = await uploadDriverImage(String(saved.id), imageFile)
        await updateAdminRow('drivers', String(saved.id), { headshot_url: imageUrl })
      }
      if (table === 'drivers' && podiumImageFile && driverPodiumSeasonId) {
        const existing = (podiumRows.data ?? []).find((row) => String(row.driver_id) === String(saved.id) && String(row.season_id) === driverPodiumSeasonId)
        const podium = existing ?? await createAdminRow('driver_podiums', { driver_id: saved.id, season_id: driverPodiumSeasonId })
        const imageUrl = await uploadPodiumImage(String(podium.id), podiumImageFile)
        await updateAdminRow('driver_podiums', String(podium.id), { image_url: imageUrl })
      }
      if (table === 'teams' && imageFile) {
        const logoUrl = await uploadTeamLogo(String(saved.id), imageFile)
        await updateAdminRow('teams', String(saved.id), { logo_url: logoUrl })
      }
      if (table === 'driver_podiums' && imageFile) {
        const imageUrl = await uploadPodiumImage(String(saved.id), imageFile)
        await updateAdminRow('driver_podiums', String(saved.id), { image_url: imageUrl })
      }
      setEditing(null)
      setImageFile(null)
      setImagePreview('')
      setPodiumImageFile(null)
      setPodiumImagePreview('')
      setDriverPodiumSeasonId('')
      setMessage(id ? 'Record updated.' : 'Record created.')
      await queryClient.invalidateQueries({ queryKey: ['admin', table] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'driver_podiums'] })
    } catch (error) {
      setMessage(error instanceof SyntaxError ? 'Record must be valid JSON.' : error instanceof Error ? error.message : 'Could not save record.')
    } finally {
      setBusy(false)
    }
  }

  async function removeRow(row: Record<string, unknown>) {
    if (!row.id || !window.confirm(`Delete this ${table} record?`)) return
    setBusy(true)
    try {
      await deleteAdminRow(table, String(row.id))
      setMessage('Record deleted.')
      await queryClient.invalidateQueries({ queryKey: ['admin', table] })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete record.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="detail-page admin-page">
      <p className="eyebrow">PRIVATE WORKSPACE / ADMIN</p>
      <h1>Data control</h1>
      <p className="detail-subtitle">Import Jolpica records, then review and manage every stored record.</p>
      {!signedIn ? (
        <div className="admin-form">
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button className="outline-button" onClick={() => void signIn()}>Sign in <span>{'->'}</span></button>
        </div>
      ) : (
        <>
          <nav className="admin-section-nav" aria-label="Admin sections">
            <Link to="/admin/import">Import</Link>
            {adminTables.map((name) => (
              <Link key={name} to={`/admin/${name}`} className={table === name && requestedTable ? 'active' : ''}>
                {name.replaceAll('_', ' ')}
              </Link>
            ))}
          </nav>
          {showImport && <div className="import-console">
            <div className="import-controls">
              <label>
                IMPORT ENTITY
                <select value={entity} onChange={(event) => setEntity(event.target.value as typeof entity)}>
                  {importEntities.map((name) => <option key={name} value={name}>{name.replaceAll('_', ' ')}</option>)}
                </select>
              </label>
              <label>
                SEASON
                <input value={season} onChange={(event) => setSeason(event.target.value)} />
              </label>
              <label>
                ROUND
                <input value={round} onChange={(event) => setRound(event.target.value)} placeholder="all" />
              </label>
              <button className="outline-button" disabled={busy} onClick={() => void runImport()}>
                {busy ? 'Importing...' : 'Import & store'} <span>{'->'}</span>
              </button>
            </div>
            <div className="admin-notice">Every import is upserted by external reference and recorded in import_logs.</div>
          </div>}
          {requestedTable && !importOnly && <div className="admin-crud">
            <div className="crud-toolbar">
              <p className="eyebrow">TABLE / {table.replaceAll('_', ' ')}</p>
              <button className="outline-button" disabled={busy} onClick={startNewRecord}>
                New record <span>+</span>
              </button>
            </div>
            <div className="crud-search-row">
              {table === 'driver_podiums' ? (
                <div className="podium-search-fields">
                  <label className="crud-search">
                    SEARCH DRIVER ID
                    <input
                      type="search"
                      value={podiumDriverId}
                      onChange={(event) => setPodiumDriverId(event.target.value)}
                      placeholder="Search driver id"
                    />
                  </label>
                  <label className="crud-search">
                    SEARCH SEASON ID
                    <input
                      type="search"
                      value={podiumSeasonId}
                      onChange={(event) => setPodiumSeasonId(event.target.value)}
                      placeholder="Search season id"
                    />
                  </label>
                </div>
              ) : (
                <label className="crud-search">
                  SEARCH {table.replaceAll('_', ' ')}
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search any field"
                  />
                </label>
              )}
              <span className="crud-result-count">
                {(searchTerm.trim() || podiumDriverId.trim() || podiumSeasonId.trim()) ? `${filteredRows.length} / ${rows.data?.length ?? 0} records` : `${rows.data?.length ?? 0} records`}
              </span>
            </div>

            {editing ? (
              <div className="record-editor">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">{editing.id ? 'EDIT RECORD' : 'NEW RECORD'}</p>
                    <h2>{table.replaceAll('_', ' ')}</h2>
                  </div>
                  <button className="text-button" onClick={() => setEditing(null)}>Cancel</button>
                </div>
                {(table === 'drivers' || table === 'teams' || table === 'driver_podiums') && (
                  <div className="driver-image-upload">
                    <div className="driver-image-preview">
                      {imagePreview ? <img src={imagePreview} alt={table === 'drivers' ? 'Driver preview' : table === 'teams' ? 'Team logo preview' : 'Podium image preview'} /> : <span>NO IMAGE</span>}
                    </div>
                    <label className="file-input-label">
                      {table === 'drivers' ? 'Driver image' : table === 'teams' ? 'Team logo' : 'Driver podium image'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null
                          if (file && file.size > 5 * 1024 * 1024) {
                            setMessage('Choose an image smaller than 5 MB.')
                            event.target.value = ''
                            return
                          }
                          setImageFile(file)
                          setMessage('')
                        }}
                      />
                    </label>
                    <small>JPG, PNG or WEBP, up to 5 MB. Saved uploads replace the current file.</small>
                  </div>
                )}
                {table === 'drivers' && (
                  <div className="driver-podium-upload">
                    <div className="driver-image-preview">
                      {podiumImagePreview ? <img src={podiumImagePreview} alt="Driver podium preview" /> : <span>NO IMAGE</span>}
                    </div>
                    <label className="file-input-label">
                      Podium season
                      <select value={driverPodiumSeasonId} onChange={(event) => { setDriverPodiumSeasonId(event.target.value); setPodiumImageFile(null) }}>
                        <option value="">Select season...</option>
                        {(relations.data?.seasons ?? []).map((season: Record<string, unknown>) => (
                          <option key={String(season.id)} value={String(season.id)}>{String(season.year ?? season.id)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="file-input-label">
                      Driver podium image
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={!driverPodiumSeasonId}
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null
                          if (file && file.size > 5 * 1024 * 1024) {
                            setMessage('Choose an image smaller than 5 MB.')
                            event.target.value = ''
                            return
                          }
                          setPodiumImageFile(file)
                          setMessage('')
                        }}
                      />
                    </label>
                    <small>Select a season, then upload its podium image. It will be saved with the driver record.</small>
                  </div>
                )}
                <div className="record-form">
                  {formFields.map((field) => {
                    const value = parsedDraft?.[field]
                    const source = relationFields[field]
                    const options = source ? (relations.data?.[source] ?? []) : []
                    const searchableRelation = table === 'driver_podiums' && (field === 'driver_id' || field === 'season_id')
                    return (
                      <label key={field}>
                        {labelFor(field)}
                        {searchableRelation ? (
                          <>
                            <input
                              type="search"
                              list={`podium-${field}-options`}
                              value={relationSearch[field] ?? (() => {
                                const selected = options.find((option: Record<string, unknown>) => String(option.id) === String(value ?? ''))
                                return selected ? relationLabel(source, selected) : ''
                              })()}
                              onChange={(event) => {
                                const typed = event.target.value
                                const selected = options.find((option: Record<string, unknown>) =>
                                  String(option.id).toLowerCase() === typed.toLowerCase() ||
                                  relationLabel(source, option).toLowerCase() === typed.toLowerCase(),
                                )
                                setRelationSearch((current) => ({ ...current, [field]: selected ? relationLabel(source, selected) : typed }))
                                if (selected) updateDraft(field, String(selected.id))
                              }}
                              placeholder={`Search ${labelFor(field)}`}
                            />
                            <datalist id={`podium-${field}-options`}>
                              {options.map((option: Record<string, unknown>) => (
                                <option key={String(option.id)} value={String(option.id)}>
                                  {relationLabel(source, option)}
                                </option>
                              ))}
                            </datalist>
                          </>
                        ) : options.length ? (
                          <select
                            value={value == null ? '' : String(value)}
                            onChange={(event) => updateDraft(field, event.target.value)}
                          >
                            <option value="">Select...</option>
                            {options.map((option: Record<string, unknown>) => (
                              <option key={String(option.id)} value={String(option.id)}>
                                {relationLabel(source, option)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field === 'date' ? 'date' : field === 'time' ? 'time' : typeof value === 'number' ? 'number' : 'text'}
                            value={value == null ? '' : String(value)}
                            onChange={(event) => updateDraft(field, event.target.value)}
                          />
                        )}
                      </label>
                    )
                  })}
                </div>
                <button className="outline-button" disabled={busy} onClick={() => void saveRow()}>
                  {busy ? 'Saving...' : 'Save record'} <span>{'->'}</span>
                </button>
              </div>
            ) : (
              <div className="crud-table">
                {rows.isLoading || relations.isLoading ? (
                  <p className="detail-empty">Loading records...</p>
                ) : rows.error ? (
                  <p className="detail-empty">{rows.error.message}</p>
                ) : !rows.data?.length ? (
                  <p className="detail-empty">No records in this table.</p>
                ) : !filteredRows.length ? (
                  <p className="detail-empty">No records match "{searchTerm}".</p>
                ) : (
                  filteredRows.map((row) => {
                    const displayed = displayRow(row)
                    const summary = rowSummary(row)
                    const chips = new Set(summary.chips.map(([key]) => key))
                    const extras = visibleEntries(displayed).filter(([key]) => !chips.has(key))

                    return (
                      <div className="crud-row" key={String(row.id)}>
                        {table === 'drivers' && row.headshot_url ? <img className="crud-row-avatar" src={String(row.headshot_url)} alt="" /> : table === 'teams' && row.logo_url ? <img className="crud-row-avatar" src={String(row.logo_url)} alt="" /> : table === 'driver_podiums' && row.image_url ? <img className="crud-row-avatar" src={String(row.image_url)} alt="" /> : <code>{String(row.id)}</code>}
                        <div className="crud-row-body">
                          <strong>{summary.title}</strong>
                          <div className="crud-row-fields">
                            {summary.chips.map(([key, value]) => (
                              <span className="crud-row-chip" key={key}>
                                <span>{labelFor(key)}</span>
                                <em>{formatValue(value)}</em>
                              </span>
                            ))}
                            {extras.map(([key, value]) => (
                              <span className="crud-row-chip" key={key}>
                                <span>{labelFor(key)}</span>
                                <em>{formatValue(value)}</em>
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="crud-row-actions">
                          <button className="text-button" onClick={() => editRow(row)}>Edit</button>
                          <button className="danger-button" disabled={busy} onClick={() => void removeRow(row)}>Delete</button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>}
        </>
      )}
      {message && <p className="admin-message">{message}</p>}
    </section>
  )
}
