import { useState } from 'react'
import { importEntity, writeImportLog } from '../lib/f1Importer'
import { supabase } from '../lib/supabaseClient'
import { useSupabaseSession } from '../lib/useSupabaseSession'

export default function AdminPage() {
  const signedIn = useSupabaseSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [season, setSeason] = useState('2025')
  const [round, setRound] = useState('')
  const [entity, setEntity] = useState<Parameters<typeof importEntity>[0]>('races')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function signIn() {
    if (!supabase) { setMessage('Set VITE_USE_SUPABASE=true first.'); return }
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
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Import failed'
      await writeImportLog(entity, season, empty, detail)
      setMessage(detail)
    } finally { setBusy(false) }
  }

  return <section className="detail-page admin-page"><p className="eyebrow">PRIVATE WORKSPACE / ADMIN</p><h1>Import control</h1><p className="detail-subtitle">Import Jolpica records into Supabase to make them visible.</p>{!signedIn ? <div className="admin-form"><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="outline-button" onClick={() => void signIn()}>Sign in <span>→</span></button></div> : <div className="import-console"><div className="import-controls"><label>ENTITY<select value={entity} onChange={(event) => setEntity(event.target.value as typeof entity)}><optgroup label="ERGAST COMPATIBLE"><option value="seasons">Seasons</option><option value="circuits">Circuits</option><option value="teams">Constructors / Teams</option><option value="drivers">Drivers</option><option value="races">Races</option><option value="results">Race Results</option><option value="qualifying_results">Qualifying</option><option value="sprint_results">Sprint</option><option value="pitstops">Pit Stops</option><option value="laps">Laps</option><option value="driver_standings">Driver Standings</option><option value="constructor_standings">Constructor Standings</option><option value="status">Status</option></optgroup><optgroup label="ALPHA / ALPHA CORE"><option value="sessions">Sessions</option><option value="session_entries">Session Entries</option><option value="rounds">Rounds</option><option value="alpha_teams">Teams</option><option value="alpha_drivers">Drivers</option><option value="alpha_circuits">Circuits</option><option value="alpha_laps">Laps</option><option value="alpha_pitstops">Pit Stops</option><option value="schedules">Schedules</option></optgroup></select></label><label>SEASON<input value={season} onChange={(event) => setSeason(event.target.value)} /></label><label>ROUND<input value={round} onChange={(event) => setRound(event.target.value)} placeholder="all" /></label><button className="outline-button" disabled={busy} onClick={() => void runImport()}>{busy ? 'Importing...' : 'Import & store'} <span>→</span></button></div><div className="admin-notice">Session is persisted by Supabase Auth. Imports are stored by external reference.</div></div>}{message && <p className="admin-message">{message}</p>}</section>
}
