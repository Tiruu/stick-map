import { useCallback, useEffect, useState } from "react";

import type { Stick } from "../types";
import { getCurrentLocation } from "../utils/geolocation";
import { getActionErrorMessage } from "../utils/actionErrors";

import {
  getPendingSticks,
  voteOnStick,
  getReviewSticks,
  approveReviewedStick,
  rejectReviewedStick,
} from "../services/sticks";

import { supabase } from "../supabase";

type UserLike = {
  id: string;
} | null;

type UseModerationOptions = {
  user: UserLike;
  isAdmin: boolean;
  onError: (message: string) => void;
};

export function useModeration({
  user,
  isAdmin,
  onError,
}: UseModerationOptions) {
  const [pendingSticks, setPendingSticks] = useState<Stick[]>([]);

  const [reviewSticks, setReviewSticks] = useState<Stick[]>([]);

  const [validationIndex, setValidationIndex] = useState(0);

  const [adminModerationIndex, setAdminModerationIndex] = useState(0);

  const loadPendingSticks = useCallback(async (userId: string) => {
    try {
      const data = await getPendingSticks();

      const { data: votes, error } = await supabase
        .from("stick_validation_votes")
        .select("stick_id")
        .eq("user_id", userId);

      if (error) {
        throw error;
      }

      const votedStickIds = new Set(votes.map((vote) => vote.stick_id));

      const availableSticks = data.filter(
        (stick) => stick.user_id !== userId && !votedStickIds.has(stick.id),
      );

      setPendingSticks(availableSticks);
    } catch (error) {
      console.error("Erreur sticks à valider :", error);
    }
  }, []);

  const loadReviewSticks = useCallback(async () => {
    if (!isAdmin) {
      setReviewSticks([]);
      return;
    }

    try {
      const data = await getReviewSticks();

      setReviewSticks(data);
    } catch (error) {
      console.error("Erreur chargement modération :", error);
    }
  }, [isAdmin]);

  const handleValidationVote = useCallback(
    async (stick: Stick, vote: "approve" | "reject") => {
      if (!user) return;

      try {
        const location = await getCurrentLocation();

        await voteOnStick(
          stick.id,
          vote,
          location.latitude,
          location.longitude,
        );

        await loadPendingSticks(user.id);

        setValidationIndex(0);
      } catch (error) {
        console.error("Erreur validation :", error);

        onError(getActionErrorMessage(error));
      }
    },
    [user, loadPendingSticks, onError],
  );

  const handleAdminApproveStick = useCallback(
    async (stick: Stick) => {
      try {
        await approveReviewedStick(stick.id);

        await loadReviewSticks();

        setAdminModerationIndex(0);
      } catch (error) {
        console.error("Erreur validation admin :", error);
      }
    },
    [loadReviewSticks],
  );

  const handleAdminRejectStick = useCallback(
    async (stick: Stick) => {
      try {
        await rejectReviewedStick(stick.id);

        await loadReviewSticks();

        setAdminModerationIndex(0);
      } catch (error) {
        console.error("Erreur refus admin :", error);
      }
    },
    [loadReviewSticks],
  );

  useEffect(() => {
    if (user) {
      loadPendingSticks(user.id);
    } else {
      setPendingSticks([]);
    }
  }, [user, loadPendingSticks]);

  useEffect(() => {
    loadReviewSticks();
  }, [loadReviewSticks]);

  return {
    pendingSticks,
    reviewSticks,

    validationIndex,
    setValidationIndex,

    adminModerationIndex,
    setAdminModerationIndex,

    loadPendingSticks,
    loadReviewSticks,

    handleValidationVote,
    handleAdminApproveStick,
    handleAdminRejectStick,
  };
}
