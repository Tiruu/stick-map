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
    .from("stick_confirmations")
    .select("*")
    .eq("stick_id", stickId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
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
    .from("stick_reports")
    .select("*")
    .eq("stick_id", stickId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
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
  const REPORT_THRESHOLD = 4;

  const [confirmationsResult, reportsResult] = await Promise.all([
    supabase
      .from("stick_confirmations")
      .select("*")
      .order("updated_at", { ascending: false }),

    supabase
      .from("stick_reports")
      .select("*")
      .order("updated_at", { ascending: false }),
  ]);

  if (confirmationsResult.error) {
    throw confirmationsResult.error;
  }

  if (reportsResult.error) {
    throw reportsResult.error;
  }

  const confirmations = confirmationsResult.data as StickConfirmation[];

  const reports = reportsResult.data as StickReport[];

  const statuses: Record<string, StickStatus> = {};

  const stickIds = new Set([
    ...confirmations.map((confirmation) => confirmation.stick_id),

    ...reports.map((report) => report.stick_id),
  ]);

  for (const stickId of stickIds) {
    const stickConfirmations = confirmations.filter(
      (confirmation) => confirmation.stick_id === stickId,
    );

    const stickReports = reports.filter(
      (report) => report.stick_id === stickId,
    );

    const latestConfirmation = stickConfirmations[0];

    const latestReport = stickReports[0];

    // Aucun signalement suffisant
    if (stickReports.length < REPORT_THRESHOLD) {
      statuses[stickId] = latestConfirmation ? "present" : "unknown";

      continue;
    }

    // 4 signalements ou plus, aucune confirmation
    if (!latestConfirmation) {
      statuses[stickId] = "missing";
      continue;
    }

    // 4 signalements ou plus + confirmation :
    // on regarde ce qui est le plus récent
    const confirmationDate = new Date(latestConfirmation.updated_at).getTime();

    const reportDate = new Date(latestReport.updated_at).getTime();

    statuses[stickId] = confirmationDate > reportDate ? "present" : "missing";
  }

  return statuses;
}

export async function deleteStick(
  stickId: string,
  photoPath: string | null,
): Promise<void> {
  if (photoPath) {
    console.log("Suppression photo :", {
      bucket: "stick-photos",
      path: photoPath,
    });
    const { error: storageError } = await supabase.storage
      .from("stick-photos")
      .remove([photoPath]);

    console.log("Résultat suppression photo :", {
      path: photoPath,
      error: storageError,
    });

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
