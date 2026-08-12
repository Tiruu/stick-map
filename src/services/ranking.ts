import { supabase } from "../supabase";
import type { RankingEntry } from "../types";

export async function getRanking(): Promise<RankingEntry[]> {
  const { data, error } = await supabase
    .from("contributor_ranking")
    .select("*")
    .order("stick_count", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}