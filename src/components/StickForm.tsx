import type { DraftStick } from "../types";

type StickFormProps = {
  draftStick: DraftStick;
  description: string;

  onDescriptionChange: (value: string) => void;
  onPhotoChange: (file: File | null) => void;

  onSave: () => void;
  onCancel: () => void;
};

export default function StickForm({
  draftStick,
  description,
  onDescriptionChange,
  onPhotoChange,
  onSave,
  onCancel,
}: StickFormProps) {
  return (
    <div className="stick-form">
      <h2>Ajouter un stick</h2>

      <p>
        📍 {draftStick.lat.toFixed(6)},{" "}
        {draftStick.lng.toFixed(6)}
      </p>

      <label>
        Photo

        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file =
              event.target.files?.[0] ?? null;

            onPhotoChange(file);
          }}
        />
      </label>

      <label>
        Description

        <textarea
          value={description}
          onChange={(event) =>
            onDescriptionChange(event.target.value)
          }
          placeholder="Décris le stick..."
        />
      </label>

      <div className="form-buttons">
        <button onClick={onCancel}>
          Annuler
        </button>

        <button onClick={onSave}>
          Ajouter
        </button>
      </div>
    </div>
  );
}