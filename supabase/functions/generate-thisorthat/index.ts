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

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().slice(0, 10);

    // Check if already generated today
    const { data: existing } = await supabase
      .from("daily_thisorthat")
      .select("questions")
      .eq("run_date", today)
      .single();

    if (existing?.questions && (existing.questions as any[]).length >= 5) {
      return new Response(JSON.stringify({ questions: existing.questions, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch recent questions to avoid repetition
    const { data: recentRows } = await supabase
      .from("daily_thisorthat")
      .select("questions, run_date")
      .order("run_date", { ascending: false })
      .limit(7);

    const recentPrompts: string[] = [];
    if (recentRows) {
      for (const row of recentRows) {
        const qs = row.questions as any[];
        if (qs) {
          for (const q of qs) {
            if (q.prompt) recentPrompts.push(`${q.prompt} (${q.a} vs ${q.b})`);
          }
        }
      }
    }

    const avoidSection = recentPrompts.length > 0
      ? `\n\nCRITICAL: Do NOT reuse or rephrase any of these recently used questions or comparisons:\n${recentPrompts.map(p => `- ${p}`).join('\n')}\n\nAll 5 questions must be completely different topics and comparisons from the above list.`
      : '';

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are a trivia question generator. Generate fun, interesting binary comparison questions where one answer is clearly factually correct. Every day must have COMPLETELY FRESH questions — never repeat topics, subjects, or comparisons from previous days. Be creative and surprising."
          },
          {
            role: "user",
            content: `Generate 5 unique "This or That" trivia questions for ${today}. Each question should ask the player to pick between two options where one is factually correct (e.g. "Which is bigger?", "Which came first?", "Which has more?"). Cover diverse categories — pick 5 DIFFERENT categories from: geography, science, history, nature, food, sport, tech, space, language, music, movies, art, architecture, economics, biology, chemistry, literature, mythology, math, transportation, fashion, medicine. Make sure the facts are accurate and verifiable. Be creative with the comparisons — avoid cliché geography/space comparisons.${avoidSection}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_questions",
              description: "Submit 5 This or That trivia questions",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        prompt: { type: "string", description: "The comparison question, e.g. 'Which country has more people?'" },
                        a: { type: "string", description: "Option A" },
                        b: { type: "string", description: "Option B" },
                        correct: { type: "string", enum: ["a", "b"], description: "Which option is correct" },
                        category: { type: "string", description: "Category like Geography, Science, History, etc." }
                      },
                      required: ["prompt", "a", "b", "correct", "category"],
                      additionalProperties: false
                    },
                    minItems: 5,
                    maxItems: 5
                  }
                },
                required: ["questions"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "submit_questions" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const parsed = JSON.parse(toolCall.function.arguments);
    const questions = parsed.questions;

    if (!questions || questions.length < 5) {
      throw new Error("AI did not return 5 questions");
    }

    // Upsert into DB
    const { error: upsertErr } = await supabase
      .from("daily_thisorthat")
      .upsert({ run_date: today, questions }, { onConflict: "run_date" });

    if (upsertErr) {
      console.error("Upsert error:", upsertErr);
      throw upsertErr;
    }

    return new Response(JSON.stringify({ questions, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-thisorthat error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
