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
          <button className="close-validation" onClick={onClose}>
            ✕
          </button>

          <h2>🔎 Validation</h2>

          <p>Aucun stick à valider.</p>
        </div>
      </div>
    );
  }

  function openDirections() {
    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `&destination=${stick.latitude},${stick.longitude}`;

    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="validation-overlay">
      <div className="validation-panel">
        <button className="close-validation" onClick={onClose}>
          ✕
        </button>

        <div className="validation-header">
          <div>
            <h2>🔎 Stick à valider</h2>

            <p className="validation-counter">
              {currentIndex + 1} / {sticks.length}
            </p>
          </div>
        </div>

        {stick.photo_path && (
          <img
            src={getPhotoUrl(stick.photo_path)}
            alt="Stick à valider"
            className="validation-photo"
          />
        )}

        <div className="validation-info">
          {stick.origin_type && (
            <p className="validation-origin">
              {stick.origin_type === "pasted"
                ? "🧷 Stick collé"
                : "👀 Stick vu"}
            </p>
          )}

          <p className="validation-description">
            {stick.description || "Aucune description"}
          </p>

          <div className="validation-location">
            <strong>📍 Emplacement</strong>

            <span>
              {stick.latitude.toFixed(5)}, {stick.longitude.toFixed(5)}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="validation-directions"
          onClick={openDirections}
        >
          🗺️ Ouvrir l'itinéraire
        </button>

        <p className="validation-help">
          Rends-toi sur place avant de voter.
          <br />
          Une vérification GPS est effectuée lors de la validation.
        </p>

        <div className="validation-actions">
          <button className="validation-reject" onClick={() => onReject(stick)}>
            ❌ Non-valable !
          </button>

          <button
            className="validation-approve"
            onClick={() => onApprove(stick)}
          >
            ✅ Valable !
          </button>
        </div>

        {sticks.length > 1 && (
          <div className="validation-navigation">
            <button onClick={onPrevious} disabled={currentIndex === 0}>
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
