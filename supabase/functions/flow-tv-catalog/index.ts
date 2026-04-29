const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const response = await fetch("https://labs.google/flow/tv/channels", {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const html = await response.text();
    const ids = extractChannelSlugs(html);
    const channels = ids.map((id) => ({
      id,
      name: titleizeSlug(id),
      description: "Live channel discovered from Google Flow.",
    }));

    return new Response(JSON.stringify({ channels }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message, channels: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
