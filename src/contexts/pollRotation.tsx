import { createContext, useContext, useState, ReactNode } from "react";
import { ROTATE_SECONDS } from "@/components/dashboard/PollDisplay";

interface PollRotationContextValue {
  rotations: number;
  pollTimeLeft: number;
  setPollTimeLeft: (n: number) => void;
  increment: () => void;
}

const PollRotationContext = createContext<PollRotationContextValue | null>(null);

export function PollRotationProvider({ children }: { children: ReactNode }) {
  const [rotations, setRotations] = useState(0);
  const [pollTimeLeft, setPollTimeLeft] = useState(ROTATE_SECONDS);

  const increment = () => setRotations((r) => r + 1);

  return (
    <PollRotationContext.Provider
      value={{ rotations, pollTimeLeft, setPollTimeLeft, increment }}
    >
      {children}
    </PollRotationContext.Provider>
  );
}

export function usePollRotations() {
  const ctx = useContext(PollRotationContext);
  if (!ctx) {
    return { rotations: 0, pollTimeLeft: ROTATE_SECONDS, setPollTimeLeft: () => {}, increment: () => {} };
  }
  return ctx;
}
