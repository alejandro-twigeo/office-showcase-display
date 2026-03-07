import { usePollRotations } from "@/contexts/pollRotation";
import { PollDisplay } from "./PollDisplay";
import { NewsDisplay } from "./NewsDisplay";

/**
 * Alternates between PollDisplay and NewsDisplay every poll rotation cycle (30s).
 * Even rotations → Poll, Odd rotations → News.
 */
export function RotatingPollNews() {
  const { rotations } = usePollRotations();
  const showNews = rotations % 2 === 1;

  return showNews ? <NewsDisplay /> : <PollDisplay />;
}
