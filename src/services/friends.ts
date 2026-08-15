import { supabase } from "../supabase";
import type { Friendship } from "../types";

export async function getMyFriendships(userId: string): Promise<Friendship[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  if (error) {
    throw error;
  }

  return data;
}

export async function getFriendshipBetween(
  userId: string,
  otherUserId: string,
): Promise<Friendship | null> {
  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${userId})`,
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function findUserByEmail(email: string) {
  const { data, error } = await supabase.rpc("find_user_by_email", {
    search_email: email,
  });

  if (error) {
    throw error;
  }

  return data?.[0] ?? null;
}

export async function sendFriendRequest(
  requesterId: string,
  addresseeId: string,
): Promise<Friendship> {
  const { data, error } = await supabase
    .from("friendships")
    .insert({
      requester_id: requesterId,
      addressee_id: addresseeId,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateFriendshipStatus(
  friendshipId: string,
  status: "accepted" | "rejected",
): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", friendshipId);

  if (error) {
    throw error;
  }
}
