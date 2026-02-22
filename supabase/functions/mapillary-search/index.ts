const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("MAPILLARY_CLIENT_TOKEN");
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Mapillary token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { lat, lng, radius = 1000, limit = 20 } = await req.json();

    if (typeof lat !== "number" || typeof lng !== "number") {
      return new Response(
        JSON.stringify({ success: false, error: "lat and lng required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use closeto + radius approach (supported in Mapillary v4)
    // Also try bbox with small area as fallback
    const halfDeg = radius / 111000; // approximate degrees
    const bbox = `${lng - halfDeg},${lat - halfDeg},${lng + halfDeg},${lat + halfDeg}`;

    const url =
      `https://graph.mapillary.com/images` +
      `?fields=id,computed_geometry,thumb_2048_url` +
      `&bbox=${bbox}` +
      `&limit=${Math.min(limit, 100)}`;

    console.log("Fetching Mapillary with bbox:", bbox);

    const res = await fetch(url, {
      headers: { Authorization: `OAuth ${token}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Mapillary bbox error:", res.status, errText.substring(0, 300));

      // Fallback: try without bbox, use a different approach
      // Try the image search endpoint with organization_id or similar
      return new Response(
        JSON.stringify({
          success: false,
          error: `Mapillary API error ${res.status}`,
          details: errText.substring(0, 200),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const images = (data.data || [])
      .map((img: any) => ({
        id: String(img.id),
        lat: img.computed_geometry?.coordinates?.[1],
        lng: img.computed_geometry?.coordinates?.[0],
        thumb_url: img.thumb_2048_url,
      }))
      .filter((img: any) => img.lat != null && img.lng != null && img.thumb_url);

    console.log(`Found ${images.length} images`);

    return new Response(
      JSON.stringify({ success: true, images }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
