import { type ReactNode, useEffect, useRef } from "react";

interface Props {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Id of the element that names the dialog. */
  readonly labelledBy: string;
  readonly children: ReactNode;
}

/**
 * A modal built on the native <dialog> element, which supplies the focus trap,
 * Escape-to-close, inert background and focus restoration. Children only mount
 * while it is open, so timers inside it stop when it closes.
 */
export function Dialog({ open, onClose, labelledBy, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} aria-labelledby={labelledBy} onClose={onClose}>
      {open ? (
        <div className="animate-rise-in w-[min(32rem,calc(100vw-2rem))] rounded-3xl border border-line bg-bg p-6 shadow-2xl">
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
