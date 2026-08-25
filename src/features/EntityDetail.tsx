import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCircuits, getDriverPodiums, getDriverStandings, getDrivers, getQualifyingResults, getRaces, getResults, getSeasons, getStatuses, getTeams } from '../lib/f1Repository'
import type { Driver } from '../data/f1Data'

const driverName = (driver: Driver) => driver.family_name ?? driver.name?.trim().split(/\s+/).pop() ?? driver.given_name ?? 'Unknown driver'

export default function EntityDetail({ kind }: { kind: 'driver' | 'team' }) {
  const { id = '' } = useParams()
  const drivers = useQuery({ queryKey: ['drivers'], queryFn: getDrivers })
  const teams = useQuery({ queryKey: ['teams'], queryFn: getTeams })
  const races = useQuery({ queryKey: ['races'], queryFn: getRaces })
  const seasons = useQuery({ queryKey: ['seasons'], queryFn: getSeasons })
  const results = useQuery({ queryKey: ['results'], queryFn: getResults })
  const qualifying = useQuery({ queryKey: ['qualifying_results'], queryFn: getQualifyingResults })
  const standings = useQuery({ queryKey: ['driver_standings'], queryFn: getDriverStandings })
  const circuits = useQuery({ queryKey: ['circuits'], queryFn: getCircuits })
  const statuses = useQuery({ queryKey: ['status'], queryFn: getStatuses })
  const podiums = useQuery({ queryKey: ['driver_podiums'], queryFn: getDriverPodiums })
  const driver = drivers.data?.find((row) => row.id === id)
  const team = teams.data?.find((row) => row.id === id)
  const driverNames = useMemo(() => new Map((drivers.data ?? []).map((row) => [row.id, driverName(row)])), [drivers.data])
  const teamNames = useMemo(() => new Map((teams.data ?? []).map((row) => [row.id, row.name])), [teams.data])
  const teamLogos = useMemo(() => new Map((teams.data ?? []).flatMap((row) => row.logo_url ? [[row.id, row.logo_url] as [string, string]] : [])), [teams.data])
  const podiumImages = useMemo(() => new Map((podiums.data ?? []).flatMap((row) => row.image_url ? [[row.driver_id, row.image_url] as [string, string]] : [])), [podiums.data])
  const seasonYears = useMemo(() => new Map((seasons.data ?? []).map((row) => [row.id, row.year])), [seasons.data])
  const circuitNames = useMemo(() => new Map((circuits.data ?? []).map((row) => [row.id, row.name])), [circuits.data])
  const statusNames = useMemo(() => new Map((statuses.data ?? []).map((row) => [row.id, row.status_text ?? 'Unknown'])), [statuses.data])
  const linkedResults = (results.data ?? []).filter((result) => kind === 'driver' ? result.driver_id === id : result.team_id === id)
  const teammateResults = kind === 'driver' ? (results.data ?? []).filter((result) => result.driver_id !== id && result.team_id && linkedResults.some((linkedResult) => linkedResult.race_id === result.race_id && linkedResult.team_id === result.team_id)) : []
  const linkedDrivers = kind === 'team' ? [...new Set(linkedResults.map((result) => result.driver_id))].map((driverId) => drivers.data?.find((row) => row.id === driverId)).filter((row): row is Driver => Boolean(row)) : []
  const grouped = new Map<string, typeof linkedResults>()
  linkedResults.forEach((result) => grouped.set(result.race_id, [...(grouped.get(result.race_id) ?? []), result]))
  const groupedTeamResults = [...grouped.entries()]
  const driverPeriods = new Map<string, number[]>()
  linkedResults.forEach((result) => {
    const race = races.data?.find((item) => item.id === result.race_id)
    const year = race?.season_id ? seasonYears.get(race.season_id) : undefined
    if (year) driverPeriods.set(result.driver_id, [...(driverPeriods.get(result.driver_id) ?? []), year])
  })
  const driverQualifying = (qualifying.data ?? []).filter((row) => row.driver_id === id)
  const qualifyingStats = useMemo(() => {
    const positions = driverQualifying.map((row) => row.position).filter((position): position is number => position != null)
    const headToHead = driverQualifying.reduce((score, row) => {
      const teammates = (qualifying.data ?? []).filter((candidate) => candidate.race_id === row.race_id && candidate.team_id && candidate.team_id === row.team_id && candidate.driver_id !== id && candidate.position != null)
      const bestTeammate = Math.min(...teammates.map((candidate) => candidate.position as number))
      return teammates.length && row.position != null && row.position < bestTeammate ? score + 1 : score
    }, 0)
    return {
      poles: positions.filter((position) => position === 1).length,
      frontRow: positions.filter((position) => position <= 2).length,
      best: positions.length ? Math.min(...positions) : '-',
      average: positions.length ? (positions.reduce((sum, position) => sum + position, 0) / positions.length).toFixed(1) : '-',
      q1: driverQualifying.filter((row) => row.q1).length,
      q2: driverQualifying.filter((row) => row.q2).length,
      q3: driverQualifying.filter((row) => row.q3).length,
      headToHead,
      teammateStarts: driverQualifying.length,
    }
  }, [driverQualifying, qualifying.data, id])
  const careerStats = useMemo(() => {
    const starts = linkedResults.length
    const wins = linkedResults.filter((result) => result.position === 1).length
    const podiumsCount = linkedResults.filter((result) => result.position != null && result.position <= 3).length
    const poles = driverQualifying.filter((result) => result.position === 1).length
    const fastestLaps = linkedResults.filter((result) => result.fastest_lap_rank === 1).length
    const points = linkedResults.reduce((sum, result) => sum + Number(result.points ?? 0), 0)
    const championships = new Set((standings.data ?? []).filter((result) => result.driver_id === id && result.position === 1).map((result) => result.season_id)).size
    const championshipPositions = (standings.data ?? []).filter((result) => result.driver_id === id && result.position != null).map((result) => result.position as number)
    const bestChampionship = championshipPositions.length ? Math.min(...championshipPositions) : '-'
    const racePositions = linkedResults.filter((result) => result.position != null).map((result) => result.position as number)
    const bestRace = racePositions.length ? Math.min(...racePositions) : '-'
    const dnfs = linkedResults.filter((result) => {
      const status = statusNames.get(result.status_id ?? '')?.toLowerCase() ?? ''
      return status.includes('dnf') || status.includes('retired') || (result.position == null && !status.includes('not classified'))
    }).length
    const laps = linkedResults.reduce((sum, result) => sum + Number(result.laps ?? 0), 0)
    return [
      ['STARTS', starts], ['WINS', wins], ['PODIUMS', podiumsCount], ['POLES', poles],
      ['FASTEST LAPS', fastestLaps], ['POINTS', points], ['WORLD CHAMPIONSHIPS', championships], ['DNFs', dnfs],
      ['BEST CHAMPIONSHIP', bestChampionship], ['BEST RACE FINISH', bestRace], ['LAPS LED', '—'], ['TOTAL LAPS', laps],
      ['POINTS / RACE', starts ? (points / starts).toFixed(2) : '-'], ['WIN RATE', starts ? `${((wins / starts) * 100).toFixed(1)}%` : '-'], ['PODIUM RATE', starts ? `${((podiumsCount / starts) * 100).toFixed(1)}%` : '-'],
    ] as Array<[string, number | string]>
  }, [linkedResults, driverQualifying, standings.data, statusNames, id])
  const achievements = useMemo(() => {
    if (kind !== 'driver') return []
    const wins = linkedResults.filter((result) => result.position === 1).length
    const podiumsCount = linkedResults.filter((result) => result.position != null && result.position <= 3).length
    const poles = driverQualifying.filter((result) => result.position === 1).length
    const championships = new Set((standings.data ?? []).filter((result) => result.driver_id === id && result.position === 1).map((result) => result.season_id)).size
    const starts = linkedResults.length
    const sorted = [...linkedResults].sort((a, b) => String(races.data?.find((race) => race.id === a.race_id)?.date ?? '').localeCompare(String(races.data?.find((race) => race.id === b.race_id)?.date ?? '')))
    const longestStreak = (predicate: (result: typeof linkedResults[number]) => boolean) => sorted.reduce((state, result) => ({ current: predicate(result) ? state.current + 1 : 0, best: Math.max(state.best, predicate(result) ? state.current + 1 : 0) }), { current: 0, best: 0 }).best
    return [
      championships ? `World Champion x ${championships}` : null,
      wins ? `${wins} Grand Prix wins` : null,
      podiumsCount ? `${podiumsCount} podiums` : null,
      poles ? `${poles} pole positions` : null,
      longestStreak((result) => result.position != null && result.position <= 3) >= 3 ? `${longestStreak((result) => result.position != null && result.position <= 3)} consecutive podiums` : null,
      starts >= 300 ? `${starts}+ race starts` : starts ? `${starts} race starts` : null,
    ].filter((achievement): achievement is string => Boolean(achievement))
  }, [kind, linkedResults, driverQualifying, standings.data, races.data, id])
  const records = useMemo(() => {
    if (kind !== 'driver') return []
    const circuitStats = new Map<string, { wins: number; podiums: number }>()
    const teamStarts = new Map<string, number>()
    const seasonWins = new Map<string, number>()
    linkedResults.forEach((result) => {
      const race = races.data?.find((item) => item.id === result.race_id)
      const circuit = race?.circuit_id ? circuitNames.get(race.circuit_id) ?? 'Unknown circuit' : race?.circuit ?? 'Unknown circuit'
      const circuitRecord = circuitStats.get(circuit) ?? { wins: 0, podiums: 0 }
      if (result.position === 1) { circuitRecord.wins += 1; if (race?.season_id) seasonWins.set(race.season_id, (seasonWins.get(race.season_id) ?? 0) + 1) }
      if (result.position != null && result.position <= 3) circuitRecord.podiums += 1
      circuitStats.set(circuit, circuitRecord)
      if (result.team_id) teamStarts.set(result.team_id, (teamStarts.get(result.team_id) ?? 0) + 1)
    })
    const bestBy = (field: 'wins' | 'podiums') => [...circuitStats.entries()].sort((a, b) => b[1][field] - a[1][field])[0]
    const bestTeam = [...teamStarts.entries()].sort((a, b) => b[1] - a[1])[0]
    const bestSeason = [...seasonWins.entries()].sort((a, b) => b[1] - a[1])[0]
    const sorted = [...linkedResults].sort((a, b) => String(races.data?.find((race) => race.id === a.race_id)?.date ?? '').localeCompare(String(races.data?.find((race) => race.id === b.race_id)?.date ?? '')))
    const longestPoints = sorted.reduce((state, result) => ({ current: Number(result.points ?? 0) > 0 ? state.current + 1 : 0, best: Math.max(state.best, Number(result.points ?? 0) > 0 ? state.current + 1 : 0) }), { current: 0, best: 0 }).best
    const winsWithDates = sorted.filter((result) => result.position === 1).map((result) => races.data?.find((race) => race.id === result.race_id)?.date).filter(Boolean) as string[]
    const ageAt = (date: string) => driver?.dob ? Math.floor((new Date(date).getTime() - new Date(driver.dob).getTime()) / 31557600000) : null
    const youngest = winsWithDates.length ? ageAt(winsWithDates[0]) : null
    const oldest = winsWithDates.length ? ageAt(winsWithDates[winsWithDates.length - 1]) : null
    return [
      bestBy('wins') ? `Most wins at ${bestBy('wins')![0]} (${bestBy('wins')![1].wins})` : null,
      bestBy('podiums') ? `Most podiums at ${bestBy('podiums')![0]} (${bestBy('podiums')![1].podiums})` : null,
      longestPoints ? `Most consecutive points finishes (${longestPoints})` : null,
      bestTeam ? `Most starts for ${teamNames.get(bestTeam[0]) ?? 'Unknown team'} (${bestTeam[1]})` : null,
      bestSeason ? `Most wins in a season (${seasonYears.get(bestSeason[0]) ?? bestSeason[0]}: ${bestSeason[1]})` : null,
      youngest != null ? `Youngest win at ${youngest}` : null,
      oldest != null ? `Oldest win at ${oldest}` : null,
    ].filter((record): record is string => Boolean(record))
  }, [kind, linkedResults, races.data, circuitNames, teamNames, seasonYears, driver])
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
  const classifiedRaceResults = linkedResults.filter((result) => result.position != null)
  const averageRacePosition = classifiedRaceResults.length
    ? (classifiedRaceResults.reduce((sum, result) => sum + Number(result.position), 0) / classifiedRaceResults.length).toFixed(1)
    : '-'
  const title = kind === 'driver' ? (driver ? driverName(driver) : 'Driver not found') : (team?.name ?? 'Team not found')
  if (drivers.isLoading || teams.isLoading || races.isLoading || seasons.isLoading || results.isLoading || qualifying.isLoading || circuits.isLoading || standings.isLoading || statuses.isLoading || podiums.isLoading) return <section className="empty-state"><strong>Loading imported relationships...</strong></section>

  return (
    <section className={`detail-page entity-${kind}-page`}>
      <Link className="back-link" to={`/${kind}s`}>{'<-'} Back to archive</Link>
      <p className="eyebrow">IMPORTED DATABASE RECORD / {kind.toUpperCase()}</p>
      <h1>{title}</h1>
      <p className="detail-subtitle">{kind === 'driver' ? `${driver?.nationality ?? 'Nationality pending'} / linked teams and race results` : 'Linked drivers and race results'}</p>
      {kind === 'driver' && <section className="race-detail-section career-stats-section"><div className="section-heading"><div><p className="eyebrow">CAREER OVERVIEW</p><h2>Career Statistics</h2></div><span className="detail-count">{linkedResults.length} STARTS</span></div><div className="career-stats-grid">{careerStats.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>}
      {kind === 'driver' && <>
        <section className="race-detail-section achievement-section"><div className="section-heading"><div><p className="eyebrow">CAREER MILESTONES</p><h2>Major Achievements</h2></div><span className="detail-count">{achievements.length} MILESTONES</span></div>{achievements.length ? <div className="achievement-grid">{achievements.map((achievement) => <div className="achievement-card" key={achievement}><strong>{achievement}</strong></div>)}</div> : <p className="detail-empty">Achievements will appear as more results are imported.</p>}</section>
        <section className="race-detail-section record-section"><div className="section-heading"><div><p className="eyebrow">CAREER MARKS</p><h2>Records</h2></div><span className="detail-count">{records.length} RECORDS</span></div>{records.length ? <div className="record-list">{records.map((record) => <div className="record-item" key={record}><span>RECORD</span><strong>{record}</strong></div>)}</div> : <p className="detail-empty">Records will appear as more results are imported.</p>}</section>
      </>}
      {kind === 'driver' && <>
        <section className="race-detail-section qualifying-stats-section"><div className="section-heading"><div><p className="eyebrow">QUALIFYING STATISTICS</p><h2>Qualifying Statistics</h2></div><span className="detail-count">{driverQualifying.length} STARTS</span></div><div className="performance-stat-grid"><div><span>POLES</span><strong>{qualifyingStats.poles}</strong></div><div><span>FRONT ROW</span><strong>{qualifyingStats.frontRow}</strong></div><div><span>BEST QUALIFYING</span><strong>{qualifyingStats.best}</strong></div><div><span>AVG QUALIFYING</span><strong>{qualifyingStats.average}</strong></div><div><span>AVG RACE POSITION</span><strong>{averageRacePosition}</strong></div><div><span>Q1 APPEARANCES</span><strong>{qualifyingStats.q1}</strong></div><div><span>Q2 APPEARANCES</span><strong>{qualifyingStats.q2}</strong></div><div><span>Q3 APPEARANCES</span><strong>{qualifyingStats.q3}</strong></div><div><span>QUALI H2H</span><strong>{qualifyingStats.headToHead} / {qualifyingStats.teammateStarts}</strong></div></div></section>
      </>}
      {kind === 'driver' && <section className="race-detail-section"><div className="section-heading"><div><p className="eyebrow">CAREER LINKS</p><h2>Teams raced for</h2></div><span className="detail-count">{teamSummary.length} TEAMS</span></div>{teamSummary.length ? <div className="standings-table entity-team-table"><div className="table-head"><span>TEAM</span><span>RACES</span><span>POINTS</span></div>{teamSummary.map((summary) => <Link className="table-row" key={summary.teamId} to={`/teams/${summary.teamId}`}><span className="driver-cell">{teamLogos.get(summary.teamId) ? <img className="table-team-logo" src={teamLogos.get(summary.teamId)} alt="" /> : null}{teamNames.get(summary.teamId) ?? 'Unknown team'}</span><span>{summary.races}</span><strong>{summary.points}</strong></Link>)}</div> : <p className="detail-empty">No imported team results are linked to this driver yet.</p>}</section>}
      {kind === 'driver' && <section className="race-detail-section"><div className="section-heading"><div><p className="eyebrow">RACE PARTNERS</p><h2>Teammates</h2></div><span className="detail-count">{teammateSummary.length} RELATIONSHIPS</span></div>{teammateSummary.length ? <div className="teammate-card-grid">{teammateSummary.map((summary) => { const years = [...summary.years].sort((a, b) => a - b); const period = years.length ? `${years[0]}${years.length > 1 ? `-${years[years.length - 1]}` : ''}` : 'Period unknown'; return <Link className="teammate-card" key={`${summary.driverId}-${summary.teamId}`} to={`/drivers/${summary.driverId}`}><div className="teammate-card-copy"><p className="eyebrow">TEAMMATE</p><h3>{driverNames.get(summary.driverId) ?? 'Unknown driver'}</h3><div className="podium-team">{teamLogos.get(summary.teamId) ? <img src={teamLogos.get(summary.teamId)} alt="" /> : null}<span>{teamNames.get(summary.teamId) ?? 'Unknown team'}</span></div><p className="teammate-period">{period}</p></div><div className="teammate-card-image">{podiumImages.get(summary.driverId) ? <img src={podiumImages.get(summary.driverId)} alt={`${driverNames.get(summary.driverId) ?? 'Teammate'} podium`} /> : <span>NO IMAGE</span>}</div></Link>})}</div> : <p className="detail-empty">No imported teammate relationships are linked to this driver yet.</p>}</section>}
      {kind === 'team' && <section className="race-detail-section"><div className="section-heading"><div><p className="eyebrow">TEAM ROSTER</p><h2>Drivers</h2></div><span className="detail-count">{linkedDrivers.length} DRIVERS</span></div>{linkedDrivers.length ? <div className="driver-roster-card-grid">{linkedDrivers.map((linkedDriver) => { const years = [...new Set(driverPeriods.get(linkedDriver.id) ?? [])].sort((a, b) => a - b); const period = years.length ? `${years[0]}${years.length > 1 ? `-${years[years.length - 1]}` : ''}` : 'Period unknown'; return <Link className="driver-roster-card" key={linkedDriver.id} to={`/drivers/${linkedDriver.id}`}><div className="driver-roster-card-copy"><p className="eyebrow">DRIVER</p><h3>{driverName(linkedDriver)}</h3><p className="driver-roster-period">{period}</p></div><div className="driver-roster-card-image">{podiumImages.get(linkedDriver.id) ? <img src={podiumImages.get(linkedDriver.id)} alt={`${driverName(linkedDriver)} podium`} /> : <span>NO IMAGE</span>}</div></Link>})}</div> : <p className="detail-empty">No imported driver results are linked to this team yet.</p>}</section>}
      <section className="race-detail-section"><div className="section-heading"><div><p className="eyebrow">RESULTS RELATIONSHIP</p><h2>{kind === 'driver' ? 'Race results' : 'Drivers raced with'}</h2></div><span className="detail-count">{kind === 'driver' ? linkedResults.length : groupedTeamResults.length} RACES</span></div>{!linkedResults.length ? <p className="detail-empty">No imported race results link to this record yet.</p> : kind === 'driver' ? <div className="standings-table"><div className="table-head"><span>RACE</span><span>TEAM</span><span>POS</span><span>PTS</span></div>{linkedResults.map((result) => <div className="table-row" key={result.id}><span>{raceLabel(result.race_id)}</span><span className="team-cell">{teamNames.get(result.team_id ?? '') ?? 'Unknown team'}</span><span>{result.position ?? '-'}</span><strong>{result.points ?? 0}</strong></div>)}</div> : <div className="standings-table"><div className="table-head"><span>RACE</span><span>DRIVER</span><span>POS</span><span>PTS</span></div>{groupedTeamResults.flatMap(([raceId, raceResults]) => raceResults.map((result) => <div className="table-row team-race-row" key={result.id}><span>{raceLabel(raceId)}</span><span className="driver-cell">{driverNames.get(result.driver_id) ?? 'Unknown driver'}</span><span>{result.position ?? '-'}</span><strong>{result.points ?? 0}</strong></div>))}</div>}</section>
    </section>
  )
}
