import { useCallback, useEffect, useState } from "react";

import type { RankingEntry } from "../types";
import { getRanking } from "../services/ranking";

export function useRanking() {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);

  const loadRanking = useCallback(async () => {
    try {
      const data = await getRanking();
      setRanking(data);
    } catch (error) {
      console.error("Erreur classement :", error);
    }
  }, []);

  useEffect(() => {
    loadRanking();
  }, [loadRanking]);

  return {
    ranking,
    loadRanking,
  };
}
