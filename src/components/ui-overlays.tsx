"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { Button } from "@/components/ui";

function useDialogFocus(open: boolean, containerRef: RefObject<HTMLElement | null>, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const container = containerRef.current;
    const getFocusable = () => container?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    (getFocusable()?.[0] ?? container)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (!focusable?.length) {
        event.preventDefault();
        container?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [open, containerRef]);
}

type OverlayProps = { open: boolean; title: string; children: ReactNode; onClose: () => void };

export function Dialog({ open, title, children, onClose }: OverlayProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocus(open, dialogRef, onClose);
  if (!open) return null;

  return <div className="ui-overlay">
    <section ref={dialogRef} className="ui-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <header className="ui-dialog-header">
        <h2 id={titleId}>{title}</h2>
        <Button variant="quiet" aria-label="Close dialog" onClick={onClose}>Close</Button>
      </header>
      {children}
    </section>
  </div>;
}

export function Drawer({ open, title, children, onClose }: OverlayProps) {
  const titleId = useId();
  const drawerRef = useRef<HTMLElement>(null);
  useDialogFocus(open, drawerRef, onClose);
  if (!open) return null;

  return <div className="ui-overlay ui-overlay-drawer">
    <aside ref={drawerRef} className="ui-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <header className="ui-drawer-header">
        <h2 id={titleId}>{title}</h2>
        <Button variant="quiet" aria-label="Close drawer" onClick={onClose}>Close</Button>
      </header>
      {children}
    </aside>
  </div>;
}

export function ConfirmationDialog({
  open,
  title,
  children,
  onCancel,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocus(open, dialogRef, onCancel);
  if (!open) return null;

  return <div className="ui-overlay">
    <section ref={dialogRef} className="ui-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <header className="ui-dialog-header"><h2 id={titleId}>{title}</h2></header>
      <div>{children}</div>
      <div className="ui-confirm-actions">
        <Button onClick={onCancel}>{cancelLabel}</Button>
        <Button variant="primary" className="ui-button-danger" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </section>
  </div>;
}

export function Toast({
  open = true,
  children,
  tone = "neutral",
  duration = 4000,
  onClose,
}: {
  open?: boolean;
  children: ReactNode;
  tone?: "neutral" | "success" | "danger";
  duration?: number;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open || duration <= 0) return;
    const timeoutId = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timeoutId);
  }, [open, duration, onClose]);

  if (!open) return null;
  return <div className={`ui-toast ui-toast-${tone}`} role={tone === "danger" ? "alert" : "status"}>{children}</div>;
}
