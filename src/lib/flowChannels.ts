export interface FlowChannel {
  id: string;
  name: string;
  description: string;
}

export function getFlowChannelUrl(channelId: string) {
  return `https://labs.google/flow/tv/channel/${channelId}?random=true`;
}

export const FLOW_FALLBACK_CHANNEL = {
  id: "balancing-act",
  name: "Balancing Act",
  description: "Fallback live Flow channel.",
  url: "https://labs.google/flow/tv/channel/balancing-act/jzMRWu1tyC2gLMcG6DZi?random=true",
} as const;
