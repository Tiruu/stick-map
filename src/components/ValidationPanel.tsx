import type { Stick } from "../types";

type ValidationPanelProps = {
  sticks: Stick[];
  currentIndex: number;

  getPhotoUrl: (path: string) => string;

  onClose: () => void;
  onApprove: (stick: Stick) => void;
  onReject: (stick: Stick) => void;
  onNext: () => void;
  onPrevious: () => void;
};

export default function ValidationPanel({
  sticks,
  currentIndex,
  getPhotoUrl,
  onClose,
  onApprove,
  onReject,
  onNext,
  onPrevious,
}: ValidationPanelProps) {
  const stick = sticks[currentIndex];

  if (!stick) {
    return (
      <div className="validation-overlay">
        <div className="validation-panel">
          <button
            className="close-validation"
            onClick={onClose}
          >
            ✕
          </button>

          <h2>Validation</h2>

          <p>Aucun stick à valider.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="validation-overlay">
      <div className="validation-panel">
        <button
          className="close-validation"
          onClick={onClose}
        >
          ✕
        </button>

        <h2>🔎 Stick à valider</h2>

        <p className="validation-counter">
          {currentIndex + 1} / {sticks.length}
        </p>

        {stick.photo_path && (
          <img
            src={getPhotoUrl(stick.photo_path)}
            alt="Stick à valider"
            className="validation-photo"
          />
        )}

        <p>
          {stick.description || "Aucune description"}
        </p>

        <p className="stick-coordinates">
          📍 {stick.latitude.toFixed(5)},{" "}
          {stick.longitude.toFixed(5)}
        </p>

        <div className="validation-actions">
          <button
            className="validation-reject"
            onClick={() => onReject(stick)}
          >
            ❌ Je doute
          </button>

          <button
            className="validation-approve"
            onClick={() => onApprove(stick)}
          >
            ✅ Valider
          </button>
        </div>

        {sticks.length > 1 && (
          <div className="validation-navigation">
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