import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getDrivers, getRaces, getResults, getSeasons, getTeams } from '../lib/f1Repository'
import type { Driver } from '../data/f1Data'

const driverName = (driver: Driver) => driver.family_name ?? driver.name?.trim().split(/\s+/).pop() ?? driver.given_name ?? 'Unknown driver'

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
  const linkedResults = (results.data ?? []).filter((result) => kind === 'driver' ? result.driver_id === id : result.team_id === id)
  const teammateResults = kind === 'driver' ? (results.data ?? []).filter((result) => result.driver_id !== id && result.team_id && linkedResults.some((linkedResult) => linkedResult.race_id === result.race_id && linkedResult.team_id === result.team_id)) : []
  const linkedDrivers = kind === 'team' ? [...new Set(linkedResults.map((result) => result.driver_id))].map((driverId) => drivers.data?.find((row) => row.id === driverId)).filter((row): row is Driver => Boolean(row)) : []
  const grouped = new Map<string, typeof linkedResults>()
  linkedResults.forEach((result) => grouped.set(result.race_id, [...(grouped.get(result.race_id) ?? []), result]))
  const groupedTeamResults = [...grouped.entries()]
  const teamSummary = useMemo(() => {
    const summary = new Map<string, { races: number; points: number }>()
    linkedResults.forEach((result) => {
      if (!result.team_id) return
      const current = summary.get(result.team_id) ?? { races: 0, points: 0 }
      current.races += 1
      current.points += Number(result.points ?? 0)
      summary.set(result.team_id, current)
    })
    return [...summary.entries()].map(([teamId, stats]) => ({ teamId, ...stats }))
  }, [linkedResults])
  const teammateSummary = [...teammateResults.reduce((summary, result) => {
    const key = `${result.driver_id}-${result.team_id}`
    const race = races.data?.find((item) => item.id === result.race_id)
    const year = race?.season_id ? seasonYears.get(race.season_id) : undefined
    const current = summary.get(key) ?? { driverId: result.driver_id, teamId: result.team_id ?? '', years: new Set<number>() }
    if (year) current.years.add(year)
    summary.set(key, current)
    return summary
  }, new Map<string, { driverId: string; teamId: string; years: Set<number> }>()).values()]
  const raceLabel = (raceId: string) => {
    const race = races.data?.find((item) => item.id === raceId)
    const year = race?.season_id ? seasonYears.get(race.season_id) : undefined
    return `${year ? `${year} ` : ''}${race?.name ?? 'Unknown race'}`
  }
  const title = kind === 'driver' ? (driver ? driverName(driver) : 'Driver not found') : (team?.name ?? 'Team not found')
  if (drivers.isLoading || teams.isLoading || races.isLoading || seasons.isLoading || results.isLoading) return <section className="empty-state"><strong>Loading imported relationships...</strong></section>

  return (
    <section className="detail-page">
      <Link className="back-link" to={`/${kind}s`}>{'<-'} Back to archive</Link>
      <p className="eyebrow">IMPORTED DATABASE RECORD / {kind.toUpperCase()}</p>
      <h1>{title}</h1>
      <p className="detail-subtitle">{kind === 'driver' ? `${driver?.nationality ?? 'Nationality pending'} / linked teams and race results` : 'Linked drivers and race results'}</p>
      {kind === 'driver' && <section className="race-detail-section"><div className="section-heading"><div><p className="eyebrow">CAREER LINKS</p><h2>Teams raced for</h2></div><span className="detail-count">{teamSummary.length} TEAMS</span></div>{teamSummary.length ? <div className="standings-table entity-team-table"><div className="table-head"><span>TEAM</span><span>RACES</span><span>POINTS</span></div>{teamSummary.map((summary) => <Link className="table-row" key={summary.teamId} to={`/teams/${summary.teamId}`}><span className="driver-cell">{teamNames.get(summary.teamId) ?? 'Unknown team'}</span><span>{summary.races}</span><strong>{summary.points}</strong></Link>)}</div> : <p className="detail-empty">No imported team results are linked to this driver yet.</p>}</section>}
      {kind === 'driver' && <section className="race-detail-section"><div className="section-heading"><div><p className="eyebrow">RACE PARTNERS</p><h2>Teammates</h2></div><span className="detail-count">{teammateSummary.length} RELATIONSHIPS</span></div>{teammateSummary.length ? <div className="standings-table"><div className="table-head"><span>DRIVER</span><span>TEAM</span><span>PERIOD</span></div>{teammateSummary.map((summary) => { const years = [...summary.years].sort((a, b) => a - b); const period = years.length ? `${years[0]}${years.length > 1 ? `-${years[years.length - 1]}` : ''}` : 'Period unknown'; return <div className="table-row teammate-row" key={`${summary.driverId}-${summary.teamId}`}><span className="driver-cell">{driverNames.get(summary.driverId) ?? 'Unknown driver'}</span><span className="team-cell">{teamNames.get(summary.teamId) ?? 'Unknown team'}</span><strong>{period}</strong></div> })}</div> : <p className="detail-empty">No imported teammate relationships are linked to this driver yet.</p>}</section>}
      {kind === 'team' && <section className="race-detail-section"><div className="section-heading"><div><p className="eyebrow">TEAM ROSTER</p><h2>Drivers</h2></div><span className="detail-count">{linkedDrivers.length} DRIVERS</span></div>{linkedDrivers.length ? <div className="driver-roster">{linkedDrivers.map((linkedDriver) => <Link className="roster-driver" key={linkedDriver.id} to={`/drivers/${linkedDriver.id}`}><span className="driver-roster-mark" />{driverName(linkedDriver)}<span>{'->'}</span></Link>)}</div> : <p className="detail-empty">No imported driver results are linked to this team yet.</p>}</section>}
      <section className="race-detail-section"><div className="section-heading"><div><p className="eyebrow">RESULTS RELATIONSHIP</p><h2>{kind === 'driver' ? 'Race results' : 'Drivers raced with'}</h2></div><span className="detail-count">{kind === 'driver' ? linkedResults.length : groupedTeamResults.length} RACES</span></div>{!linkedResults.length ? <p className="detail-empty">No imported race results link to this record yet.</p> : kind === 'driver' ? <div className="standings-table"><div className="table-head"><span>RACE</span><span>TEAM</span><span>POS</span><span>PTS</span></div>{linkedResults.map((result) => <div className="table-row" key={result.id}><span>{raceLabel(result.race_id)}</span><span className="team-cell">{teamNames.get(result.team_id ?? '') ?? 'Unknown team'}</span><span>{result.position ?? '-'}</span><strong>{result.points ?? 0}</strong></div>)}</div> : <div className="standings-table"><div className="table-head"><span>RACE</span><span>DRIVER</span><span>POS</span><span>PTS</span></div>{groupedTeamResults.flatMap(([raceId, raceResults]) => raceResults.map((result) => <div className="table-row team-race-row" key={result.id}><span>{raceLabel(raceId)}</span><span className="driver-cell">{driverNames.get(result.driver_id) ?? 'Unknown driver'}</span><span>{result.position ?? '-'}</span><strong>{result.points ?? 0}</strong></div>))}</div>}</section>
    </section>
  )
}
