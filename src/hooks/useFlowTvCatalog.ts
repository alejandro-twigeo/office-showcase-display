import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FlowChannel } from "@/lib/flowChannels";

interface FlowTvCatalogResponse {
  channels: FlowChannel[];
}

function titleizeSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function extractChannelSlugs(html: string) {
  const matches = Array.from(
    html.matchAll(/\/flow\/tv\/channel\/([a-z0-9-]+)(?:\/[A-Za-z0-9_-]+)?/gi),
    (match) => match[1].toLowerCase()
  );
  return unique(matches);
}

async function fetchBrowserCatalog(): Promise<FlowChannel[]> {
  const response = await fetch("https://labs.google/flow/tv/channels");
  const html = await response.text();
  const ids = extractChannelSlugs(html);
  return ids.map((id) => ({
    id,
    name: titleizeSlug(id),
    description: "Live channel discovered from Google Flow.",
  }));
}

export function useFlowTvCatalog() {
  return useQuery({
    queryKey: ["flow_tv_catalog"],
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("flow-tv-catalog");
        if (error) throw new Error(error.message || "Flow TV catalog request failed");
        if (data && typeof data === "object" && "channels" in data && Array.isArray((data as FlowTvCatalogResponse).channels)) {
          const channels = (data as FlowTvCatalogResponse).channels.filter(
            (channel): channel is FlowChannel =>
              !!channel &&
              typeof channel === "object" &&
              typeof channel.id === "string" &&
              typeof channel.name === "string" &&
              typeof channel.description === "string"
          );
          if (channels.length > 0) return channels;
        }
      } catch {
        // fall through to browser fetch
      }

      return fetchBrowserCatalog();
    },
  });
}
