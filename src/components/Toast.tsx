type ToastProps = {
  message: string;
  onClose: () => void;
};

export default function Toast({ message, onClose }: ToastProps) {
  return (
    <div className="toast">
      <span>{message}</span>

      <button type="button" onClick={onClose} aria-label="Fermer">
        ✕
      </button>
    </div>
  );
}
