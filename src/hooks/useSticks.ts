import { useCallback, useEffect, useState } from "react";

import type {
  Stick,
  StickConfirmation,
  StickReport,
  StickStatus,
  StickOrigin,
} from "../types";

import {
  getSticks,
  createStick,
  getConfirmations,
  confirmStickPresence,
  getReports,
  reportStickMissing,
  getStickStatuses,
  deleteStick,
} from "../services/sticks";

import { uploadStickPhoto } from "../services/storage";
import { getCurrentLocation } from "../utils/geolocation";

type UserLike = {
  id: string;
} | null;

type SaveStickParams = {
  latitude: number;
  longitude: number;
  description: string;
  photo: File;
  originType: StickOrigin;
};

type UseSticksOptions = {
  user: UserLike;
  isAdmin: boolean;
};

export function useSticks({ user, isAdmin }: UseSticksOptions) {
  const [sticks, setSticks] = useState<Stick[]>([]);

  const [stickStatuses, setStickStatuses] = useState<
    Record<string, StickStatus>
  >({});

  const [confirmations, setConfirmations] = useState<StickConfirmation[]>([]);

  const [reports, setReports] = useState<StickReport[]>([]);

  const loadSticks = useCallback(async () => {
    try {
      const data = await getSticks(user?.id ?? null, isAdmin);

      setSticks(data);
    } catch (error) {
      console.error("Erreur chargement sticks :", error);
    }
  }, [user, isAdmin]);

  const loadStickStatuses = useCallback(async () => {
    try {
      const data = await getStickStatuses();

      setStickStatuses(data);
    } catch (error) {
      console.error("Erreur chargement statuts :", error);
    }
  }, []);

  const loadConfirmations = useCallback(async (stickId: string) => {
    try {
      const data = await getConfirmations(stickId);

      setConfirmations(data);
    } catch (error) {
      console.error("Erreur chargement confirmations :", error);
    }
  }, []);

  const loadReports = useCallback(async (stickId: string) => {
    try {
      const data = await getReports(stickId);

      setReports(data);
    } catch (error) {
      console.error("Erreur chargement signalements :", error);
    }
  }, []);

  const saveStick = useCallback(
    async ({ latitude, longitude, description, photo, originType, }: SaveStickParams) => {
      if (!user) {
        return null;
      }

      try {
        const photoPath = await uploadStickPhoto(photo);

        const newStick = await createStick({
          latitude,
          longitude,
          description,
          photoPath,
          userId: user.id,
          originType,
        });

        setSticks((current) => [...current, newStick]);

        return newStick;
      } catch (error) {
        console.error("Erreur sauvegarde stick :", error);

        return null;
      }
    },
    [user],
  );

  const confirmStick = useCallback(
    async (stickId: string) => {
      if (!user) {
        return;
      }

      try {
        const location = await getCurrentLocation();

        console.log("Position utilisée :", {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
        });

        console.log("Stick :", stickId);

        await confirmStickPresence(
          stickId,
          location.latitude,
          location.longitude,
        );

        await loadConfirmations(stickId);
        await loadStickStatuses();
      } catch (error) {
        console.error("Erreur confirmation :", error);
      }
    },
    [user, loadConfirmations, loadStickStatuses],
  );

  const reportMissingStick = useCallback(
    async (stickId: string) => {
      if (!user) {
        return;
      }

      try {
        const location = await getCurrentLocation();

        await reportStickMissing(stickId, location.latitude, location.longitude);

        await loadReports(stickId);
        await loadStickStatuses();
      } catch (error) {
        console.error("Erreur signalement :", error);
      }
    },
    [user, loadReports, loadStickStatuses],
  );

  const deleteStickById = useCallback(
    async (stickId: string, photoPath: string | null) => {
      if (!isAdmin) {
        return false;
      }

      try {
        await deleteStick(stickId, photoPath);

        setSticks((current) => current.filter((stick) => stick.id !== stickId));

        await loadStickStatuses();

        return true;
      } catch (error) {
        console.error("Erreur suppression stick :", error);

        return false;
      }
    },
    [isAdmin, loadStickStatuses],
  );

  useEffect(() => {
    loadSticks();
    loadStickStatuses();
  }, [loadSticks, loadStickStatuses]);
  
  return {
    sticks,
    setSticks,

    stickStatuses,

    confirmations,
    reports,

    loadSticks,
    loadStickStatuses,
    loadConfirmations,
    loadReports,

    saveStick,
    confirmStick,
    reportMissingStick,
    deleteStickById,
  };
}
