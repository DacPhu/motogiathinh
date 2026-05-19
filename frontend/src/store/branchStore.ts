import { create } from 'zustand'

interface BranchState {
  selectedBranchId: string | null
  setSelectedBranch: (id: string | null) => void
}

export const useBranchStore = create<BranchState>((set) => ({
  selectedBranchId: null,
  setSelectedBranch: (id) => set({ selectedBranchId: id }),
}))
