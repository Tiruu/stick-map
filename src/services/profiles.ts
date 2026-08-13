import { supabase } from "../supabase";
import type { Profile } from "../types";

export async function getProfile(
  userId: string
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, role")
    .eq("id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateUsername(
  username: string
): Promise<void> {
  const { error } = await supabase.rpc(
    "update_my_username",
    {
      new_username: username,
    }
  );

  if (error) throw error;
}