import type { Stick, Profile, StickConfirmation, StickReport } from "../types";

type StickDetailsProps = {
  stick: Stick;
  author: Profile | null;
  confirmations: StickConfirmation[];
  reports: StickReport[];
  photoUrl: string | null;

  currentUserId: string | null;

  onClose: () => void;
  onConfirm: () => void;
  
  isConfirmingStick: boolean;
  isReportingStick: boolean;

  onReportMissing: () => void;

  isAdmin: boolean;
  onDelete: () => void;
  onOpenAuthor?: (userId: string) => void;

  lastActivityAuthor: Profile | null;
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
  isConfirmingStick,
  isReportingStick,
  onReportMissing,
  isAdmin,
  onDelete,
  onOpenAuthor,
  lastActivityAuthor,
}: StickDetailsProps) {
  const isOwner = currentUserId !== null && stick.user_id === currentUserId;

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

    const confirmationDate = new Date(latestConfirmation.updated_at).getTime();

    const reportDate = new Date(latestReport.updated_at).getTime();

    return confirmationDate > reportDate ? "present" : "missing";
  }

  const status = getStickStatus();

  return (
    <aside className="stick-details">
      <button className="close-stick-details" onClick={onClose}>
        ✕
      </button>

      <h2>Stick</h2>

      <div className="stick-history">
        {stick.origin_type && (
          <p className="stick-origin">
            {stick.origin_type === "pasted"
              ? `🧷 Stick collé par : ${author?.username ?? "Inconnu"}`
              : `👀 Stick vu par : ${author?.username ?? "Inconnu"}`}
          </p>
        )}

        {confirmations[0] || reports[0] ? (
          (() => {
            const latestConfirmation = confirmations[0];

            const latestReport = reports[0];

            const confirmationIsLatest =
              latestConfirmation &&
              (!latestReport ||
                new Date(latestConfirmation.updated_at).getTime() >
                  new Date(latestReport.updated_at).getTime());

            if (confirmationIsLatest) {
              return (
                <p className="stick-last-activity">
                  👀 Vu en dernier le{" "}
                  {new Date(latestConfirmation.updated_at).toLocaleDateString(
                    "fr-FR",
                  )}{" "}
                  par : {lastActivityAuthor?.username ?? "Inconnu"}
                </p>
              );
            }

            return (
              <p className="stick-last-activity">
                🚩 Signalé disparu le{" "}
                {new Date(latestReport!.updated_at).toLocaleDateString("fr-FR")}{" "}
                par : {lastActivityAuthor?.username ?? "Inconnu"}
              </p>
            );
          })()
        ) : (
          <p className="stick-last-activity">
            Aucune activité depuis son ajout
          </p>
        )}
      </div>

      <p className="stick-author">
        Ajouté par{" "}
        {author ? (
          <button
            className="stick-author-button"
            onClick={() => onOpenAuthor?.(author.id)}
          >
            {author.username}
          </button>
        ) : (
          "Inconnu"
        )}
      </p>

      {photoUrl && <img src={photoUrl} alt="Stick" className="stick-photo" />}

      <p>{stick.description || "Aucune description"}</p>

      <p className="stick-coordinates">
        📍 {stick.latitude.toFixed(5)}, {stick.longitude.toFixed(5)}
      </p>

      {stick.moderation_status === "pending" && (
        <div className="moderation-status moderation-pending">
          <strong>🟠 En attente de validation</strong>

          <span>Ce stick n'est pas encore visible publiquement.</span>
        </div>
      )}

      {stick.moderation_status === "review" && (
        <div className="moderation-status moderation-review">
          <strong>🟣 En cours de vérification</strong>

          <span>Ce stick doit être examiné par un modérateur.</span>
        </div>
      )}

      {stick.moderation_status === "approved" && (
        <div className="stick-status">
          {status === "present" && (
            <>
              <strong>🟢 Présent</strong>

              <span>
                Confirmé le{" "}
                {new Date(confirmations[0].updated_at).toLocaleDateString(
                  "fr-FR",
                )}
              </span>
            </>
          )}

          {status === "missing" && (
            <>
              <strong>🔴 Signalé disparu</strong>

              <span>
                Signalé le{" "}
                {new Date(reports[0].updated_at).toLocaleDateString("fr-FR")}
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

      {currentUserId && (
        <div className="stick-actions">
          <button onClick={onConfirm} disabled={isOwner || isConfirmingStick}>
            {isOwner ? "Tu ne peux valider ton stick."  : isConfirmingStick ? "Patientez..." : "✅ Je l'ai vu !"}
          </button>

          <button onClick={onReportMissing} disabled={isOwner || isReportingStick}>
            {isOwner ? "Tu ne peux signaler ton stick." : isReportingStick ? "Patientez..." : "🚩 Il a disparu"}
          </button>
        </div>
      )}

      {isAdmin && (
        <div className="admin-actions">
          <button onClick={onDelete}>🗑 Supprimer le stick</button>
        </div>
      )}
    </aside>
  );
}
