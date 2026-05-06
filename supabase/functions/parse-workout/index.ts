import Anthropic from "npm:@anthropic-ai/sdk@^0.39.0";
import { createClient } from "npm:@supabase/supabase-js@^2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const { description, image_base64, image_media_type, today } = await req.json();

    if (!description && !image_base64) {
      return new Response(JSON.stringify({ error: "Provide a description or image." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = new Anthropic();

    const content: Anthropic.MessageParam["content"] = [];

    if (image_base64) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: (image_media_type || "image/jpeg") as Anthropic.Base64ImageSource["media_type"],
          data: image_base64,
        },
      });
    }

    content.push({
      type: "text",
      text: (today ? `Today's date is ${today}.\n\n` : "") + (description || "Extract all exercises from this image."),
    });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: `You are a fitness log parser. Extract workout exercises from the user's text or image.
Return ONLY valid JSON — no markdown, no explanation:
{
  "exercises": [
    { "name": "Exercise Name", "reps": "10", "weight": "100kg" }
  ],
  "date": "YYYY-MM-DD or null",
  "location": "location string or null"
}
CRITICAL RULES — read carefully:
- Create ONE entry per individual set, not one entry per exercise.
  Example: "bench press 3x10 at 100kg" → 3 entries, each with reps "10" and weight "100kg"
  Example: "squats 4 sets: 10/8/8/6 at 80kg" → 4 entries with reps "10","8","8","6"
- reps is a numeric string ("10")
- weight is a free string ("100kg", "45lbs", "bodyweight", "")
- If weight varies per set, use the actual weight for that set
- If no weight mentioned, use ""
- date: if a date is mentioned (today, yesterday, a weekday, or explicit date), convert to YYYY-MM-DD using today's date as reference. Otherwise null.
- location: extract if mentioned, otherwise null
- Extract ALL exercises and ALL sets`,
      messages: [{ role: "user", content }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    // Strip markdown code fences if present
    const jsonStr = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(jsonStr);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Parse failed." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
