import { supabase } from "../supabase";

import type {
  Stick,
  StickConfirmation,
  StickReport,
  StickStatus,
  StickOrigin,
} from "../types";

export async function getSticks(
  userId: string | null,
  isAdmin: boolean,
): Promise<Stick[]> {
  let query = supabase.from("sticks").select("*");

  if (!isAdmin) {
    if (userId) {
      query = query.or(`moderation_status.eq.approved,user_id.eq.${userId}`);
    } else {
      query = query.eq("moderation_status", "approved");
    }
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data;
}

export async function createStick({
  latitude,
  longitude,
  description,
  photoPath,
  originType,
  userLatitude,
  userLongitude,
}: {
  latitude: number;
  longitude: number;
  description: string;
  photoPath: string | null;
  originType: StickOrigin;
  userLatitude: number;
  userLongitude: number;
}): Promise<Stick> {
  const { data, error } = await supabase.rpc("create_stick_nearby", {
    p_latitude: latitude,
    p_longitude: longitude,
    p_description: description,
    p_photo_path: photoPath,
    p_origin_type: originType,
    p_user_latitude: userLatitude,
    p_user_longitude: userLongitude,
  });

  if (error) {
    throw error;
  }

  return data as Stick;
}

export async function getConfirmations(
  stickId: string,
): Promise<StickConfirmation[]> {
  const { data, error } = await supabase
    .from("stick_latest_confirmations")
    .select("*")
    .eq("stick_id", stickId);

  if (error) {
    throw error;
  }

  return data as StickConfirmation[];
}

export async function confirmStickPresence(
  stickId: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  const { error } = await supabase.rpc("confirm_stick_nearby", {
    p_stick_id: stickId,
    p_latitude: latitude,
    p_longitude: longitude,
  });

  if (error) {
    throw error;
  }
}

export async function getReports(stickId: string): Promise<StickReport[]> {
  const { data, error } = await supabase
    .from("stick_latest_reports")
    .select("*")
    .eq("stick_id", stickId);

  if (error) {
    throw error;
  }

  return data as StickReport[];
}

export async function reportStickMissing(
  stickId: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  const { error } = await supabase.rpc("report_stick_missing_nearby", {
    p_stick_id: stickId,
    p_latitude: latitude,
    p_longitude: longitude,
  });

  if (error) {
    throw error;
  }
}

export async function getStickStatuses(): Promise<Record<string, StickStatus>> {
  const { data, error } = await supabase
    .from("stick_statuses")
    .select("stick_id, status");

  if (error) {
    throw error;
  }

  const statuses: Record<string, StickStatus> = {};

  for (const row of data ?? []) {
    statuses[row.stick_id] = row.status as StickStatus;
  }

  return statuses;
}

export async function deleteStick(
  stickId: string,
  photoPath: string | null,
): Promise<void> {
  if (photoPath) {
    const { error: storageError } = await supabase.storage
      .from("stick-photos")
      .remove([photoPath]);

    if (storageError) {
      throw storageError;
    }
  }

  const { error } = await supabase.from("sticks").delete().eq("id", stickId);

  if (error) {
    throw error;
  }
}

export async function getUserSticks(userId: string): Promise<Stick[]> {
  const { data, error } = await supabase
    .from("sticks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function getPendingSticks(): Promise<Stick[]> {
  const { data, error } = await supabase
    .from("sticks")
    .select("*")
    .eq("moderation_status", "pending")
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return data;
}

export async function voteOnStick(
  stickId: string,
  vote: "approve" | "reject",
  latitude: number,
  longitude: number,
): Promise<void> {
  const { error } = await supabase.rpc("vote_on_stick_nearby", {
    p_stick_id: stickId,
    p_vote: vote,
    p_latitude: latitude,
    p_longitude: longitude,
  });

  if (error) {
    throw error;
  }
}

export async function getReviewSticks(): Promise<Stick[]> {
  const { data, error } = await supabase
    .from("sticks")
    .select("*")
    .eq("moderation_status", "review")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

export async function approveReviewedStick(stickId: string): Promise<void> {
  const { error } = await supabase
    .from("sticks")
    .update({
      moderation_status: "approved",
    })
    .eq("id", stickId);

  if (error) {
    throw error;
  }
}

export async function rejectReviewedStick(stickId: string): Promise<void> {
  const { error } = await supabase
    .from("sticks")
    .update({
      moderation_status: "rejected",
    })
    .eq("id", stickId);

  if (error) {
    throw error;
  }
}
