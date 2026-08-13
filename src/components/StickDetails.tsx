import type {
    Stick,
    Profile,
    StickConfirmation,
    StickReport,
} from "../types";

type StickDetailsProps = {
    stick: Stick;
    author: Profile | null;
    confirmations: StickConfirmation[];
    reports: StickReport[];
    photoUrl: string | null;

    currentUserId: string | null;

    onClose: () => void;
    onConfirm: () => void;
    onReportMissing: () => void;

    isAdmin: boolean;
    onDelete: () => void;
};

export default function StickDetails({
  stick,
  author,
  confirmations,
  reports,
  photoUrl,
  currentUserId,
  onClose,
  onConfirm,
  onReportMissing,
  isAdmin,
  onDelete,

}: StickDetailsProps) {
  const isOwner =
    currentUserId !== null &&
    stick.user_id === currentUserId;

  function getStickStatus() {
    const latestConfirmation = confirmations[0];
    const latestReport = reports[0];

    if (!latestConfirmation && !latestReport) {
      return "unknown";
    }

    if (latestConfirmation && !latestReport) {
      return "present";
    }

    if (!latestConfirmation && latestReport) {
      return "missing";
    }

    const confirmationDate = new Date(
      latestConfirmation.updated_at
    ).getTime();

    const reportDate = new Date(
      latestReport.updated_at
    ).getTime();

    return confirmationDate > reportDate
      ? "present"
      : "missing";
  }

  const status = getStickStatus();

  return (
    <aside className="stick-details">
      <button
        className="close-stick-details"
        onClick={onClose}
      >
        ✕
      </button>

      <h2>Stick</h2>

      <p className="stick-author">
        Ajouté par{" "}
        <strong>
          {author?.username ?? "Inconnu"}
        </strong>
      </p>

      {photoUrl && (
        <img
          src={photoUrl}
          alt="Stick"
          className="stick-photo"
        />
      )}

      <p>
        {stick.description || "Aucune description"}
      </p>

      <p className="stick-coordinates">
        📍 {stick.latitude.toFixed(5)},{" "}
        {stick.longitude.toFixed(5)}
      </p>
      {stick.moderation_status === "pending" && (
        <div className="moderation-status moderation-pending">
          <strong>🟠 En attente de validation</strong>

          <span>
            Ce stick n'est pas encore visible publiquement.
          </span>
        </div>
      )}

      {stick.moderation_status === "review" && (
        <div className="moderation-status moderation-review">
          <strong>🟣 En cours de vérification</strong>

          <span>
            Ce stick doit être examiné par un modérateur.
          </span>
        </div>
      )}
      {stick.moderation_status === "approved" && (
        <div className="stick-status">
          {status === "present" && (
          <>
            <strong>🟢 Présent</strong>

            <span>
              Confirmé le{" "}
              {new Date(
                confirmations[0].updated_at
              ).toLocaleDateString("fr-FR")}
            </span>
          </>
        )}

        {status === "missing" && (
          <>
            <strong>🔴 Signalé disparu</strong>

            <span>
              Signalé le{" "}
              {new Date(
                reports[0].updated_at
              ).toLocaleDateString("fr-FR")}
            </span>
          </>
        )}

        {status === "unknown" && (
          <>
            <strong>⚪ Non vérifié</strong>
            <span>Aucune information récente</span>
          </>
        )}
        </div>
      )}
      <div className="stick-actions">
        <button
          onClick={onConfirm}
          disabled={isOwner}
        >
          {isOwner
            ? "Votre stick"
            : "✅ Toujours présent"}
        </button>

        <button
          onClick={onReportMissing}
          disabled={isOwner}
        >
          {isOwner
            ? "Votre stick"
            : "🚩 Signaler disparu"}
        </button>
      </div>
      {isAdmin && (
        <div className="admin-actions">
            <button onClick={onDelete}>
            🗑 Supprimer le stick
            </button>
        </div>
    )}
    </aside>
  );
}