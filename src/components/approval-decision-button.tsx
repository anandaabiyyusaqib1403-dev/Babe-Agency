"use client";

import type { ReactNode } from "react";

export function ApprovalDecisionButton({ decision, confirmation, className, children }: { decision: string; confirmation: string; className: string; children: ReactNode }) {
  return <button className={className} type="submit" name="decision" value={decision} onClick={event => { if (!window.confirm(confirmation)) event.preventDefault(); }}>{children}</button>;
}
