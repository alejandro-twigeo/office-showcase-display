import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const mapillaryToken = Deno.env.get("MAPILLARY_CLIENT_TOKEN")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Read schedule
  const { data: schedule, error: schedErr } = await supabase
    .from("round_schedule")
    .select("*")
    .eq("id", 1)
    .single();

  if (schedErr || !schedule) {
    return new Response(JSON.stringify({ error: "No schedule found" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!schedule.enabled) {
    return new Response(JSON.stringify({ skipped: true, reason: "disabled" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check if it's the right hour in Stockholm (Europe/Stockholm)
  const nowStockholm = new Date().toLocaleString("en-US", { timeZone: "Europe/Stockholm" });
  const stockholmHour = new Date(nowStockholm).getHours();

  if (stockholmHour !== schedule.reset_hour) {
    return new Response(
      JSON.stringify({ skipped: true, reason: `current Stockholm hour ${stockholmHour} != ${schedule.reset_hour}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Prevent double-reset within the same hour
  if (schedule.last_auto_reset_at) {
    const lastReset = new Date(schedule.last_auto_reset_at);
    const diffMs = Date.now() - lastReset.getTime();
    if (diffMs < 55 * 60 * 1000) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "already reset this hour" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  try {
    // Deactivate previous round
    await supabase.from("rounds").update({ is_active: false }).eq("is_active", true);

    // Create new round
    const { data: newRound, error: roundErr } = await supabase
      .from("rounds")
      .insert({ is_active: true })
      .select()
      .single();
    if (roundErr || !newRound) throw roundErr ?? new Error("Failed to create round");

    // Fetch Mapillary images for easy and hard
    const fetchImage = async (difficulty: number) => {
      const bbox = "23.0,42.0,28.0,44.0"; // Bulgaria area
      const url = `https://graph.mapillary.com/images?access_token=${mapillaryToken}&fields=id,geometry&bbox=${bbox}&limit=100`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.data?.length) throw new Error(`No Mapillary images for difficulty ${difficulty}`);
      const img = data.data[Math.floor(Math.random() * data.data.length)];
      return {
        lat: img.geometry.coordinates[1],
        lng: img.geometry.coordinates[0],
        pano_id: img.id,
      };
    };

    const [easyImg, hardImg] = await Promise.all([fetchImage(1), fetchImage(3)]);

    // Deactivate old locations
    await Promise.all([
      supabase.from("locations").update({ is_active: false }).eq("is_active", true).eq("difficulty", 1),
      supabase.from("locations").update({ is_active: false }).eq("is_active", true).eq("difficulty", 3),
    ]);

    // Create new locations
    await supabase.from("locations").insert([
      { lat: easyImg.lat, lng: easyImg.lng, pano_id: easyImg.pano_id, difficulty: 1, is_active: true, round_id: newRound.id },
      { lat: hardImg.lat, lng: hardImg.lng, pano_id: hardImg.pano_id, difficulty: 3, is_active: true, round_id: newRound.id },
    ]);

    // Update last_auto_reset_at
    await supabase.from("round_schedule").update({ last_auto_reset_at: new Date().toISOString() }).eq("id", 1);

    return new Response(JSON.stringify({ success: true, round_id: newRound.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
