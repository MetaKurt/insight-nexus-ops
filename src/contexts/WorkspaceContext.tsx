import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { workspaces } from "@/mocks/data";
import type { Workspace } from "@/types";

interface WorkspaceContextValue {
  workspaces: Workspace[];
  workspaceId: string; // "all" or workspace id
  setWorkspaceId: (id: string) => void;
  current: Workspace | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

const STORAGE_KEY = "signalhub.workspaceId";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaceId, setWorkspaceIdState] = useState<string>(() => {
    if (typeof window === "undefined") return "all";
    return localStorage.getItem(STORAGE_KEY) ?? "all";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, workspaceId);
  }, [workspaceId]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      workspaceId,
      setWorkspaceId: setWorkspaceIdState,
      current: workspaces.find((w) => w.id === workspaceId) ?? null,
    }),
    [workspaceId],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
