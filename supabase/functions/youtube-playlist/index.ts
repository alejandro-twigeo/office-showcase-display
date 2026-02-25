const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const listId = url.searchParams.get("list");
  const seed = url.searchParams.get("v");

  if (!listId) {
    return new Response(
      JSON.stringify({ error: "list parameter required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const extract = (html: string) =>
      Array.from(html.matchAll(/\"videoId\":\"([a-zA-Z0-9_-]{11})\"/g)).map((m) => m[1]);

    // attempt playlist page first
    let res = await fetch(`https://www.youtube.com/playlist?list=${listId}`);
    let html = await res.text();
    let ids = extract(html);

    if (ids.length === 0 && seed) {
      const watchUrl = `https://www.youtube.com/watch?v=${seed}&list=${listId}`;
      res = await fetch(watchUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      html = await res.text();
      ids = extract(html);
    }

    ids = Array.from(new Set(ids));
    return new Response(JSON.stringify({ ids }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});