export type Driver = {
  id: string;
  position?: number;
  name?: string;
  given_name?: string;
  family_name?: string;
  team?: string;
  points?: number;
  wins?: number;
  color?: string;
  nationality?: string;
};
export type Race = {
  id: string;
  season_id?: string;
  circuit_id?: string;
  round: string | number;
  date?: string;
  name: string;
  circuit?: string;
  country?: string;
  status?: "complete" | "next";
};
export type Team = {
  id?: string;
  position?: number;
  name: string;
  points?: number;
  wins?: number;
  color_hex?: string;
  logo_url?: string;
  color?: string;
};
