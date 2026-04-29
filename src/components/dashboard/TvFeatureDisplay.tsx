import { PollDisplay } from "./PollDisplay";
import { FlowDisplay } from "./FlowDisplay";

export function TvFeatureDisplay({
  mode,
  fullscreen = false,
}: {
  mode: "polls" | "flow";
  fullscreen?: boolean;
}) {
  if (mode === "flow") {
    return <FlowDisplay fullscreen={fullscreen} />;
  }

  return <PollDisplay />;
}
