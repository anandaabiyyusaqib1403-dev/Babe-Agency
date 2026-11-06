"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

type AppShellState = { collapsed: boolean; setCollapsed: (collapsed: boolean) => void };
const AppShellContext = createContext<AppShellState | null>(null);

export function AppShellStateProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return <AppShellContext.Provider value={{ collapsed, setCollapsed }}>{children}</AppShellContext.Provider>;
}

export function useAppShellState() {
  const state = useContext(AppShellContext);
  if (!state) throw new Error("useAppShellState must be used inside AppShellStateProvider.");
  return state;
}
