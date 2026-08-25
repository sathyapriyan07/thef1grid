import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  getDrivers,
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
}: {
  title: string;
  rows: Row[];
  columns: Array<[string, (row: Row, index: number) => string | number]>;
  empty: string;
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
  const races = useQuery({ queryKey: ["races"], queryFn: getRaces });
  const drivers = useQuery({ queryKey: ["drivers"], queryFn: getDrivers });
  const teams = useQuery({ queryKey: ["teams"], queryFn: getTeams });
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
  const race = races.data?.find((row) => row.id === id);
  const driverNames = useMemo(
    () => new Map((drivers.data ?? []).map((row) => [row.id, nameOf(row)])),
    [drivers.data],
  );
  const teamNames = useMemo(
    () => new Map((teams.data ?? []).map((row) => [row.id, row.name])),
    [teams.data],
  );
  const filter = (rows: Row[] | undefined) =>
    (rows ?? []).filter((row) => row.race_id === id);
  const driver = (row: Row) =>
    driverNames.get(row.driver_id) ?? "Unknown driver";
  const team = (row: Row) => teamNames.get(row.team_id ?? "") ?? "Unknown team";
  if (races.isLoading || drivers.isLoading || teams.isLoading)
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
    <section className="detail-page">
      <Link className="back-link" to="/races">
        ← Back to archive
      </Link>
      <p className="eyebrow">DATABASE RECORD / RACE</p>
      <h1>{race.name}</h1>
      <p className="detail-subtitle">
        {race.date ?? "Date pending"} / {race.circuit ?? "Circuit pending"} /{" "}
        {race.country ?? ""}
      </p>
      <Table
        title="Race results"
        rows={filter(results.data)}
        columns={[
          ["POS", (row, index) => row.position ?? index + 1],
          ["DRIVER", driver],
          ["TEAM", team],
          ["PTS", (row) => row.points ?? 0],
          ["LAPS", (row) => row.laps ?? 0],
        ]}
        empty="No race results imported for this race."
      />
      <Table
        title="Qualifying"
        rows={filter(qualifying.data)}
        columns={[
          ["POS", (row, index) => row.position ?? index + 1],
          ["DRIVER", driver],
          ["TEAM", team],
          ["Q1", (row) => row.q1 ?? "-"],
          ["Q2", (row) => row.q2 ?? "-"],
          ["Q3", (row) => row.q3 ?? "-"],
        ]}
        empty="No qualifying records imported for this race."
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
      />
    </section>
  );
}
