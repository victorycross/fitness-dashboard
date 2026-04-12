import { createClient } from "npm:@supabase/supabase-js@^2";

const appUrl = "https://fitness.brightpathtechnology.io";

function page(title: string, body: string, accent = "#C8FF00") {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — Dave's Fitness</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0e0e0e;color:#fff;font-family:Georgia,serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px}
    .card{max-width:440px;width:100%;text-align:center}
    .label{color:${accent};font-family:Arial,sans-serif;font-size:10px;letter-spacing:4px;text-transform:uppercase;margin-bottom:14px}
    h1{font-family:Arial,sans-serif;font-size:30px;font-weight:900;color:#fff;line-height:1.15;margin-bottom:18px}
    p{color:rgba(255,255,255,0.5);font-size:14px;line-height:1.8;margin-bottom:28px}
    a.btn{display:inline-block;background:${accent};color:#0e0e0e;text-decoration:none;padding:11px 26px;font-family:Arial,sans-serif;font-weight:700;font-size:11px;letter-spacing:2px;text-transform:uppercase;border-radius:2px}
  </style>
</head>
<body>
  <div class="card">
    <div class="label">Dave's Fitness</div>
    <h1>${title}</h1>
    <p>${body}</p>
    <a href="${appUrl}" class="btn">Back to Dashboard</a>
  </div>
</body>
</html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

Deno.serve(async (req) => {
  const url   = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return page("Invalid link", "This unsubscribe link is missing a token. Please turn off reminders from the Profile tab in the app instead.", "#f87171");
  }

  let userId: string;
  try {
    userId = atob(token);
    // Basic UUID validation
    if (!/^[0-9a-f-]{36}$/.test(userId)) throw new Error("bad format");
  } catch {
    return page("Invalid link", "This unsubscribe link is invalid or has expired. Please turn off reminders from the Profile tab in the app instead.", "#f87171");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("APP_SERVICE_ROLE_KEY")!
  );

  const { error } = await supabase
    .from("profiles")
    .update({ notifications_enabled: false })
    .eq("id", userId);

  if (error) {
    console.error("Unsubscribe error:", error);
    return page(
      "Something went wrong",
      "We couldn't update your preferences right now. Please open the app → Profile → toggle off <em>Workout &amp; weight reminders</em> instead.",
      "#f87171"
    );
  }

  return page(
    "You're unsubscribed",
    "Workout &amp; weight reminders have been turned off for your account. You can re-enable them anytime from the Profile tab in the app."
  );
});
