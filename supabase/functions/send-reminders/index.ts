import { createClient } from "npm:@supabase/supabase-js@^2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Validate cron secret so only the scheduled job can trigger this
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("APP_SERVICE_ROLE_KEY")!;
  const resendApiKey   = Deno.env.get("RESEND_API_KEY")!;
  const fromEmail      = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
  const appUrl         = "https://fitness.brightpathtechnology.io";
  const fnBase         = `${supabaseUrl}/functions/v1`;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Only notify users who completed onboarding and have notifications on
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, notifications_enabled, onboarding_complete")
    .eq("notifications_enabled", true)
    .eq("onboarding_complete", true);

  if (!profiles?.length) {
    return new Response(JSON.stringify({ sent: 0, reason: "no eligible users" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = new Date();
  const threeDaysAgo = new Date(now); threeDaysAgo.setDate(now.getDate() - 3);
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);
  const threeStr = threeDaysAgo.toISOString().split("T")[0];
  const sevenStr = sevenDaysAgo.toISOString().split("T")[0];

  let sent = 0;

  for (const profile of profiles) {
    // Look up email via admin API
    const { data: { user } } = await supabase.auth.admin.getUserById(profile.id);
    if (!user?.email) continue;

    const [{ data: lastSession }, { data: lastWeight }] = await Promise.all([
      supabase.from("workout_sessions").select("date").eq("user_id", profile.id)
        .order("date", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("weight_log").select("date").eq("user_id", profile.id)
        .order("date", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const workoutDue = !lastSession || lastSession.date < threeStr;
    const weightDue  = !lastWeight  || lastWeight.date  < sevenStr;
    if (!workoutDue && !weightDue) continue;

    const name = profile.name?.split(" ")[0] || "there";
    const unsubToken = btoa(profile.id);
    const unsubUrl   = `${fnBase}/unsubscribe?token=${unsubToken}`;

    function daysSince(dateStr: string | null) {
      if (!dateStr) return null;
      return Math.floor((now.getTime() - new Date(dateStr + "T12:00:00Z").getTime()) / 86400000);
    }

    const items: string[] = [];
    if (workoutDue) {
      const d = daysSince(lastSession?.date ?? null);
      items.push(`<li style="margin-bottom:8px;">💪 <strong>Workout</strong> — ${d != null ? `last logged ${d} day${d !== 1 ? "s" : ""} ago` : "no sessions logged yet"}</li>`);
    }
    if (weightDue) {
      const d = daysSince(lastWeight?.date ?? null);
      items.push(`<li style="margin-bottom:8px;">⚖️ <strong>Weight</strong> — ${d != null ? `last logged ${d} day${d !== 1 ? "s" : ""} ago` : "no weight entry yet"}</li>`);
    }

    const subject = items.length === 2
      ? "Training reminder — workout & weight check-in"
      : workoutDue ? "Training reminder — time to log a workout" : "Training reminder — log your weight";

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Training Reminder</title></head>
<body style="margin:0;padding:0;background:#0e0e0e;color:#ffffff;font-family:Georgia,serif;">
  <div style="max-width:540px;margin:0 auto;padding:48px 32px;">
    <div style="color:#C8FF00;font-family:Arial,sans-serif;font-size:10px;letter-spacing:4px;text-transform:uppercase;margin-bottom:10px;">BrightPath Fitness</div>
    <h1 style="font-family:Arial,sans-serif;font-size:30px;font-weight:900;color:#ffffff;margin:0 0 28px;line-height:1.15;">Hey ${name} 👋</h1>

    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:30px 32px;margin-bottom:28px;">
      <p style="color:rgba(255,255,255,0.65);font-size:15px;line-height:1.75;margin:0 0 18px;">Just a nudge — you have some tracking to catch up on:</p>
      <ul style="color:rgba(255,255,255,0.8);font-size:15px;line-height:1.75;margin:0 0 28px;padding-left:18px;">${items.join("")}</ul>
      <a href="${appUrl}" style="display:inline-block;background:#C8FF00;color:#0e0e0e;text-decoration:none;padding:13px 30px;font-family:Arial,sans-serif;font-weight:700;font-size:12px;letter-spacing:2px;text-transform:uppercase;border-radius:2px;">Open Dashboard →</a>
    </div>

    <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:20px;">
      <p style="color:rgba(255,255,255,0.25);font-size:12px;line-height:1.8;margin:0;">
        You're receiving this because <strong style="color:rgba(255,255,255,0.4);">Workout &amp; weight reminders</strong> is enabled in your fitness dashboard.<br><br>
        <strong>To stop these emails, you have two options:</strong><br>
        • <a href="${unsubUrl}" style="color:#C8FF00;text-decoration:underline;">Click here to unsubscribe instantly</a> — no login required.<br>
        • Or open the app → <strong>Profile</strong> tab → toggle off <em>Workout &amp; weight reminders</em>.
      </p>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromEmail, to: user.email, subject, html }),
    });

    if (res.ok) sent++;
    else console.error(`Resend error for ${user.email}:`, await res.text());
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
