import type { RankingEntry } from "../types";

type RankingProps = {
  ranking: RankingEntry[];
  mode?: "all" | "friends";
  onModeChange?: (mode: "all" | "friends") => void;
  onSelectUser: (userId: string) => void;
};



export default function Ranking({
  ranking,
  mode = "all",
  onModeChange,
  onSelectUser,
}: RankingProps) {
  return (
    <div className="ranking-content">
      <h2>🏆 Contributeurs</h2>

      <div className="ranking-tabs">
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
      </div>

      {ranking.map((entry, index) => (
        <div
          key={entry.user_id}
          className={`ranking-entry ranking-entry-${index + 1}`}
        >
          <button
            className="ranking-user"
            onClick={() => onSelectUser(entry.user_id)}
          >
            {index + 1}. {entry.username}
          </button>

          <strong>
            {entry.stick_count} stick
            {entry.stick_count > 1 ? "s" : ""}
          </strong>
        </div>
      ))}
    </div>
  );
}
