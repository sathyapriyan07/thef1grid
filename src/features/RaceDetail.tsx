import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  getDrivers,
  getDriverPodiums,
  getCircuits,
  getLaps,
  getPitstops,
  getQualifyingResults,
  getRaces,
  getResults,
  getSprintResults,
  getTeams,
} from "../lib/f1Repository";
import type { Driver } from "../data/f1Data";

type Row = {
  id: string;
  race_id: string;
  driver_id: string;
  team_id?: string;
  position?: number;
  points?: number;
  grid?: number;
  laps?: number;
  stop_number?: number;
  lap?: number;
  time?: string;
  duration_ms?: number;
  lap_number?: number;
  time_ms?: number;
  q1?: string;
  q2?: string;
  q3?: string;
};
const nameOf = (row: Driver) =>
  row.family_name ?? row.name?.trim().split(/\s+/).pop() ?? row.given_name ?? "Unknown driver";
const timeOf = (value?: number) =>
  value == null
    ? "-"
    : `${Math.floor(value / 60000)}:${String(Math.floor(value / 1000) % 60).padStart(2, "0")}.${String(value % 1000).padStart(3, "0")}`;
function Table({
  title,
  rows,
  columns,
  empty,
  driverLogos,
  beforeTable,
}: {
  title: string;
  rows: Row[];
  columns: Array<[string, (row: Row, index: number) => ReactNode]>;
  empty: string;
  driverLogos?: Map<string, string>;
  beforeTable?: ReactNode;
}) {
  return (
    <section className="race-detail-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">IMPORTED DATA</p>
          <h2>{title}</h2>
        </div>
        <span className="detail-count">{rows.length} RECORDS</span>
      </div>
      {beforeTable}
      {rows.length === 0 ? (
        <p className="detail-empty">{empty}</p>
      ) : (
        <div className={`standings-table race-data-table ${title.toLowerCase().replaceAll(' ', '-')}`}>
          <div className="table-head">
            {columns.map(([label]) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          {rows.map((row, index) => (
            <div className="table-row" key={row.id}>
              {columns.map(([label, render]) => (
                <span
                  className={
                    label === "DRIVER"
                      ? "driver-cell"
                      : label === "TEAM"
                        ? "team-cell"
                        : ""
                  }
                  key={label}
                >
                  {label === "DRIVER" && driverLogos?.get(row.team_id ?? "") ? <img className="table-team-logo" src={driverLogos.get(row.team_id ?? "")} alt="" /> : null}
                  {render(row, index)}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
export default function RaceDetail() {
  const { id = "" } = useParams();
  const [qualifyingSession, setQualifyingSession] = useState<"Q1" | "Q2" | "Q3">("Q1");
  const races = useQuery({ queryKey: ["races"], queryFn: getRaces });
  const drivers = useQuery({ queryKey: ["drivers"], queryFn: getDrivers });
  const teams = useQuery({ queryKey: ["teams"], queryFn: getTeams });
  const circuits = useQuery({ queryKey: ["circuits"], queryFn: getCircuits });
  const results = useQuery({ queryKey: ["results"], queryFn: getResults });
  const qualifying = useQuery({
    queryKey: ["qualifying_results"],
    queryFn: getQualifyingResults,
  });
  const sprint = useQuery({
    queryKey: ["sprint_results"],
    queryFn: getSprintResults,
  });
  const pitstops = useQuery({ queryKey: ["pitstops"], queryFn: getPitstops });
  const laps = useQuery({ queryKey: ["laps"], queryFn: getLaps });
  const podiums = useQuery({ queryKey: ["driver_podiums"], queryFn: getDriverPodiums });
  const race = races.data?.find((row) => row.id === id);
  const circuit = race?.circuit_id ? circuits.data?.find((row) => row.id === race.circuit_id) : undefined;
  const raceResults = (results.data ?? []).filter((row) => row.race_id === id);
  const winner = raceResults.find((row) => row.position === 1) ?? raceResults[0];
  const winnerDriver = winner ? drivers.data?.find((row) => row.id === winner.driver_id) : undefined;
  const winnerPodium = winner && race?.season_id
    ? podiums.data?.find((row) => row.driver_id === winner.driver_id && row.season_id === race.season_id)
    : undefined;
  const driverNames = useMemo(
    () => new Map((drivers.data ?? []).map((row) => [row.id, nameOf(row)])),
    [drivers.data],
  );
  const teamNames = useMemo(
    () => new Map((teams.data ?? []).map((row) => [row.id, row.name])),
    [teams.data],
  );
  const teamLogos = useMemo(
    () => new Map((teams.data ?? []).flatMap((row) => row.logo_url ? [[row.id, row.logo_url] as [string, string]] : [])),
    [teams.data],
  );
  const filter = (rows: Row[] | undefined) =>
    (rows ?? []).filter((row) => row.race_id === id);
  const qualifyingRows = filter(qualifying.data);
  const driver = (row: Row) =>
    driverNames.get(row.driver_id) ?? "Unknown driver";
  const team = (row: Row) => teamNames.get(row.team_id ?? "") ?? "Unknown team";
  if (races.isLoading || drivers.isLoading || teams.isLoading || circuits.isLoading || podiums.isLoading)
    return (
      <section className="empty-state">
        <strong>Loading imported race data...</strong>
      </section>
    );
  if (!race)
    return (
      <section className="archive-page">
        <h1>Race not found</h1>
        <Link className="back-link" to="/races">
          ← Back to archive
        </Link>
      </section>
    );
  return (
    <section className="detail-page race-detail-page">
      <Link className="back-link" to="/races">
        ← Back to archive
      </Link>
      <h1>{race.name}</h1>
      <p className="detail-subtitle">
        {race.date ?? "Date pending"} / {circuit?.name ?? race.circuit ?? "Circuit pending"} / {circuit?.country ?? race.country ?? ""}
      </p>
      {winner && winnerDriver && (
        <section className="podium-highlight">
          <div className="podium-highlight-copy">
            <p className="eyebrow">RACE WINNER / {race.date?.slice(0, 4) ?? "SEASON"}</p>
            <h2>{nameOf(winnerDriver)}</h2>
            <div className="podium-team">
              {winner?.team_id && teamLogos.get(winner.team_id) ? <img src={teamLogos.get(winner.team_id)} alt="" /> : null}
              <span>{teamNames.get(winner?.team_id ?? "") ?? "Unknown team"}</span>
            </div>
            {!winnerPodium?.image_url && <p>No podium image uploaded for this season yet.</p>}
          </div>
          <div className="podium-highlight-image">
            {winnerPodium?.image_url ? <img src={winnerPodium.image_url} alt={`${nameOf(winnerDriver)} podium`} /> : <span>NO PODIUM IMAGE</span>}
          </div>
        </section>
      )}
      <div className="podium-secondary-row">
        {[2, 3].map((position) => {
          const result = raceResults.find((row) => row.position === position)
          const driverRecord = result ? drivers.data?.find((row) => row.id === result.driver_id) : undefined
          const podium = result && race?.season_id ? podiums.data?.find((row) => row.driver_id === result.driver_id && row.season_id === race.season_id) : undefined
          if (!result || !driverRecord) return null
          return (
            <article className="podium-secondary-card" key={position}>
              <div className="podium-secondary-copy">
                <p className="eyebrow">P{position}</p>
                <h2>{nameOf(driverRecord)}</h2>
                <div className="podium-team">
                  {result.team_id && teamLogos.get(result.team_id) ? <img src={teamLogos.get(result.team_id)} alt="" /> : null}
                  <span>{teamNames.get(result.team_id ?? '') ?? 'Unknown team'}</span>
                </div>
              </div>
              <div className="podium-secondary-image">
                {podium?.image_url ? <img src={podium.image_url} alt={`${nameOf(driverRecord)} podium`} /> : <span>NO IMAGE</span>}
              </div>
            </article>
          )
        })}
      </div>
      <Table
        title="Race results"
        rows={filter(results.data)}
        columns={[
          ["POS", (row, index) => row.position ?? index + 1],
          ["DRIVER", driver],
          ["PTS", (row) => row.points ?? 0],
          ["LAPS", (row) => row.laps ?? 0],
        ]}
        driverLogos={teamLogos}
        empty="No race results imported for this race."
      />
      <Table
        title="Qualifying"
        rows={qualifyingRows}
        columns={[
          ["POS", (row, index) => row.position ?? index + 1],
          ["DRIVER", driver],
          [qualifyingSession, (row) => row[qualifyingSession.toLowerCase() as "q1" | "q2" | "q3"] ?? "-"],
        ]}
        empty="No qualifying records imported for this race."
        driverLogos={teamLogos}
        beforeTable={
          <div className="qualifying-tabs" role="tablist" aria-label="Qualifying sessions">
            {(["Q1", "Q2", "Q3"] as const).map((session) => (
              <button
                type="button"
                role="tab"
                aria-selected={qualifyingSession === session}
                className={qualifyingSession === session ? "active" : ""}
                onClick={() => setQualifyingSession(session)}
              >
                {session}
              </button>
            ))}
          </div>
        }
      />
      <Table
        title="Sprint"
        rows={filter(sprint.data)}
        columns={[
          ["POS", (row, index) => row.position ?? index + 1],
          ["DRIVER", driver],
          ["TEAM", team],
          ["GRID", (row) => row.grid ?? "-"],
          ["PTS", (row) => row.points ?? 0],
          ["LAPS", (row) => row.laps ?? 0],
        ]}
        empty="No sprint records imported for this race."
        driverLogos={teamLogos}
      />
      <Table
        title="Pit stops"
        rows={filter(pitstops.data)}
        columns={[
          ["STOP", (row) => row.stop_number ?? "-"],
          ["DRIVER", driver],
          ["LAP", (row) => row.lap ?? "-"],
          ["TIME", (row) => row.time ?? "-"],
          [
            "DURATION",
            (row) => (row.duration_ms ? timeOf(row.duration_ms) : "-"),
          ],
        ]}
        empty="No pit stops imported for this race."
        driverLogos={teamLogos}
      />
      <Table
        title="Lap chart"
        rows={filter(laps.data)}
        columns={[
          ["LAP", (row) => row.lap_number ?? "-"],
          ["DRIVER", driver],
          ["POS", (row) => row.position ?? "-"],
          ["TIME", (row) => (row.time_ms ? timeOf(row.time_ms) : "-")],
        ]}
        empty="No lap records imported for this race."
        driverLogos={teamLogos}
      />
    </section>
  );
}
