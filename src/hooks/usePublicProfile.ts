import { useCallback, useState } from "react";

import type {
  Friendship,
  Profile,
} from "../types";

import {
  getProfile,
} from "../services/profiles";

import {
  getFriendshipBetween,
  sendFriendRequest,
} from "../services/friends";

type UserLike = {
  id: string;
} | null;

export function usePublicProfile(
  user: UserLike
) {
  const [publicProfile, setPublicProfile] =
    useState<Profile | null>(null);

  const [
    publicProfileFriendship,
    setPublicProfileFriendship,
  ] = useState<Friendship | null>(null);

  const openPublicProfile =
    useCallback(
      async (profileId: string) => {
        if (!user) {
          return;
        }

        try {
          const profile =
            await getProfile(profileId);

          const friendship =
            await getFriendshipBetween(
              user.id,
              profileId
            );

          setPublicProfile(profile);
          setPublicProfileFriendship(
            friendship
          );
        } catch (error) {
          console.error(
            "Erreur chargement profil public :",
            error
          );
        }
      },
      [user]
    );

  const handleSendFriendRequest =
    useCallback(async () => {
      if (!user || !publicProfile) {
        return;
      }

      try {
        const friendship =
          await sendFriendRequest(
            user.id,
            publicProfile.id
          );

        setPublicProfileFriendship(
          friendship
        );
      } catch (error) {
        console.error(
          "Erreur demande d'ami :",
          error
        );
      }
    }, [user, publicProfile]);

  const closePublicProfile =
    useCallback(() => {
      setPublicProfile(null);
      setPublicProfileFriendship(null);
    }, []);

  return {
    publicProfile,
    publicProfileFriendship,

    openPublicProfile,
    handleSendFriendRequest,
    closePublicProfile,
  };
}