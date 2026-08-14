import type { RankingEntry } from "../types";

type RankingProps = {
  ranking: RankingEntry[];
  mode?: "all" | "friends";
  onModeChange?: (mode: "all" | "friends") => void;
};

export default function Ranking({
  ranking,
  mode,
  onModeChange,
}: RankingProps) {
  return (
    <div className="ranking-content">
      <button
        className={mode === "all" ? "active" : ""}
        onClick={() => onModeChange?.("all")}
      >
        Tout le monde
      </button>

      <button
        className={mode === "friends" ? "active" : ""}
        onClick={() => onModeChange?.("friends")}
      >
        Amis
      </button>
      <h2>🏆 Contributeurs</h2>

      {ranking.map((entry, index) => (
        <div
          key={entry.user_id}
          className={`ranking-entry ranking-entry-${index + 1}`}
        >
          <span>
            {index + 1}. {entry.username}
          </span>

          <strong>
            {entry.stick_count} stick
            {entry.stick_count > 1 ? "s" : ""}
          </strong>
        </div>
      ))}
    </div>
  );
}