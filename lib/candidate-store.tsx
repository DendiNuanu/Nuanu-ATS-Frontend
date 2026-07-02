"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { mockCandidates, type Candidate, type Stage } from "@/lib/mock-data";

type CandidateStore = {
  candidates: Candidate[];
  getCandidate: (id: string) => Candidate | undefined;
  updateCandidate: (id: string, updates: Partial<Candidate>) => void;
};

const CandidateContext = createContext<CandidateStore | null>(null);

export function CandidateProvider({ children }: { children: ReactNode }) {
  const [candidates, setCandidates] = useState<Candidate[]>(mockCandidates);

  const getCandidate = (id: string) => candidates.find((c) => c.id === id);

  const updateCandidate = (id: string, updates: Partial<Candidate>) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    );
  };

  return (
    <CandidateContext.Provider value={{ candidates, getCandidate, updateCandidate }}>
      {children}
    </CandidateContext.Provider>
  );
}

export function useCandidateStore(): CandidateStore {
  const ctx = useContext(CandidateContext);
  if (!ctx) {
    throw new Error("useCandidateStore must be used within a CandidateProvider");
  }
  return ctx;
}

export type { Candidate, Stage };
