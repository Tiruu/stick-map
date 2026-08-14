import { supabase } from "../supabase";
import type { Friendship, Profile } from "../types";

export async function getMyFriendships(
  userId: string
): Promise<Friendship[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .or(
      `requester_id.eq.${userId},addressee_id.eq.${userId}`
    );

  if (error) {
    throw error;
  }

  return data;
}

export async function sendFriendRequest(
  requesterId: string,
  addresseeId: string
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
  status: "accepted" | "rejected"
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
export async function getFriendProfiles(
  userId: string
): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select(`
      requester_id,
      addressee_id,
      profiles!friendships_requester_id_fkey (
        id,
        username,
        role
      ),
      profiles!friendships_addressee_id_fkey (
        id,
        username,
        role
      )
    `)
    .or(
      `requester_id.eq.${userId},addressee_id.eq.${userId}`
    )
    .eq("status", "accepted");

  if (error) {
    throw error;
  }

  const profiles: Profile[] = [];

  for (const friendship of data) {
    const profile =
      friendship.requester_id === userId
        ? friendship.profiles?.[1]
        : friendship.profiles?.[0];

    if (profile) {
      profiles.push(profile);
    }
  }

  return profiles;
}