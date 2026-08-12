import type { RankingEntry } from "../types";

type RankingProps = {
  ranking: RankingEntry[];
};

export default function Ranking({
  ranking,
}: RankingProps) {
  return (
    <div className="ranking-content">
      <h2>🏆 Contributeurs</h2>

      {ranking.map((entry, index) => (
        <div
          key={entry.user_id}
          className="ranking-entry"
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