import { useEffect, useState } from "react";
import type { DraftStick, StickOrigin } from "../types";

type StickFormProps = {
  draftStick: DraftStick;
  description: string;
  photo: File | null;
  originType: StickOrigin | null;

  onDescriptionChange: (value: string) => void;
  onPhotoChange: (file: File | null) => void;
  onOriginTypeChange: (value: StickOrigin) => void;

  onSave: () => void;
  onCancel: () => void;
};

export default function StickForm({
  draftStick,
  description,
  photo,
  originType,
  onDescriptionChange,
  onPhotoChange,
  onOriginTypeChange,
  onSave,
  onCancel,
}: StickFormProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photo) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(photo);

    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [photo]);

  return (
    <div className="stick-form">
      <h2>Ajouter un stick</h2>

      <p className="stick-coordinates">
        📍 {draftStick.lat.toFixed(6)}, {draftStick.lng.toFixed(6)}
      </p>

      {!photo && (
        <label className="photo-capture">
          📷 Prendre une photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;

              onPhotoChange(file);
            }}
          />
        </label>
      )}

      {photo && previewUrl && (
        <div className="photo-preview">
          <img src={previewUrl} alt="Aperçu du stick" />

          <label className="change-photo-button">
            📷 Reprendre la photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;

                onPhotoChange(file);
              }}
            />
          </label>
        </div>
      )}

      <p className="photo-help">Une photo prise sur place est obligatoire.</p>

      <div className="origin-choice">
        <p>Comment as-tu trouvé ce stick ?</p>

        <div className="origin-buttons">
          <button
            type="button"
            className={
              originType === "seen" ? "origin-button selected" : "origin-button"
            }
            onClick={() => onOriginTypeChange("seen")}
          >
            👀 Je l'ai vu
          </button>

          <button
            type="button"
            className={
              originType === "pasted"
                ? "origin-button selected"
                : "origin-button"
            }
            onClick={() => onOriginTypeChange("pasted")}
          >
            🧷 Je l'ai collé
          </button>
        </div>
      </div>

      <label>
        Description
        <textarea
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="Décris le stick..."
        />
      </label>

      <div className="form-buttons">
        <button onClick={onCancel}>Annuler</button>

        <button onClick={onSave} disabled={!photo || !originType}>
          Ajouter
        </button>
      </div>
    </div>
  );
}
