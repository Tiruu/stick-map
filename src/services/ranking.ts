import { supabase } from "../supabase";
import type { RankingEntry } from "../types";

export async function getRanking(): Promise<RankingEntry[]> {
  const { data, error } = await supabase.rpc("get_contributor_ranking");

  if (error) {
    throw error;
  }

  return data ?? [];
}
