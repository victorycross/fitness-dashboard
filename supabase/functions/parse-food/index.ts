import Anthropic from "npm:@anthropic-ai/sdk@^0.39.0";
import { createClient } from "npm:@supabase/supabase-js@^2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { description, image_base64, image_media_type, today } =
      await req.json();

    if (!description && !image_base64) {
      return new Response(
        JSON.stringify({ error: "Provide a description or image." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const client = new Anthropic();

    const content: Anthropic.MessageParam["content"] = [];

    if (image_base64) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: (image_media_type ||
            "image/jpeg") as Anthropic.Base64ImageSource["media_type"],
          data: image_base64,
        },
      });
    }

    content.push({
      type: "text",
      text:
        (today ? `Today's date is ${today}.\n\n` : "") +
        (description || "Extract all food items from this image."),
    });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: `You are a food log parser. Extract food items and nutrition from the user's text or image.
Return ONLY valid JSON — no markdown, no explanation:
{
  "foods": [
    {
      "name": "Food Name",
      "quantity": "2",
      "unit": "eggs",
      "calories": 140,
      "protein_g": 12,
      "carbs_g": 1,
      "fat_g": 10,
      "fibre_g": 0
    }
  ],
  "meal": "breakfast | lunch | dinner | snack | null",
  "date": "YYYY-MM-DD or null",
  "notes": "any extra context or null"
}
CRITICAL RULES — read carefully:
- Create ONE entry per distinct food item.
  Example: "2 eggs and toast with butter" → 3 entries (eggs, toast, butter)
  Example: "chicken caesar salad" → 1 entry (treat as a single dish)
- quantity is a numeric string ("2", "1.5", "1")
- unit is a short descriptor ("eggs", "slice", "cup", "g", "ml", "serving", "bowl", "piece")
- Estimate realistic nutrition values per the TOTAL quantity described (not per unit).
  Example: "2 eggs" → calories for 2 eggs (~140), not 1 egg.
- If the user says something vague like "a sandwich", estimate reasonable average values.
- Use metric units internally (grams, ml) but accept any input format.
- meal: infer from context or time cues. If the user says "for breakfast" → "breakfast". If ambiguous → null.
- date: if mentioned (today, yesterday, a weekday, or explicit date), convert to YYYY-MM-DD using today's date as reference. Otherwise null.
- notes: capture anything that doesn't fit the structured fields (e.g. "at the café", "homemade").
- Round all nutrition numbers to integers.
- Be conservative with estimates — prefer underestimating slightly rather than overestimating.
- If you truly cannot identify a food item, include it with name "Unknown" and zero nutrition.`,
      messages: [{ role: "user", content }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Strip markdown code fences if present
    const jsonStr = text
      .replace(/```(?:json)?\s*/g, "")
      .replace(/```/g, "")
      .trim();
    const result = JSON.parse(jsonStr);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Parse failed.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
