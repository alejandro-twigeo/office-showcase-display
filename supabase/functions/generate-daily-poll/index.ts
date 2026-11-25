import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Creates one AI-written poll per round and closes the previous one, so a new
 * poll lands with every daily reset. Safe to call as often as you like: if the
 * current round already has its poll, it does nothing. The TV calls it.
 * Without an active round it falls back to one poll per day (Stockholm time).
 */

const AI_AUTHOR = "Daily poll ✨";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Midnight today in Stockholm, as a UTC ISO string. */
function stockholmDayStartIso(): string {
  const now = new Date();
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Stockholm" }).format(now); // YYYY-MM-DD
  const stockholmNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Stockholm" }));
  const offsetMs = stockholmNow.getTime() - new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(new Date(`${ymd}T00:00:00Z`).getTime() - offsetMs).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // The poll follows the round reset; if there's no round, it follows the calendar day
    const { data: round } = await supabase
      .from("rounds")
      .select("created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const since = round?.created_at ?? stockholmDayStartIso();

    // Already made this round's poll? Then nothing to do.
    const { data: existing } = await supabase
      .from("polls")
      .select("id")
      .eq("created_by", AI_AUTHOR)
      .gte("created_at", since)
      .limit(1);
    if (existing && existing.length > 0) return json({ skipped: true, reason: "poll already made for this round" });

    // Recent AI questions, so it doesn't repeat itself
    const { data: recent } = await supabase
      .from("polls")
      .select("question")
      .eq("created_by", AI_AUTHOR)
      .order("created_at", { ascending: false })
      .limit(30);
    const avoid = (recent ?? []).map((r) => `- ${r.question}`).join("\n");

    const today = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Stockholm",
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date());

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You write the daily poll for the office TV at Twigeo, a mobile growth and performance marketing agency in Stockholm. " +
              "People vote from their phones in one tap. Good polls are light, a bit playful, easy to have an opinion on, and start conversations at the coffee machine. " +
              "Mix everyday office life, food, Stockholm and Swedish life, the season, tech and apps, and the occasional marketing or ads topic. " +
              "Never politics, religion, health, money, or anything that could make someone feel judged. No trivia with a right answer.",
          },
          {
            role: "user",
            content:
              `Write the poll for ${today}. Question under 70 characters. 3 or 4 options, each under 24 characters, ` +
              `clearly different from each other. If the date suggests something seasonal, you can use it.` +
              (avoid ? `\n\nDo not repeat or rephrase any of these recent polls:\n${avoid}` : ""),
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_poll",
              description: "Submit today's poll",
              parameters: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  options: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 4 },
                },
                required: ["question", "options"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_poll" } },
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI gateway error:", aiResponse.status, await aiResponse.text());
      return json({ error: `AI gateway error ${aiResponse.status}` }, 502);
    }

    const ai = await aiResponse.json();
    const args = ai?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const poll = typeof args === "string" ? JSON.parse(args) : args;
    const question = String(poll?.question ?? "").trim();
    const options = Array.isArray(poll?.options) ? poll.options.map((o: unknown) => String(o).trim()).filter(Boolean) : [];
    if (!question || options.length < 2) throw new Error("AI returned an unusable poll");

    // Close yesterday's AI poll(s) so the TV only rotates today's
    const { data: oldPolls } = await supabase
      .from("polls")
      .select("id")
      .eq("created_by", AI_AUTHOR)
      .eq("is_active", true);
    for (const p of oldPolls ?? []) {
      await supabase.rpc("close_poll", {
        p_poll_id: p.id,
        p_reason: "daily_rotation",
        p_source: "generate-daily-poll",
        p_closed_by: AI_AUTHOR,
      });
    }

    const { data: inserted, error } = await supabase
      .from("polls")
      .insert({
        question,
        options: options.slice(0, 4),
        created_by: AI_AUTHOR,
        poll_type: "choice",
        is_active: true,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;

    return json({ success: true, poll_id: inserted.id, question, options });
  } catch (err) {
    console.error("generate-daily-poll failed:", err);
    return json({ error: String(err) }, 500);
  }
});
