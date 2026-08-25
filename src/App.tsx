import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  getCircuits,
  getDrivers,
  getRaces,
  getResults,
  getSeasons,
  getTeams,
} from "./lib/f1Repository";
import { importEntity, writeImportLog } from "./lib/f1Importer";
import { supabase } from "./lib/supabaseClient";
import type { Driver } from "./data/f1Data";
import RaceDetail from "./features/RaceDetail";
import EntityDetail from "./features/EntityDetail";
import AdminPage from './features/AdminPage';
import "./App.css";

const navItems = [
  ["Overview", "/"],
  ["Races", "/races"],
  ["Drivers", "/drivers"],
  ["Teams", "/teams"],
  ["Circuits", "/circuits"],
  ["Seasons", "/seasons"],
];
const displayDriver = (row: Driver) =>
  row.family_name ?? row.name?.trim().split(/\s+/).pop() ?? row.given_name ?? "Unnamed driver";
function Header() {
  const location = useLocation();
  return (
    <header className="topbar">
      <Link className="brand" to="/">
        <span className="brand-mark">F1</span>
        <span>THE F1 ZONE</span>
      </Link>
      <nav className="main-nav">
        {navItems.map(([label, path]) => (
          <Link
            key={path}
            className={
              location.pathname === path ? "nav-link active" : "nav-link"
            }
            to={path}
          >
            {label}
          </Link>
        ))}
      </nav>
      <Link className="admin-link" to="/admin">
        Admin <span>↗</span>
      </Link>
    </header>
  );
}
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-shell">
      <Header />
      {children}
      <div className="kinetic-marquee global-marquee" aria-label="Formula One data stream">
        <div className="marquee-track">
          <span>THE F1 ZONE</span><b>*</b><span>FORMULA ONE ARCHIVE</span><b>*</b><span>DATA IN MOTION</span><b>*</b><span>THE F1 ZONE</span><b>*</b><span>FORMULA ONE ARCHIVE</span><b>*</b>
        </div>
      </div>
      <footer>
        <span>THE F1 ZONE / EST. 2025</span>
        <span>DATA SOURCE: JOLPICA F1 API</span>
        <span>BUILT FOR THE OBSESSED</span>
      </footer>
    </main>
  );
}
function EmptyState({ entity }: { entity: string }) {
  return (
    <div className="empty-state">
      <strong>No imported {entity} yet.</strong>
      <span>Run an admin import to display stored records.</span>
      <Link className="outline-button" to="/admin">
        Open admin <span>→</span>
      </Link>
    </div>
  );
}
function Dashboard() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"drivers" | "teams">("drivers");
  const drivers = useQuery({
    queryKey: ["drivers"],
    queryFn: getDrivers,
    retry: false,
  });
  const races = useQuery({
    queryKey: ["races"],
    queryFn: getRaces,
    retry: false,
  });
  const teams = useQuery({
    queryKey: ["teams"],
    queryFn: getTeams,
    retry: false,
  });
  const filtered = useMemo(
    () =>
      (drivers.data ?? []).filter((row) =>
        `${displayDriver(row)} ${row.team ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [drivers.data, query],
  );
  if (drivers.isLoading || races.isLoading)
    return (
      <section className="empty-state">
        <strong>Loading imported data...</strong>
      </section>
    );
  if (!drivers.data?.length && !races.data?.length && !teams.data?.length)
    return (
      <section className="archive-page">
        <p className="eyebrow">FIA FORMULA ONE WORLD CHAMPIONSHIP</p>
        <h1>
          The F1 archive,
          <br />
          <em>in motion.</em>
        </h1>
        <EmptyState entity="records" />
      </section>
    );
  return (
    <>
      <section className="intro-row">
        <div>
          <p className="eyebrow">FIA FORMULA ONE WORLD CHAMPIONSHIP</p>
          <h1>
            The F1 archive,
            <br />
            <em>in motion.</em>
          </h1>
          <p className="intro-copy">
            Explore every imported race, driver, team and circuit.
          </p>
        </div>
      </section>
      <div className="kinetic-marquee stats-marquee" aria-label="Imported Formula One statistics">
        <div className="marquee-track">
          <span>{drivers.data?.length ?? 0} DRIVERS</span><b>*</b><span>{teams.data?.length ?? 0} TEAMS</span><b>*</b><span>{races.data?.length ?? 0} RACES</span><b>*</b><span>{drivers.data?.length ?? 0} DRIVERS</span><b>*</b><span>{teams.data?.length ?? 0} TEAMS</span><b>*</b><span>{races.data?.length ?? 0} RACES</span><b>*</b>
        </div>
      </div>
      <section className="hero-grid">
        <article className="next-race-panel">
          <div className="panel-top">
            <span className="live-dot">● IMPORTED DATA</span>
          </div>
          <p className="race-kicker">LATEST RACE</p>
          <h2>{races.data?.[0]?.name ?? "No race imported"}</h2>
          <div className="race-meta">
            <span>{races.data?.[0]?.date ?? "DATE PENDING"}</span>
            <span>{races.data?.[0]?.circuit ?? "CIRCUIT PENDING"}</span>
          </div>
        </article>
        <article className="stat-panel">
          <div className="panel-top">
            <span className="panel-label">IMPORTED RECORDS</span>
          </div>
          <div className="mini-stats">
            <div>
              <span>DRIVERS</span>
              <strong>{drivers.data?.length ?? 0}</strong>
            </div>
            <div>
              <span>TEAMS</span>
              <strong>{teams.data?.length ?? 0}</strong>
            </div>
            <div>
              <span>RACES</span>
              <strong>{races.data?.length ?? 0}</strong>
            </div>
          </div>
        </article>
      </section>
      <section className="content-grid">
        <article className="standings-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">SUPABASE RECORDS</p>
              <h2>Imported standings</h2>
            </div>
            <div className="segmented">
              <button
                className={mode === "drivers" ? "selected" : ""}
                onClick={() => setMode("drivers")}
              >
                Drivers
              </button>
              <button
                className={mode === "teams" ? "selected" : ""}
                onClick={() => setMode("teams")}
              >
                Teams
              </button>
            </div>
          </div>
          {mode === "drivers" ? (
            <>
              <div className="table-tools">
                <label className="search-box">
                  <span>⌕</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search imported drivers"
                  />
                </label>
              </div>
              <div className="standings-table">
                {filtered.map((row, index) => (
                  <Link
                    className="table-row"
                    key={row.id}
                    to={`/drivers/${row.id}`}
                  >
                    <span className="position">
                      {String(row.position ?? index + 1).padStart(2, "0")}
                    </span>
                    <span className="driver-cell">
                      <i style={{ backgroundColor: row.color ?? "#ff4e24" }} />
                      {displayDriver(row)}
                    </span>
                    <span className="team-cell">{row.team ?? "Unknown"}</span>
                    <strong>{row.points ?? 0}</strong>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="constructor-list">
              {(teams.data ?? []).map((row, index) => (
                <div className="constructor-row" key={row.id ?? row.name}>
                  <b>{String(row.position ?? index + 1).padStart(2, "0")}</b>
                  <span
                    className="team-swatch"
                    style={{
                      backgroundColor: row.color ?? row.color_hex ?? "#ff4e24",
                    }}
                  />
                  <strong>{row.name}</strong>
                  <span>{row.points ?? 0} PTS</span>
                </div>
              ))}
            </div>
          )}
        </article>
        <aside className="calendar-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">IMPORTED RACES</p>
              <h2>Race calendar</h2>
            </div>
            <Link className="text-button" to="/races">
              View all →
            </Link>
          </div>
          <div className="calendar-list">
            {(races.data ?? []).map((race) => (
              <Link
                key={race.id}
                className="calendar-item"
                to={`/races/${race.id}`}
              >
                <span className="round">{race.round}</span>
                <span className="date">{race.date ?? "TBD"}</span>
                <span className="calendar-name">
                  {race.name}
                  <small>{race.circuit ?? "Circuit pending"}</small>
                </span>
                <span className="status">→</span>
              </Link>
            ))}
          </div>
        </aside>
      </section>
    </>
  );
}
function ArchiveList({
  kind,
}: {
  kind: "races" | "drivers" | "teams" | "circuits" | "seasons";
}) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const hooks = {
    races: useQuery({ queryKey: ["races"], queryFn: getRaces }),
    drivers: useQuery({ queryKey: ["drivers"], queryFn: getDrivers }),
    teams: useQuery({ queryKey: ["teams"], queryFn: getTeams }),
    circuits: useQuery({ queryKey: ["circuits"], queryFn: getCircuits }),
    seasons: useQuery({ queryKey: ["seasons"], queryFn: getSeasons }),
  };
  const rows = hooks[kind].data ?? [];
  const visible = rows.filter((row) =>
    JSON.stringify(row).toLowerCase().includes(query.toLowerCase()),
  ) as Array<{
    id: string;
    name?: string;
    year?: number;
    date?: string;
    country?: string;
    season_id?: string | number;
    given_name?: string;
    family_name?: string;
    nationality?: string;
    location?: string;
  }>;
  const titleOf = (row: (typeof visible)[number]) =>
    kind === "drivers"
      ? `${row.given_name ?? ""} ${row.family_name ?? ""}`.trim() ||
        row.name ||
        "Unnamed driver"
      : (row.name ?? (row.year ? String(row.year) : "Unnamed record"));
  const detailOf = (row: (typeof visible)[number]) =>
    kind === "drivers"
      ? (row.nationality ?? "")
      : kind === "circuits"
        ? `${row.location ?? ""} ${row.country ?? ""}`.trim()
        : (row.date ?? row.country ?? "");
  const raceGroups = kind === "races"
    ? visible.reduce<Map<string, typeof visible>>((groups, row) => {
        const year = String(
          row.year ?? row.season_id ?? row.date?.slice(0, 4) ?? "Unknown year",
        );
        const group = groups.get(year) ?? [];
        group.push(row);
        groups.set(year, group);
        return groups;
      }, new Map())
    : undefined;
  const renderRow = (row: (typeof visible)[number], index: number) => (
    <button
      className="archive-row"
      key={row.id}
      onClick={() => navigate(`/${kind}/${row.id}`)}
    >
      <span>{String(index + 1).padStart(2, "0")}</span>
      <strong>{titleOf(row)}</strong>
      <small>{detailOf(row)}</small>
      <b>â†’</b>
    </button>
  );
  return (
    <section className={`archive-page ${kind}-archive-page`}>
      <p className="eyebrow">THE DATABASE / {kind.toUpperCase()}</p>
      <div className="archive-heading">
        <div>
          <h1>{kind} archive</h1>
          <p className="intro-copy">
            Only records imported into Supabase appear here.
          </p>
        </div>
        <label className="search-box archive-search">
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search imported ${kind}`}
          />
        </label>
      </div>
      {!hooks[kind].isLoading && !rows.length ? (
        <EmptyState entity={kind} />
      ) : (
        <div className="archive-list">
          {raceGroups ? Array.from(raceGroups.entries()).map(([year, group]) => (
            <section className="race-year-group" key={year}>
              <h2>{year}</h2>
              {group.map(renderRow)}
            </section>
          )) : visible.map((row, index) => (
            <button
              className="archive-row"
              key={row.id}
              onClick={() => navigate(`/${kind}/${row.id}`)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{titleOf(row)}</strong>
              <small>{detailOf(row)}</small>
              <b>→</b>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
function Admin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [season, setSeason] = useState("2025");
  const [round, setRound] = useState("");
  const [entity, setEntity] =
    useState<Parameters<typeof importEntity>[0]>("races");
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function signIn() {
    if (!supabase) {
      setMessage("Set VITE_USE_SUPABASE=true first.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setMessage(error.message);
    else {
      setSignedIn(true);
      setMessage("Signed in.");
    }
  }
  async function runImport() {
    setBusy(true);
    setMessage(`Importing ${entity}...`);
    const empty = {
      processed: 0,
      created: 0,
      updated: 0,
      errors: [] as string[],
    };
    try {
      const result = await importEntity(entity, season, round);
      await writeImportLog(entity, season, result);
      setMessage(`Stored ${result.processed} ${entity}.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Import failed";
      await writeImportLog(entity, season, empty, detail);
      setMessage(detail);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="detail-page admin-page">
      <p className="eyebrow">PRIVATE WORKSPACE / ADMIN</p>
      <h1>Import control</h1>
      <p className="detail-subtitle">
        Import Jolpica records into Supabase to make them visible.
      </p>
      {!signedIn ? (
        <div className="admin-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="outline-button" onClick={() => void signIn()}>
            Sign in <span>→</span>
          </button>
        </div>
      ) : (
        <div className="import-console">
          <div className="import-controls">
            <label>
              ENTITY
              <select
                value={entity}
                onChange={(event) =>
                  setEntity(event.target.value as typeof entity)
                }
              >
                <optgroup label="ERGAST COMPATIBLE">
                  <option value="seasons">Seasons</option>
                  <option value="circuits">Circuits</option>
                  <option value="teams">Constructors / Teams</option>
                  <option value="drivers">Drivers</option>
                  <option value="races">Races</option>
                  <option value="results">Race Results</option>
                  <option value="qualifying_results">Qualifying</option>
                  <option value="sprint_results">Sprint</option>
                  <option value="pitstops">Pit Stops</option>
                  <option value="laps">Laps</option>
                  <option value="driver_standings">Driver Standings</option>
                  <option value="constructor_standings">
                    Constructor Standings
                  </option>
                  <option value="status">Status</option>
                </optgroup>
                <optgroup label="ALPHA / ALPHA CORE">
                  <option value="sessions">Sessions</option>
                  <option value="session_entries">Session Entries</option>
                  <option value="rounds">Rounds</option>
                  <option value="alpha_teams">Teams</option>
                  <option value="alpha_drivers">Drivers</option>
                  <option value="alpha_circuits">Circuits</option>
                  <option value="alpha_laps">Laps</option>
                  <option value="alpha_pitstops">Pit Stops</option>
                  <option value="schedules">Schedules</option>
                </optgroup>
              </select>
            </label>
            <label>
              SEASON
              <input
                value={season}
                onChange={(event) => setSeason(event.target.value)}
              />
            </label>
            <label>
              ROUND
              <input
                value={round}
                onChange={(event) => setRound(event.target.value)}
                placeholder="all"
              />
            </label>
            <button
              className="outline-button"
              disabled={busy}
              onClick={() => void runImport()}
            >
              {busy ? "Importing..." : "Import & store"} <span>→</span>
            </button>
          </div>
          <div className="admin-notice">
            Every import is upserted by external reference and recorded in
            import_logs.
          </div>
        </div>
      )}
      {message && <p className="admin-message">{message}</p>}
    </section>
  );
}
function Detail({ type }: { type: string }) {
  const location = useLocation();
  const id = decodeURIComponent(location.pathname.split("/").pop() ?? "");
  const isRace = type === "record" && location.pathname.startsWith("/races/");
  const results = useQuery({
    queryKey: ["results", id],
    queryFn: getResults,
    enabled: isRace,
    retry: false,
  });
  const raceRows = useQuery({
    queryKey: ["races"],
    queryFn: getRaces,
    enabled: isRace,
    retry: false,
  });
  const driverRows = useQuery({
    queryKey: ["drivers"],
    queryFn: getDrivers,
    enabled: isRace,
    retry: false,
  });
  const teamRows = useQuery({
    queryKey: ["teams"],
    queryFn: getTeams,
    enabled: isRace,
    retry: false,
  });
  const raceResults = (results.data ?? []).filter((row) => row.race_id === id);
  const race = (raceRows.data ?? []).find((row) => row.id === id);
  const driverNames = new Map(
    (driverRows.data ?? []).map((row) => [row.id, displayDriver(row)]),
  );
  const teamNames = new Map(
    (teamRows.data ?? []).map((row) => [row.id, row.name]),
  );
  const title = race?.name ?? id.replaceAll("-", " ");
  const loading =
    results.isLoading ||
    raceRows.isLoading ||
    driverRows.isLoading ||
    teamRows.isLoading;
  return (
    <section className="detail-page">
      <Link className="back-link" to={isRace ? "/races" : `/${type}s`}>
        ← Back to archive
      </Link>
      <p className="eyebrow">IMPORTED DATABASE RECORD</p>
      <h1>{title}</h1>
      <p className="detail-subtitle">
        {race
          ? `${race.date ?? "Date pending"} / ${race.circuit ?? "Circuit pending"}`
          : `Record loaded from Supabase: ${id}`}
      </p>
      {isRace && (
        <div className="race-results">
          <div className="section-heading">
            <div>
              <p className="eyebrow">RACE RESULTS</p>
              <h2>
                {loading
                  ? "Loading results..."
                  : `${raceResults.length} classified drivers`}
              </h2>
            </div>
          </div>
          {!loading && !raceResults.length ? (
            <EmptyState entity="race results" />
          ) : (
            <div className="standings-table">
              <div className="table-head">
                <span>POS</span>
                <span>DRIVER</span>
                <span>TEAM</span>
                <span>PTS</span>
              </div>
              {raceResults.map((row, index) => (
                <div className="table-row" key={row.id}>
                  <span className="position">
                    {String(row.position ?? index + 1).padStart(2, "0")}
                  </span>
                  <span className="driver-cell">
                    {driverNames.get(row.driver_id) ?? "Unknown driver"}
                  </span>
                  <span className="team-cell">
                    {row.team_id
                      ? (teamNames.get(row.team_id) ?? "Unknown team")
                      : "Unknown team"}
                  </span>
                  <strong>{row.points ?? 0}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin-legacy" element={<Admin />} />
          {(["races", "drivers", "teams", "circuits", "seasons"] as const).map(
            (kind) => (
              <Route
                key={kind}
                path={`/${kind}`}
                element={<ArchiveList kind={kind} />}
              />
            ),
          )}
          <Route path="/races/:id" element={<RaceDetail />} />
          <Route path="/drivers/:id" element={<EntityDetail kind="driver" />} />
          <Route path="/teams/:id" element={<EntityDetail kind="team" />} />
          <Route path="/:type/:id" element={<Detail type="record" />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
export default App;
