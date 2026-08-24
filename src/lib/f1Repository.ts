import type { Driver, Race, Team } from '../data/f1Data'
import { supabase } from './supabaseClient'

async function readTable<T>(table: string): Promise<T[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from(table).select('*')
  if (error) throw error
  return (data ?? []) as T[]
}

export const getDrivers = () => readTable<Driver>('drivers')
export const getRaces = () => readTable<Race>('races')
export const getTeams = () => readTable<Team>('teams')
export const getCircuits = () => readTable<{ id: string; name: string; location?: string; country?: string }>('circuits')
export const getSeasons = () => readTable<{ id: string; year: number }>('seasons')
export const getResults = () => readTable<{ id: string; race_id: string; driver_id: string; team_id?: string; position?: number; points?: number; laps?: number; status_id?: string; fastest_lap_rank?: number; fastest_lap_time?: string }>('results')
export const getQualifyingResults = () => readTable<{ id: string; race_id: string; driver_id: string; team_id?: string; position?: number; q1?: string; q2?: string; q3?: string }>('qualifying_results')
export const getSprintResults = () => readTable<{ id: string; race_id: string; driver_id: string; team_id?: string; grid?: number; position?: number; points?: number; laps?: number }>('sprint_results')
export const getPitstops = () => readTable<{ id: string; race_id: string; driver_id: string; stop_number?: number; lap?: number; time?: string; duration_ms?: number }>('pitstops')
export const getLaps = () => readTable<{ id: string; race_id: string; driver_id: string; lap_number?: number; position?: number; time_ms?: number }>('laps')
