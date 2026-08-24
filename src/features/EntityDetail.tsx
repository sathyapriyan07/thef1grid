import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getDrivers, getRaces, getResults, getSeasons, getTeams } from '../lib/f1Repository'
import type { Driver } from '../data/f1Data'

const driverName = (driver: Driver) => driver.name ?? `${driver.given_name ?? ''} ${driver.family_name ?? ''}`.trim()

export default function EntityDetail({ kind }: { kind: 'driver' | 'team' }) {
  const { id = '' } = useParams()
  const drivers = useQuery({ queryKey: ['drivers'], queryFn: getDrivers })
  const teams = useQuery({ queryKey: ['teams'], queryFn: getTeams })
  const races = useQuery({ queryKey: ['races'], queryFn: getRaces })
  const seasons = useQuery({ queryKey: ['seasons'], queryFn: getSeasons })
  const results = useQuery({ queryKey: ['results'], queryFn: getResults })
  const driver = drivers.data?.find((row) => row.id === id)
  const team = teams.data?.find((row) => row.id === id)
  const driverNames = useMemo(() => new Map((drivers.data ?? []).map((row) => [row.id, driverName(row)])), [drivers.data])
  const teamNames = useMemo(() => new Map((teams.data ?? []).map((row) => [row.id, row.name])), [teams.data])
  const seasonYears = useMemo(() => new Map((seasons.data ?? []).map((row) => [row.id, row.year])), [seasons.data])
  const linkedResults = (results.data ?? []).filter((row) => kind === 'driver' ? row.driver_id === id : row.team_id === id)
  const linkedDrivers = kind === 'team' ? [...new Set(linkedResults.map((result) => result.driver_id))].map((driverId) => drivers.data?.find((row) => row.id === driverId)).filter((row): row is Driver => Boolean(row)) : []
  const linkedTeams = kind === 'driver' ? [...new Set(linkedResults.map((result) => result.team_id).filter((teamId): teamId is string => Boolean(teamId)))].map((teamId) => teams.data?.find((row) => row.id === teamId)).filter((row) => Boolean(row)) : []
  const grouped = new Map<string, typeof linkedResults>()
  linkedResults.forEach((result) => grouped.set(result.race_id, [...(grouped.get(result.race_id) ?? []), result]))
  const groupedTeamResults = [...grouped.entries()]
  const raceLabel = (raceId: string) => { const race = races.data?.find((row) => row.id === raceId); const year = race?.season_id ? seasonYears.get(race.season_id) : undefined; return `${year ? `${year} ` : ''}${race?.name ?? 'Unknown race'}` }
  const title = kind === 'driver' ? (driver ? driverName(driver) : 'Driver not found') : (team?.name ?? 'Team not found')
  if (drivers.isLoading || teams.isLoading || races.isLoading || seasons.isLoading || results.isLoading) return <section className="empty-state"><strong>Loading imported relationships...</strong></section>
  const teamOf = (result: typeof linkedResults[number]) => teamNames.get(result.team_id ?? '') ?? 'Unknown team'
  return <section className="detail-page"><Link className="back-link" to={`/${kind}s`}>← Back to archive</Link><p className="eyebrow">IMPORTED DATABASE RECORD / {kind.toUpperCase()}</p><h1>{title}</h1><p className="detail-subtitle">{kind === 'driver' ? `${driver?.nationality ?? 'Nationality pending'} / linked teams and race results` : 'Linked drivers and race results'}</p>{kind === 'driver' && <section className="race-detail-section"><div className="section-heading"><div><p className="eyebrow">CAREER LINKS</p><h2>Teams</h2></div><span className="detail-count">{linkedTeams.length} TEAMS</span></div>{linkedTeams.length ? <div className="driver-roster">{linkedTeams.map((linkedTeam) => <Link className="roster-driver" key={linkedTeam?.id} to={`/teams/${linkedTeam?.id}`}><span className="driver-roster-mark" />{linkedTeam?.name}<span>→</span></Link>)}</div> : <p className="detail-empty">No imported team results are linked to this driver yet.</p>}</section>}{kind === 'team' && <section className="race-detail-section"><div className="section-heading"><div><p className="eyebrow">TEAM ROSTER</p><h2>Drivers</h2></div><span className="detail-count">{linkedDrivers.length} DRIVERS</span></div>{linkedDrivers.length ? <div className="driver-roster">{linkedDrivers.map((linkedDriver) => <Link className="roster-driver" key={linkedDriver.id} to={`/drivers/${linkedDriver.id}`}><span className="driver-roster-mark" />{driverName(linkedDriver)}<span>→</span></Link>)}</div> : <p className="detail-empty">No imported driver results are linked to this team yet.</p>}</section>}<section className="race-detail-section"><div className="section-heading"><div><p className="eyebrow">RESULTS RELATIONSHIP</p><h2>{kind === 'driver' ? 'Teams raced for' : 'Drivers raced with'}</h2></div><span className="detail-count">{kind === 'driver' ? linkedResults.length : groupedTeamResults.length} RACES</span></div>{!linkedResults.length ? <p className="detail-empty">No imported race results link to this record yet.</p> : kind === 'driver' ? <div className="standings-table"><div className="table-head"><span>RACE</span><span>TEAM</span><span>POS</span><span>PTS</span></div>{linkedResults.map((result) => <div className="table-row" key={result.id}><span>{raceLabel(result.race_id)}</span><span className="team-cell">{teamOf(result)}</span><span>{result.position ?? '-'}</span><strong>{result.points ?? 0}</strong></div>)}</div> : <div className="standings-table"><div className="table-head"><span>RACE</span><span>DRIVER 1</span><span>DRIVER 2</span><span>PTS</span></div>{groupedTeamResults.map(([raceId, raceResults]) => <div className="table-row team-race-row" key={raceId}><span>{raceLabel(raceId)}</span><span className="driver-cell">{driverNames.get(raceResults[0]?.driver_id ?? '') ?? 'Unknown driver'}<small>P{raceResults[0]?.position ?? '-'} / {raceResults[0]?.points ?? 0} pts</small></span><span className="driver-cell">{driverNames.get(raceResults[1]?.driver_id ?? '') ?? 'Unknown driver'}<small>P{raceResults[1]?.position ?? '-'} / {raceResults[1]?.points ?? 0} pts</small></span><strong>{raceResults.reduce((total, result) => total + (result.points ?? 0), 0)}</strong></div>)}</div>}</section></section>
}
