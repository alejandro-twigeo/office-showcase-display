const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const token = Deno.env.get("MAPILLARY_CLIENT_TOKEN");
  if (!token) {
    return new Response(
      JSON.stringify({ error: "MAPILLARY_CLIENT_TOKEN not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const url = new URL(req.url);
  const imageId = url.searchParams.get("image_id");

  if (imageId) {
    const graphUrl = `https://graph.mapillary.com/${imageId}?access_token=${token}&fields=thumb_2048_url`;
    const res = await fetch(graphUrl);
    const body = await res.text();
    return new Response(
      JSON.stringify({ status: res.status, body }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ token }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
