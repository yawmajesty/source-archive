"use client";

// Client-side context provider for the workspace object + role.
// Client components in the brand tree read from useWorkspaceContext()
// instead of prop-drilling. The server layout resolves the actual data
// via getWorkspaceContext() and passes it in.

import { createContext, useContext } from "react";
import type { WorkspaceContext } from "@/lib/brand-data";

const Ctx = createContext<WorkspaceContext | null>(null);

export function WorkspaceContextProvider({
  value,
  children,
}: {
  value: WorkspaceContext;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspaceContext(): WorkspaceContext {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error("useWorkspaceContext must be used inside a WorkspaceContextProvider");
  }
  return v;
}
