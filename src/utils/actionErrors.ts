export function getActionErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    switch (error.message) {
      case "Tu dois être à proximité du stick":
        return "📍 Approche-toi à moins de 100 m du stick pour interagir avec lui.";

      case "Tu dois être à proximité de l'emplacement du stick":
        return "📍 Approche-toi à moins de 100 m de l'emplacement choisi pour ajouter ce stick.";

      case "Utilisateur non authentifié":
        return "🔐 Tu dois être connecté pour effectuer cette action.";

      case "Position GPS invalide":
        return "📍 Impossible de déterminer correctement ta position.";

      case "Tu ne peux pas confirmer ton propre stick":
        return "🚫 Tu ne peux pas confirmer ton propre stick.";

      case "Tu ne peux pas signaler ton propre stick":
        return "🚫 Tu ne peux pas signaler ton propre stick.";

      default:
        return "Une erreur est survenue. Réessaie.";
    }
  }

  return "Une erreur est survenue. Réessaie.";
}
