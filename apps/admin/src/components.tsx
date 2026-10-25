import { useEffect, useRef, type ReactNode } from "react";
import { X, LoaderCircle, Droplets, Inbox } from "lucide-react";
export function Brand() {
  return (
    <div className="brand">
      <span className="brandmark">
        <Droplets size={23} />
      </span>
      <div>
        califnco<span>WATER CARE</span>
      </div>
    </div>
  );
}
export function Badge({ value }: { value: string }) {
  return (
    <span className={"badge badge-" + value}>{value.replaceAll("_", " ")}</span>
  );
}
export function Empty({
  title = "Nothing here yet",
  text = "New records will appear here.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty">
      <Inbox size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function Loading() {
  return (
    <div className="empty" role="status">
      <LoaderCircle className="spin" />
      Loading your workspace…
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="modal" onCancel={onClose}>
      <header>
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function FormError({ error }: { error: string }) {
  return error ? (
    <div className="error" role="alert">
      {error}
    </div>
  ) : null;
}
export const date = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
