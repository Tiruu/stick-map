import { supabase } from "../supabase";
import type { Profile } from "../types";

export async function getProfile(
  userId: string
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}