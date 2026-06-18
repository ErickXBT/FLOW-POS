import React, { createContext, useContext, useState, useEffect } from "react";
import { useListBranches, getListBranchesQueryKey } from "@workspace/api-client-react";
import type { AuthUser } from "./use-auth";

interface BranchContextType {
  activeBranchId: number | undefined;
  activeBranchName: string | undefined;
  setActiveBranchId: (id: number | undefined) => void;
  branches: any[];
  isLoading: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  const isOwnerOrManager = user.role === "owner" || user.role === "manager";
  const { data: branchesData, isLoading } = useListBranches({
    query: {
      enabled: isOwnerOrManager,
      queryKey: getListBranchesQueryKey(),
    }
  });
  const branches = branchesData || [];

  const [activeBranchId, setActiveBranchIdState] = useState<number | undefined>(() => {
    // If not owner/manager, they must be locked to their own branch
    if (user.role !== "owner" && user.role !== "super_admin" && user.branchId) {
      return user.branchId;
    }
    // Try to load from localStorage first for persistence
    const saved = localStorage.getItem("flow_active_branch_id");
    return saved ? Number(saved) : undefined;
  });

  // Keep state in sync with user role/lock changes
  useEffect(() => {
    if (user.role !== "owner" && user.role !== "super_admin" && user.branchId) {
      setActiveBranchIdState(user.branchId);
    }
  }, [user]);

  const setActiveBranchId = (id: number | undefined) => {
    if (user.role !== "owner" && user.role !== "super_admin" && user.branchId) {
      // Staff cannot change their branch
      return;
    }
    setActiveBranchIdState(id);
    if (id === undefined) {
      localStorage.removeItem("flow_active_branch_id");
    } else {
      localStorage.setItem("flow_active_branch_id", String(id));
    }
  };

  const activeBranch = branches.find((b: any) => b.id === activeBranchId);
  const activeBranchName = user.branchName || activeBranch?.name || (activeBranchId ? `Cabang #${activeBranchId}` : undefined);

  return (
    <BranchContext.Provider
      value={{
        activeBranchId,
        activeBranchName,
        setActiveBranchId,
        branches,
        isLoading,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useActiveBranch() {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error("useActiveBranch must be used within a BranchProvider");
  }
  return context;
}
