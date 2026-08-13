import type { Stick } from "../types";

type AdminModerationPanelProps = {
  sticks: Stick[];
  currentIndex: number;

  getPhotoUrl: (path: string) => string;

  onClose: () => void;
  onApprove: (stick: Stick) => void;
  onReject: (stick: Stick) => void;
  onNext: () => void;
  onPrevious: () => void;
};

export default function AdminModerationPanel({
  sticks,
  currentIndex,
  getPhotoUrl,
  onClose,
  onApprove,
  onReject,
  onNext,
  onPrevious,
}: AdminModerationPanelProps) {
  const stick = sticks[currentIndex];

  if (!stick) {
    return (
      <div className="admin-moderation-overlay">
        <div className="admin-moderation-panel">
          <button
            className="close-admin-moderation"
            onClick={onClose}
          >
            ✕
          </button>

          <h2>🛡️ Modération</h2>
          <p>Aucun stick à modérer.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-moderation-overlay">
      <div className="admin-moderation-panel">
        <button
          className="close-admin-moderation"
          onClick={onClose}
        >
          ✕
        </button>

        <h2>🛡️ Stick à examiner</h2>

        <p className="admin-moderation-counter">
          {currentIndex + 1} / {sticks.length}
        </p>

        {stick.photo_path && (
          <img
            src={getPhotoUrl(stick.photo_path)}
            alt="Stick à modérer"
            className="admin-moderation-photo"
          />
        )}

        <p>
          {stick.description || "Aucune description"}
        </p>

        <p className="stick-coordinates">
          📍 {stick.latitude.toFixed(5)},{" "}
          {stick.longitude.toFixed(5)}
        </p>

        <div className="admin-moderation-actions">
          <button
            className="admin-reject"
            onClick={() => onReject(stick)}
          >
            ❌ Refuser
          </button>

          <button
            className="admin-approve"
            onClick={() => onApprove(stick)}
          >
            ✅ Valider définitivement
          </button>
        </div>

        {sticks.length > 1 && (
          <div className="admin-moderation-navigation">
            <button
              onClick={onPrevious}
              disabled={currentIndex === 0}
            >
              ← Précédent
            </button>

            <button
              onClick={onNext}
              disabled={currentIndex >= sticks.length - 1}
            >
              Suivant →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}