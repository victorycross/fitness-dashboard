import { useState, useEffect, useCallback } from "react";
import { LineChart, BarChart, Bar, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { supabase } from "./supabase.js";
import FoodTab from "./FoodTab.jsx";
import DashboardTab from "./DashboardTab.jsx";
import { localDateStr } from "./utils/date.js";
import { formatWeight } from "./utils/units.js";
import { HeightInput, WeightInput } from "./components/MeasureInputs.jsx";

// ─── Constants ──────────────────────────────────────────────────────────────
const EMPTY_EXERCISE = { name: "", sets: "", reps: "", weight: "" };

// ─── Password strength ───────────────────────────────────────────────────────
function getStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { label: "Too short", color: "#f87171" },
    { label: "Weak",      color: "#f87171" },
    { label: "Fair",      color: "#facc15" },
    { label: "Strong",    color: "#4ade80" },
    { label: "Very strong", color: "#C8FF00" },
  ];
  return { score, ...levels[score] };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const calcBMI = (kg, h) => (kg / (h * h)).toFixed(1);
function bmiCategory(b) {
  if (b < 18.5) return { label: "Underweight", color: "#60a5fa" };
  if (b < 25)   return { label: "Normal",      color: "#C8FF00" };
  if (b < 30)   return { label: "Overweight",  color: "#facc15" };
  return               { label: "Obese",        color: "#f87171" };
}
function formatDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
function shortDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}
function bmiLeft(b) { return `${Math.min(98, Math.max(2, ((b - 16) / (45 - 16)) * 100))}%`; }

// ─── Calorie estimation ───────────────────────────────────────────────────────
const COMPOUND_KEYWORDS = /bench|squat|deadlift|press|row|pull.?up|chin.?up|dip|lunge|clean|snatch|thrust|hip hinge/i;
function estimateCalories(exercises, bodyweightKg) {
  const bw = bodyweightKg || 80;
  return Math.round(exercises.reduce((total, ex) => {
    const sets  = Math.max(1, parseInt(ex.sets) || 1);
    const isCompound = COMPOUND_KEYWORDS.test(ex.name || "");
    // kcal/set = MET-based estimate scaled to bodyweight
    // Compound: ~7 kcal/set @ 70kg; Isolation: ~4 kcal/set @ 70kg
    const kcalPerSet = (isCompound ? 7 : 4) * (bw / 70);
    return total + sets * kcalPerSet;
  }, 0));
}

// ─── Weekly sessions chart helper ────────────────────────────────────────────
function getLast8Weeks(sessions) {
  const result = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const ref = new Date(now);
    ref.setDate(now.getDate() - i * 7);
    const dow = ref.getDay();
    const mon = new Date(ref);
    mon.setDate(ref.getDate() - (dow === 0 ? 6 : dow - 1));
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const monStr = localDateStr(mon);
    const sunStr = localDateStr(sun);
    const count = sessions.filter(s => s.date >= monStr && s.date <= sunStr).length;
    result.push({ week: shortDate(monStr), count });
  }
  return result;
}

// ─── Confirm Email Screen ─────────────────────────────────────────────────────
function ConfirmEmailScreen({ email, onSignOut }) {
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);

  async function resend() {
    setResending(true);
    await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    setSent(true);
    setTimeout(() => setSent(false), 5000);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0e0e0e", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        <div style={{ color: "#C8FF00", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 4, textTransform: "uppercase", marginBottom: 12 }}>One more step</div>
        <h1 style={{ margin: "0 0 20px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 38, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>
          Confirm your <span style={{ color: "#C8FF00" }}>email</span>
        </h1>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, padding: "32px 36px" }}>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 1.8, margin: "0 0 8px" }}>
            We sent a confirmation link to
          </p>
          <p style={{ color: "#fff", fontSize: 15, fontWeight: "bold", margin: "0 0 24px" }}>{email}</p>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.7, margin: "0 0 28px" }}>
            Click the link in that email to verify your account. Once confirmed you'll be taken straight into account setup — this page will update automatically.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
            <button onClick={resend} disabled={resending || sent}
              style={{ background: sent ? "transparent" : "#C8FF00", color: sent ? "#C8FF00" : "#0e0e0e", border: sent ? "1px solid rgba(200,255,0,0.4)" : "none", borderRadius: 2, padding: "11px 28px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2, textTransform: "uppercase", cursor: resending || sent ? "default" : "pointer", opacity: resending ? 0.7 : 1, width: "100%" }}>
              {resending ? "Sending…" : sent ? "Confirmation sent ✓" : "Resend confirmation email"}
            </button>
            <button onClick={onSignOut}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", fontSize: 12, cursor: "pointer", marginTop: 4 }}>
              Use a different email — sign out
            </button>
          </div>
        </div>
        <div style={{ marginTop: 16, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
          Check your spam folder if you don't see it within a minute.
        </div>
      </div>
    </div>
  );
}

// ─── Onboarding Wizard ────────────────────────────────────────────────────────
function OnboardingWizard({ user, onComplete, units }) {
  const TOTAL = 5;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    name: "", locations: [], locInputType: null, locInput: "",
    hasTrainer: false, trainer_name: "", trainer_email: "",
    height_cm: "", initial_weight: "", initial_body_fat: "", target_bmi: "24.9",
    weekly_sessions_target: 3, weekly_cal_target: 1500,
    short_term_goal: "", long_term_goal: "",
  });

  const set = (k, v) => setData(d => ({ ...d, [k]: v }));

  function addLocation(type, label) {
    setData(d => ({ ...d, locations: [...d.locations, { type, label }], locInput: "", locInputType: null }));
  }
  function removeLocation(i) {
    setData(d => ({ ...d, locations: d.locations.filter((_, idx) => idx !== i) }));
  }

  async function finish() {
    setSaving(true);
    const profileData = {
      id: user.id,
      name: data.name.trim(),
      height_cm: data.height_cm || null,
      target_bmi: data.target_bmi || "24.9",
      workout_locations: data.locations,
      trainer_name: data.hasTrainer && data.trainer_name ? data.trainer_name : null,
      trainer_email: data.hasTrainer && data.trainer_email ? data.trainer_email : null,
      weekly_sessions_target: parseInt(data.weekly_sessions_target) || 3,
      weekly_cal_target: parseInt(data.weekly_cal_target) || 1500,
      short_term_goal: data.short_term_goal.trim() || null,
      long_term_goal: data.long_term_goal.trim() || null,
      onboarding_complete: true,
      notifications_enabled: true,
      updated_at: new Date().toISOString(),
    };
    await supabase.from("profiles").upsert(profileData);
    if (data.initial_weight) {
      const kg = parseFloat(data.initial_weight);
      if (!isNaN(kg)) {
        await supabase.from("weight_log").upsert({
          user_id: user.id, date: localDateStr(), kg,
          body_fat_pct: parseFloat(data.initial_body_fat) || null,
        }, { onConflict: "date,user_id" });
      }
    }
    onComplete(profileData);
  }

  const inp = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 2, color: "#fff", padding: "10px 14px", fontSize: 14, fontFamily: "Georgia, serif", width: "100%", boxSizing: "border-box" };
  const canNext = [
    data.name.trim().length > 0,
    data.locations.length > 0,
    true, true, true,
  ][step - 1];

  return (
    <div style={{ minHeight: "100vh", background: "#0e0e0e", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ color: "#C8FF00", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 4, textTransform: "uppercase", marginBottom: 6 }}>Setup</div>
        <h1 style={{ margin: "0 0 24px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 900, color: "#fff" }}>
          Let's set up your <span style={{ color: "#C8FF00" }}>profile</span>
        </h1>
        <div style={{ display: "flex", gap: 4, marginBottom: 32 }}>
          {Array.from({ length: TOTAL }, (_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < step ? "#C8FF00" : "rgba(255,255,255,0.1)", transition: "background 0.3s" }} />
          ))}
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, padding: 36 }}>

          {step === 1 && (
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: "#C8FF00", marginBottom: 4 }}>What's your name?</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 24 }}>This is how we'll address you in the app.</div>
              <input autoFocus style={inp} placeholder="Your full name" value={data.name}
                onChange={e => set("name", e.target.value)}
                onKeyDown={e => e.key === "Enter" && canNext && setStep(2)} />
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: "#C8FF00", marginBottom: 4 }}>Where do you work out?</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 20 }}>Add all the places you train. You can change these later.</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                <button onClick={() => { if (!data.locations.find(l => l.type === "home")) addLocation("home", "Home"); }}
                  style={{ background: data.locations.find(l => l.type === "home") ? "rgba(200,255,0,0.15)" : "rgba(255,255,255,0.05)", border: "1px solid rgba(200,255,0,0.3)", borderRadius: 2, color: "#C8FF00", padding: "8px 16px", fontSize: 13, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>
                  + Home
                </button>
                {["gym", "outdoors", "other"].map(type => (
                  <button key={type} onClick={() => set("locInputType", data.locInputType === type ? null : type)}
                    style={{ background: data.locInputType === type ? "rgba(200,255,0,0.1)" : "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 2, color: "rgba(255,255,255,0.7)", padding: "8px 16px", fontSize: 13, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1, textTransform: "capitalize" }}>
                    + {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
              {data.locInputType && (
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <input autoFocus style={{ ...inp, flex: 1 }}
                    placeholder={data.locInputType === "gym" ? "Gym name (e.g. Planet Fitness)" : data.locInputType === "outdoors" ? "Location (e.g. Riverdale Park)" : "Location name"}
                    value={data.locInput}
                    onChange={e => set("locInput", e.target.value)}
                    onKeyDown={e => e.key === "Enter" && data.locInput.trim() && addLocation(data.locInputType, data.locInput.trim())} />
                  <button onClick={() => data.locInput.trim() && addLocation(data.locInputType, data.locInput.trim())}
                    disabled={!data.locInput.trim()}
                    style={{ background: "#C8FF00", color: "#0e0e0e", border: "none", borderRadius: 2, padding: "10px 18px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: data.locInput.trim() ? 1 : 0.4 }}>
                    Add
                  </button>
                </div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, minHeight: 32 }}>
                {data.locations.map((loc, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(200,255,0,0.08)", border: "1px solid rgba(200,255,0,0.2)", borderRadius: 2, padding: "5px 10px" }}>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", letterSpacing: 1 }}>{loc.type}</span>
                    <span style={{ fontSize: 13, color: "#fff" }}>{loc.label}</span>
                    <button onClick={() => removeLocation(i)} style={{ background: "none", border: "none", color: "rgba(255,80,80,0.5)", cursor: "pointer", fontSize: 14, padding: 0, marginLeft: 2, lineHeight: 1 }}>×</button>
                  </div>
                ))}
                {data.locations.length === 0 && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>Add at least one location to continue.</div>}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: "#C8FF00", marginBottom: 4 }}>Your measurements</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 24 }}>Used to calculate BMI and track progress. All fields optional.</div>
              <div className="stack-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Height {units === "imperial" ? "(ft / in)" : "(cm)"}</label>
                  <HeightInput valueCm={data.height_cm} onChangeCm={(v) => set("height_cm", v)} units={units} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Current weight {units === "imperial" ? "(lb)" : "(kg)"}</label>
                  <WeightInput valueKg={data.initial_weight} onChangeKg={(v) => set("initial_weight", v)} units={units} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Body fat %</label>
                  <input type="number" step="0.1" style={inp} placeholder="e.g. 22.0" value={data.initial_body_fat} onChange={e => set("initial_body_fat", e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Target BMI</label>
                  <input type="number" step="0.1" style={inp} placeholder="24.9" value={data.target_bmi} onChange={e => set("target_bmi", e.target.value)} />
                  {data.height_cm && data.target_bmi && (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                      = {formatWeight(parseFloat(data.target_bmi) * (parseFloat(data.height_cm) / 100) ** 2)} target
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: "#C8FF00", marginBottom: 4 }}>Do you have a trainer?</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 24 }}>Optional — add their details if you work with a personal trainer.</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                <button onClick={() => set("hasTrainer", true)}
                  style={{ flex: 1, background: data.hasTrainer ? "#C8FF00" : "rgba(255,255,255,0.05)", border: "1px solid rgba(200,255,0,0.3)", borderRadius: 2, color: data.hasTrainer ? "#0e0e0e" : "rgba(255,255,255,0.6)", padding: 14, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 1, cursor: "pointer" }}>
                  Yes
                </button>
                <button onClick={() => set("hasTrainer", false)}
                  style={{ flex: 1, background: !data.hasTrainer ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 2, color: !data.hasTrainer ? "#fff" : "rgba(255,255,255,0.4)", padding: 14, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 1, cursor: "pointer" }}>
                  No trainer
                </button>
              </div>
              {data.hasTrainer && (
                <div style={{ display: "grid", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Trainer name</label>
                    <input autoFocus style={inp} placeholder="Trainer's name" value={data.trainer_name} onChange={e => set("trainer_name", e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Trainer email (optional)</label>
                    <input type="email" style={inp} placeholder="trainer@example.com" value={data.trainer_email} onChange={e => set("trainer_email", e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: "#C8FF00", marginBottom: 4 }}>Targets & goals</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 24 }}>Set your weekly targets and describe what you're working toward.</div>
              <div className="stack-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Sessions / week</label>
                  <input type="number" min="1" max="14" style={inp} value={data.weekly_sessions_target} onChange={e => set("weekly_sessions_target", parseInt(e.target.value) || 3)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Calories / week</label>
                  <input type="number" min="100" step="50" style={inp} value={data.weekly_cal_target} onChange={e => set("weekly_cal_target", parseInt(e.target.value) || 1500)} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Short-term goal</label>
                <textarea style={{ ...inp, minHeight: 70, resize: "vertical" }} placeholder="e.g. Lose 5 kg before August" value={data.short_term_goal} onChange={e => set("short_term_goal", e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Long-term goal</label>
                <textarea style={{ ...inp, minHeight: 70, resize: "vertical" }} placeholder="e.g. Complete a 5K run, reach a healthy BMI" value={data.long_term_goal} onChange={e => set("long_term_goal", e.target.value)} />
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 32 }}>
            <button onClick={() => step > 1 && setStep(s => s - 1)}
              style={{ background: "none", border: "none", color: step > 1 ? "rgba(255,255,255,0.4)" : "transparent", cursor: step > 1 ? "pointer" : "default", fontSize: 13, padding: 0 }}>
              ← Back
            </button>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 2 }}>{step} / {TOTAL}</div>
            {step < TOTAL ? (
              <button onClick={() => canNext && setStep(s => s + 1)} disabled={!canNext}
                style={{ background: "#C8FF00", color: "#0e0e0e", border: "none", borderRadius: 2, padding: "11px 28px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2, textTransform: "uppercase", cursor: canNext ? "pointer" : "default", opacity: canNext ? 1 : 0.4 }}>
                Next →
              </button>
            ) : (
              <button onClick={finish} disabled={saving}
                style={{ background: "#C8FF00", color: "#0e0e0e", border: "none", borderRadius: 2, padding: "11px 28px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2, textTransform: "uppercase", cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : "Start Training →"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Goals Tab ────────────────────────────────────────────────────────────────
function GoalsTab({ user, profile, weights, sessions, photos, onProfileUpdate, onPhotosChange }) {
  const [editing, setEditing] = useState(null); // "short" | "long"
  const [shortGoal, setShortGoal] = useState(profile?.short_term_goal || "");
  const [longGoal, setLongGoal]   = useState(profile?.long_term_goal  || "");
  const [saving, setSaving] = useState(false);

  // Photo state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadDate, setUploadDate] = useState(localDateStr());
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadIsBefore, setUploadIsBefore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  function handlePhotoFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setUploadFile(f);
    setUploadPreview(URL.createObjectURL(f));
  }

  async function uploadPhoto() {
    if (!uploadFile) return;
    setUploading(true);
    const ext = uploadFile.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("progress-photos").upload(path, uploadFile);
    if (upErr) { setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("progress-photos").getPublicUrl(path);
    await supabase.from("progress_photos").insert({
      user_id: user.id, photo_url: urlData.publicUrl,
      date: uploadDate, caption: uploadCaption.trim() || null, is_before: uploadIsBefore,
    });
    setShowUpload(false); setUploadFile(null); setUploadPreview(null);
    setUploadCaption(""); setUploadIsBefore(false);
    setUploading(false);
    onPhotosChange();
  }

  async function deletePhoto(photo) {
    const path = photo.photo_url.split("/progress-photos/")[1];
    if (path) await supabase.storage.from("progress-photos").remove([decodeURIComponent(path)]);
    await supabase.from("progress_photos").delete().eq("id", photo.id).eq("user_id", user.id);
    setLightbox(null);
    onPhotosChange();
  }

  const heightM  = profile?.height_cm ? parseFloat(profile.height_cm) / 100 : null;
  const targetBMI = profile?.target_bmi ? parseFloat(profile.target_bmi) : 24.9;
  const targetKg  = heightM ? parseFloat((targetBMI * heightM * heightM).toFixed(1)) : null;
  const sortedW   = [...weights].sort((a, b) => a.date > b.date ? 1 : -1);
  const latestKg  = sortedW[sortedW.length - 1]?.kg ?? null;
  const weeklyData = getLast8Weeks(sessions);
  const weekTarget = profile?.weekly_sessions_target || 3;

  async function saveGoal(type) {
    setSaving(true);
    const val = type === "short" ? shortGoal.trim() : longGoal.trim();
    const field = type === "short" ? "short_term_goal" : "long_term_goal";
    await supabase.from("profiles").update({ [field]: val || null }).eq("id", user.id);
    onProfileUpdate({ [field]: val || null });
    setEditing(null);
    setSaving(false);
  }

  const inp = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 2, color: "#fff", padding: "10px 14px", fontSize: 13, fontFamily: "Georgia, serif", width: "100%", boxSizing: "border-box" };

  function GoalCard({ type, label, value, editValue, _onEdit, _onSave, _onCancel }) { // eslint-disable-line no-unused-vars
    const isEditing = editing === type;
    return (
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, padding: "22px 24px", flex: 1, minWidth: 240 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: type === "short" ? "#C8FF00" : "#facc15" }}>{label}</div>
          {!isEditing && <button onClick={() => { setEditing(type); }} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 2, color: "rgba(255,255,255,0.35)", padding: "3px 10px", fontSize: 11, cursor: "pointer" }}>Edit</button>}
        </div>
        {isEditing ? (
          <>
            <textarea style={{ ...inp, minHeight: 80, resize: "vertical", marginBottom: 10 }} autoFocus value={editValue} onChange={e => type === "short" ? setShortGoal(e.target.value) : setLongGoal(e.target.value)} placeholder={type === "short" ? "e.g. Lose 5 kg before August" : "e.g. Complete a 5K run"} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => saveGoal(type)} disabled={saving} style={{ background: "#C8FF00", color: "#0e0e0e", border: "none", borderRadius: 2, padding: "7px 16px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: 1, cursor: "pointer" }}>Save</button>
              <button onClick={() => { setEditing(null); type === "short" ? setShortGoal(profile?.short_term_goal || "") : setLongGoal(profile?.long_term_goal || ""); }} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 2, color: "rgba(255,255,255,0.4)", padding: "7px 12px", fontSize: 12, cursor: "pointer" }}>Cancel</button>
            </div>
          </>
        ) : (
          value
            ? <div style={{ fontSize: 14, color: "#fff", lineHeight: 1.6 }}>{value}</div>
            : <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>No goal set — click Edit to add one.</div>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 32 }}>
      {/* Goal cards */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 40 }}>
        { /* eslint-disable-next-line react-hooks/static-components */ }
        <GoalCard type="short" label="Short-term goal" value={shortGoal || profile?.short_term_goal} editValue={shortGoal} />
        { /* eslint-disable-next-line react-hooks/static-components */ }
        <GoalCard type="long"  label="Long-term goal"  value={longGoal  || profile?.long_term_goal}  editValue={longGoal} />
      </div>

      {/* Weight progress */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, padding: "24px 28px", marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>Weight Progress</div>
            {targetKg && latestKg && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                {latestKg > targetKg
                  ? <><span style={{ color: "#facc15", fontWeight: "bold" }}>{formatWeight(latestKg - targetKg)}</span> to target of {formatWeight(targetKg)}</>
                  : latestKg < targetKg
                    ? <><span style={{ color: "#C8FF00", fontWeight: "bold" }}>Target reached</span> — {formatWeight(targetKg - latestKg)} under goal</>
                    : <span style={{ color: "#C8FF00", fontWeight: "bold" }}>Exactly at target!</span>
                }
              </div>
            )}
          </div>
          {targetKg && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>— — target {formatWeight(targetKg)}</div>}
        </div>
        {sortedW.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={sortedW.map(w => ({ date: shortDate(w.date), kg: w.kg }))}>
              <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif" }} axisLine={false} tickLine={false} />
              <YAxis domain={["auto", "auto"]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif" }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={({ active, payload }) => active && payload?.length ? <div style={{ background: "#1a1a1a", border: "1px solid rgba(200,255,0,0.3)", borderRadius: 2, padding: "8px 12px" }}><div style={{ color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700 }}>{payload[0].value} kg</div></div> : null} />
              {targetKg && <ReferenceLine y={targetKg} stroke="#facc15" strokeDasharray="5 4" strokeWidth={1.5} />}
              <Line type="monotone" dataKey="kg" stroke="#C8FF00" strokeWidth={2} dot={{ fill: "#C8FF00", r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: "#fff" }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.25)", fontSize: 13, fontStyle: "italic" }}>Log your first weight entry to see progress here.</div>
        )}
      </div>

      {/* Weekly sessions */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, padding: "24px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>Weekly Training — Last 8 Weeks</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Target: <span style={{ color: "#facc15", fontWeight: "bold" }}>{weekTarget} sessions/week</span></div>
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>— — target line</div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={weeklyData} barSize={22}>
            <XAxis dataKey="week" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif" }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif" }} axisLine={false} tickLine={false} width={28} />
            <Tooltip content={({ active, payload }) => active && payload?.length ? <div style={{ background: "#1a1a1a", border: "1px solid rgba(200,255,0,0.3)", borderRadius: 2, padding: "8px 12px" }}><div style={{ color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700 }}>{payload[0].value} session{payload[0].value !== 1 ? "s" : ""}</div></div> : null} />
            <ReferenceLine y={weekTarget} stroke="#facc15" strokeDasharray="5 4" strokeWidth={1.5} />
            <Bar dataKey="count" fill="#C8FF00" radius={[2, 2, 0, 0]} opacity={0.85}
              label={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Visual Progress — Photos */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>Visual Progress</div>
          <button onClick={() => { setShowUpload(true); setUploadDate(localDateStr()); }}
            style={{ background: "rgba(200,255,0,0.08)", border: "1px solid rgba(200,255,0,0.25)", borderRadius: 2, color: "#C8FF00", padding: "6px 14px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>
            + Add Photo
          </button>
        </div>

        {/* Upload form */}
        {showUpload && (
          <div style={{ background: "rgba(200,255,0,0.03)", border: "1px solid rgba(200,255,0,0.15)", borderRadius: 2, padding: 24, marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div style={{ flex: "0 0 auto" }}>
                <label style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 120, height: 120, border: "2px dashed rgba(255,255,255,0.15)", borderRadius: 2, cursor: "pointer", overflow: "hidden", background: "rgba(255,255,255,0.03)" }}>
                  {uploadPreview
                    ? <img src={uploadPreview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12 }}><div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>Choose photo</div>
                  }
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoFile} />
                </label>
              </div>
              <div style={{ flex: 1, minWidth: 200, display: "grid", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Date</label>
                  <input type="date" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 2, color: "#fff", padding: "8px 12px", fontSize: 13, fontFamily: "Georgia, serif", width: "100%" }}
                    value={uploadDate} onChange={e => setUploadDate(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Caption (optional)</label>
                  <input style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 2, color: "#fff", padding: "8px 12px", fontSize: 13, fontFamily: "Georgia, serif", width: "100%" }}
                    placeholder="e.g. Week 4 check-in" value={uploadCaption} onChange={e => setUploadCaption(e.target.value)} />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                  <div onClick={() => setUploadIsBefore(v => !v)} style={{ width: 36, height: 20, borderRadius: 10, background: uploadIsBefore ? "#C8FF00" : "rgba(255,255,255,0.1)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                    <div style={{ position: "absolute", top: 2, left: uploadIsBefore ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: uploadIsBefore ? "#0e0e0e" : "rgba(255,255,255,0.4)", transition: "left 0.2s" }} />
                  </div>
                  Mark as "Before" photo
                </label>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={uploadPhoto} disabled={!uploadFile || uploading}
                style={{ background: "#C8FF00", color: "#0e0e0e", border: "none", borderRadius: 2, padding: "10px 24px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", cursor: !uploadFile || uploading ? "default" : "pointer", opacity: !uploadFile || uploading ? 0.5 : 1 }}>
                {uploading ? "Uploading…" : "Save Photo"}
              </button>
              <button onClick={() => { setShowUpload(false); setUploadFile(null); setUploadPreview(null); setUploadCaption(""); setUploadIsBefore(false); }}
                style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 2, color: "rgba(255,255,255,0.4)", padding: "10px 18px", fontSize: 12, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Photo grid */}
        {photos.length === 0 && !showUpload ? (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 2, padding: "40px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📷</div>
            <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 13, fontStyle: "italic" }}>No photos yet — add your first to start tracking your visual progress.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
            {photos.map(photo => (
              <div key={photo.id} onClick={() => setLightbox(photo)}
                style={{ position: "relative", cursor: "pointer", borderRadius: 2, overflow: "hidden", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <img src={photo.photo_url} alt={photo.caption || photo.date}
                  style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                {photo.is_before && (
                  <div style={{ position: "absolute", top: 6, left: 6, background: "#C8FF00", color: "#0e0e0e", fontSize: 9, padding: "2px 7px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: 1, borderRadius: 1 }}>BEFORE</div>
                )}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent,rgba(0,0,0,0.75))", padding: "20px 8px 8px" }}>
                  <div style={{ color: "#fff", fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>{shortDate(photo.date)}</div>
                  {photo.caption && <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{photo.caption}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.93)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setLightbox(null)}>
          <div style={{ position: "relative", maxWidth: 680, width: "100%" }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightbox(null)}
              style={{ position: "absolute", top: -14, right: -14, width: 32, height: 32, borderRadius: "50%", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>×</button>
            <img src={lightbox.photo_url} alt={lightbox.caption || lightbox.date}
              style={{ width: "100%", maxHeight: "75vh", objectFit: "contain", borderRadius: 2, display: "block" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 14, flexWrap: "wrap", gap: 10 }}>
              <div>
                {lightbox.is_before && <div style={{ background: "#C8FF00", color: "#0e0e0e", fontSize: 9, padding: "2px 7px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: 1, display: "inline-block", marginBottom: 6, borderRadius: 1 }}>BEFORE</div>}
                <div style={{ color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, letterSpacing: 1 }}>{formatDate(lightbox.date)}</div>
                {lightbox.caption && <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 4 }}>{lightbox.caption}</div>}
              </div>
              <button onClick={() => deletePhoto(lightbox)}
                style={{ background: "none", border: "1px solid rgba(255,60,60,0.3)", borderRadius: 2, color: "rgba(255,80,80,0.6)", padding: "7px 16px", fontSize: 11, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", letterSpacing: 1 }}>
                Delete photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Privacy Policy Modal ─────────────────────────────────────────────────────
function PrivacyModal({ onClose }) {
  const section = (title) => (
    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: "#C8FF00", marginTop: 28, marginBottom: 8 }}>{title}</div>
  );
  const p = (text) => (
    <p style={{ margin: "0 0 10px", fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>{text}</p>
  );
  const li = (text) => (
    <li style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, marginBottom: 4 }}>{text}</li>
  );
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="privacy-modal-title" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}>
      <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 2, width: "100%", maxWidth: 680, padding: "40px 48px 48px", position: "relative" }}>
        <button onClick={onClose} aria-label="Close privacy policy" style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>

        <div style={{ color: "#C8FF00", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 4, textTransform: "uppercase", marginBottom: 8 }}>Legal</div>
        <h2 id="privacy-modal-title" style={{ margin: "0 0 4px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 900, color: "#fff" }}>Privacy Policy</h2>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>Effective date: April 12, 2026 · Last updated: April 12, 2026</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 4 }}>Applies to: fitness.brightpathtechnology.io</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>Operated by: David Martin, Ontario, Canada</div>

        {section("1. Overview")}
        {p('This Privacy Policy explains how BrightPath Fitness ("we", "us", or "our") collects, uses, stores, and protects your personal information. This application is operated by an individual in Ontario, Canada and is governed by Canada\'s Personal Information Protection and Electronic Documents Act (PIPEDA) and applicable Ontario privacy law.')}
        {p("By creating an account and using this application, you consent to the collection and use of your personal information as described in this policy.")}

        {section("2. Information We Collect")}
        {p("We collect only the information necessary to provide the fitness tracking service:")}
        <ul style={{ margin: "0 0 10px", paddingLeft: 20 }}>
          {li("Account information: email address and password (stored as a secure hash)")}
          {li("Profile information: full name, height (cm), target BMI, trainer name and email")}
          {li("Body metrics: weight entries (kg), body fat percentage, and dates of measurement")}
          {li("Workout data: session dates, locations, exercises, sets, reps, weights, and estimated calorie burn")}
          {li("Avatar image: an optional profile photo you choose to upload")}
          {li("Usage preferences: notification settings and weekly training targets")}
        </ul>
        {p("We do not collect device identifiers, location data, or any information beyond what you explicitly provide.")}

        {section("3. How We Use Your Information")}
        {p("Your information is used solely to:")}
        <ul style={{ margin: "0 0 10px", paddingLeft: 20 }}>
          {li("Display your personal fitness dashboard and progress over time")}
          {li("Calculate BMI, estimated calorie burn, and weekly progress against your targets")}
          {li("Parse workout descriptions using AI (Anthropic Claude) when you use the AI Parse feature — your text or image is sent to Anthropic's API for processing and is not retained by Anthropic beyond the immediate request")}
          {li("Send transactional emails (e.g., password reset) via Resend's SMTP service")}
        </ul>
        {p("We do not use your information for advertising, profiling, or any purpose beyond operating the service described above.")}

        {section("4. Data Storage and Third-Party Processors")}
        {p("Your data is stored using Supabase (database and file storage), a service operated by Supabase Inc. with infrastructure in the United States. By using this application, you acknowledge that your personal information may be transferred to and processed in the United States, a jurisdiction outside Canada. We rely on Supabase's contractual commitments to protect your data.")}
        {p("The following third-party sub-processors may handle your data:")}
        <ul style={{ margin: "0 0 10px", paddingLeft: 20 }}>
          {li("Supabase Inc. (US) — database, authentication, and file storage")}
          {li("Anthropic PBC (US) — AI-based workout parsing, when you choose to use that feature")}
          {li("Resend Inc. (US) — transactional email delivery (password resets only)")}
        </ul>
        {p("No personal information is sold, rented, or shared with any other third parties.")}

        {section("5. Data Retention")}
        {p("Your data is retained for as long as your account remains active. You may delete your account at any time from the Profile tab, which permanently removes all your personal information, workout records, and weight entries from our systems. Account deletion is immediate and irreversible.")}

        {section("6. Security")}
        {p("We implement reasonable technical safeguards including: encrypted data transmission (HTTPS/TLS), bcrypt password hashing, row-level security policies that restrict database access to your own records only, and token-based authentication. No method of transmission over the internet is completely secure; we cannot guarantee absolute security.")}

        {section("7. Your Rights Under PIPEDA")}
        {p("As an individual whose personal information we hold, you have the right to:")}
        <ul style={{ margin: "0 0 10px", paddingLeft: 20 }}>
          {li("Access the personal information we hold about you")}
          {li("Correct inaccurate information (via the Profile tab)")}
          {li("Withdraw consent and request deletion of your account and all associated data (via Profile → Delete Account)")}
          {li("Know what personal information has been collected and how it is used")}
          {li("File a complaint with the Office of the Privacy Commissioner of Canada (OPC) at priv.gc.ca")}
        </ul>

        {section("8. Cookies and Tracking")}
        {p("This application does not use tracking cookies, advertising pixels, or analytics services. Session tokens required for authentication are stored in browser memory and are not used for any purpose other than maintaining your login session.")}

        {section("9. Children's Privacy")}
        {p("This application is not directed to individuals under the age of 14. We do not knowingly collect personal information from children under 14. If you believe a minor has provided us with personal information, please contact us and we will delete it promptly.")}

        {section("10. Changes to This Policy")}
        {p("We may update this Privacy Policy from time to time. When we do, we will update the \"Last updated\" date above. Continued use of the application after changes constitutes acceptance of the updated policy.")}

        {section("11. Contact")}
        {p("For any privacy-related questions, to exercise your rights, or to submit a complaint, please contact:")}
        <p style={{ margin: "0 0 4px", fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>David Martin</p>
        <p style={{ margin: "0 0 4px", fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>Ontario, Canada</p>
        <p style={{ margin: "0", fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>Email: <a href="mailto:david@brightpathtechnology.io" style={{ color: "#C8FF00", textUnderlineOffset: 3 }}>david@brightpathtechnology.io</a></p>

        <div style={{ marginTop: 36, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.07)", fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
          This policy is governed by the laws of Ontario and Canada, including PIPEDA (S.C. 2000, c. 5). For complaints unresolved by contacting us directly, you may escalate to the Office of the Privacy Commissioner of Canada.
        </div>

        <button onClick={onClose} style={{ marginTop: 28, background: "#C8FF00", color: "#0e0e0e", border: "none", borderRadius: 2, padding: "11px 28px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>Close</button>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, padding: "20px 24px", minWidth: 120, flex: 1 }}>
      <div style={{ color: accent || "#C8FF00", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 40, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 6, fontStyle: "italic" }}>{sub}</div>}
    </div>
  );
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const kg = payload[0].value;
  return (
    <div style={{ background: "#1a1a1a", border: "1px solid rgba(200,255,0,0.3)", borderRadius: 2, padding: "10px 14px" }}>
      <div style={{ color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700 }}>{formatWeight(kg)}</div>
    </div>
  );
};

// ─── Auth Form (shared by full-screen + modal) ───────────────────────────────
function AuthForm({ onAuth, initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPrivacy, setShowPrivacy] = useState(false);

  const strength = getStrength(password);
  const inp = { background: "#111", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 2, color: "#fff", padding: "10px 14px", fontSize: 14, fontFamily: "Georgia, serif", width: "100%", boxSizing: "border-box" };

  async function handleSubmit() {
    setError(""); setMessage("");
    if (!email) { setError("Email required."); return; }
    if (mode === "reset") {
      setLoading(true);
      const { error: e } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: "https://fitness.brightpathtechnology.io" });
      setLoading(false);
      if (e) setError(e.message);
      else setMessage("Password reset link sent — check your email.");
      return;
    }
    if (!password) { setError("Password required."); return; }
    if (mode === "signup") {
      if (strength.score < 3) { setError("Password too weak — use 12+ chars with uppercase, number, and symbol."); return; }
      if (password !== confirmPw) { setError("Passwords don't match."); return; }
    }
    setLoading(true);
    if (mode === "login") {
      const { data, error: e } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (e) setError(e.message);
      else onAuth(data.user);
    } else {
      // Validate invite code before creating account
      if (!inviteCode.trim()) { setError("An invite code is required to create an account."); setLoading(false); return; }
      const { data: codeValid, error: codeErr } = await supabase.rpc("check_invite_code", { p_code: inviteCode.trim() });
      if (codeErr || !codeValid) {
        setError("Invalid invite code. Check your invite email or contact us at david@brightpathtechnology.io for access.");
        setLoading(false); return;
      }
      const { data, error: e } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (e) setError(e.message);
      else if (data.user?.identities?.length === 0) setError("An account with this email already exists.");
      else setMessage("Account created! Check your email to confirm — click the link and you'll be taken straight into setup.");
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: 400 }}>
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
      <div style={{ color: "#C8FF00", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 4, textTransform: "uppercase", marginBottom: 8 }}>BrightPath Fitness</div>
      <h1 style={{ margin: "0 0 8px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 42, fontWeight: 900, lineHeight: 1, color: "#fff" }}>
        BrightPath <span style={{ color: "#C8FF00" }}>Fitness</span>
      </h1>
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 32, fontStyle: "italic" }}>Track your training, weight, and goals.</div>

      <div style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 2, padding: 32 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#C8FF00", marginBottom: 24 }}>
          {mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Reset Password"}
        </div>

        {mode === "signup" && (
          <div role="note" style={{ marginBottom: 20, padding: "12px 16px", background: "rgba(200,255,0,0.07)", border: "1px solid rgba(200,255,0,0.25)", borderRadius: 2, fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.65 }}>
            BrightPath Fitness is currently in beta — available by invite only. If you received an invite, enter your invite code below to create your account.
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="auth-email" style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.65)", display: "block", marginBottom: 6 }}>
            Email <span aria-hidden="true" style={{ color: "#f87171" }}>*</span>
          </label>
          <input id="auth-email" type="email" aria-required="true" style={inp} value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="you@example.com" autoComplete="email" />
        </div>

        {mode !== "reset" && (
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="auth-password" style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.65)", display: "block", marginBottom: 6 }}>
              Password <span aria-hidden="true" style={{ color: "#f87171" }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
              <input id="auth-password" type={showPw ? "text" : "password"} aria-required="true" style={{ ...inp, paddingRight: 44 }} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder={mode === "signup" ? "12+ chars, uppercase, number, symbol" : "••••••••"} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
              <button type="button" onClick={() => setShowPw(v => !v)} aria-label={showPw ? "Hide password" : "Show password"} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 13, padding: 0 }}>{showPw ? "Hide" : "Show"}</button>
            </div>
            {mode === "signup" && password && (
              <div aria-live="polite" style={{ marginTop: 8 }}>
                <div style={{ display: "flex", gap: 4 }} role="meter" aria-label="Password strength" aria-valuenow={strength.score} aria-valuemin={0} aria-valuemax={4}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: strength.score >= i ? strength.color : "rgba(255,255,255,0.1)", transition: "background 0.2s" }} />
                  ))}
                </div>
                <div style={{ fontSize: 12, color: strength.color, marginTop: 4 }}>{strength.label}</div>
                {strength.score < 4 && (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
                    {!(/[A-Z]/.test(password)) && "Add uppercase · "}
                    {!(/[0-9]/.test(password)) && "Add number · "}
                    {!(/[^A-Za-z0-9]/.test(password)) && "Add symbol · "}
                    {password.length < 12 && `${12 - password.length} more chars`}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {mode === "signup" && (
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="auth-confirm-pw" style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.65)", display: "block", marginBottom: 6 }}>
              Confirm Password <span aria-hidden="true" style={{ color: "#f87171" }}>*</span>
            </label>
            <input id="auth-confirm-pw" type={showPw ? "text" : "password"} aria-required="true" style={{ ...inp, borderColor: confirmPw && confirmPw !== password ? "rgba(248,113,113,0.6)" : "rgba(255,255,255,0.12)" }} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
            {confirmPw && confirmPw !== password && <div role="alert" style={{ fontSize: 12, color: "#f87171", marginTop: 4 }}>Passwords don't match</div>}
          </div>
        )}

        {mode === "signup" && (
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="auth-invite-code" style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.65)", display: "block", marginBottom: 6 }}>
              Invite Code <span aria-hidden="true" style={{ color: "#f87171" }}>*</span>
            </label>
            <input id="auth-invite-code" type="text" aria-required="true" style={{ ...inp, textTransform: "uppercase", letterSpacing: 2 }} value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="BETA2026" autoComplete="off" />
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 5, lineHeight: 1.5 }}>Your code was included in your invite email. Need access? Email <a href="mailto:david@brightpathtechnology.io" style={{ color: "#C8FF00", textUnderlineOffset: 3 }}>david@brightpathtechnology.io</a></div>
          </div>
        )}

        {error && <div id="auth-error" role="alert" aria-live="assertive" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.4)", borderRadius: 2, padding: "10px 14px", fontSize: 13, color: "#f87171", marginBottom: 16 }}>{error}</div>}
        {message && <div role="status" aria-live="polite" style={{ background: "rgba(200,255,0,0.07)", border: "1px solid rgba(200,255,0,0.3)", borderRadius: 2, padding: "10px 14px", fontSize: 13, color: "#C8FF00", marginBottom: 16 }}>{message}</div>}

        <button type="button" onClick={handleSubmit} disabled={loading} style={{ width: "100%", background: "#C8FF00", color: "#0e0e0e", border: "none", borderRadius: 2, padding: "12px 24px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: 2, textTransform: "uppercase", cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Please wait…" : mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
        </button>

        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          {mode === "login" && <>
            <button type="button" onClick={() => { setMode("signup"); setError(""); setMessage(""); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.65)", fontSize: 13, cursor: "pointer" }}>Don't have an account? Sign up</button>
            <button type="button" onClick={() => { setMode("reset"); setError(""); setMessage(""); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.55)", fontSize: 12, cursor: "pointer" }}>Forgot password?</button>
          </>}
          {mode !== "login" && <button type="button" onClick={() => { setMode("login"); setError(""); setMessage(""); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.65)", fontSize: 13, cursor: "pointer" }}>Back to sign in</button>}
        </div>
      </div>

      <div style={{ marginTop: 20, textAlign: "center" }}>
        <button onClick={() => setShowPrivacy(true)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", fontSize: 11, cursor: "pointer", letterSpacing: 1 }}>Privacy Policy</button>
      </div>
    </div>
  );
}

// ─── Landing Page ─────────────────────────────────────────────────────────────
function LandingPage({ onAuth }) {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [showPrivacy, setShowPrivacy] = useState(false);

  function openLogin()  { setAuthMode("login");  setShowAuth(true); }
  function openSignup() { setAuthMode("signup"); setShowAuth(true); }

  const FEATURES = [
    { icon: "◈", title: "AI Workout Parser",       desc: "Describe your session in plain English or snap a photo of your notes. AI extracts every exercise, set, and rep instantly — no manual entry required." },
    { icon: "◎", title: "Custom Program Design",    desc: "Set your workout locations, weekly targets, trainer details, and short and long-term goals. Your program, built entirely around you — not a template." },
    { icon: "◉", title: "Weight & BMI Tracking",    desc: "Log weight and body fat percentage over time. Charts show your trajectory against your personalised target BMI, week over week." },
    { icon: "◷", title: "Weekly Targets",           desc: "Set session and calorie targets for the week. A live progress bar and 8-week history chart keep you accountable without the noise." },
    { icon: "◫", title: "Progress Photos",          desc: "Upload before and after photos with optional captions. Watch your transformation unfold in a private, chronological visual timeline." },
    { icon: "◌", title: "Smart Reminders",          desc: "Opt-in email nudges when your log falls behind — sent only when you need them. One-click unsubscribe from any email, always." },
  ];

  const PLANS = [
    { name: "Starter", price: "Free",    badge: "Active in beta",  active: true,  desc: "All core features: workout logging, weight tracking, AI parsing, goals, and progress photos." },
    { name: "Pro",     price: "$7 / mo", badge: "Coming soon",     active: false, desc: "Advanced analytics, calendar sync, and training history exports. Launching later this year." },
    { name: "Team",    price: "Custom",  badge: "Coming soon",     active: false, desc: "For coaches, gyms, and training groups. Shared dashboards and bulk management tools." },
  ];

  const btn      = { display: "inline-block", background: "#C8FF00", color: "#0e0e0e", border: "none", padding: "13px 32px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", borderRadius: 2 };
  const btnGhost = { ...btn, background: "transparent", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.2)" };

  return (
    <div style={{ background: "#0e0e0e", color: "#fff", minHeight: "100vh", fontFamily: "Georgia, serif" }}>
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}

      {/* Skip to main content (WCAG 2.4.1) */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Auth modal */}
      {showAuth && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowAuth(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, overflowY: "auto" }}
        >
          <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}>
            <button onClick={() => setShowAuth(false)} style={{ position: "absolute", top: -32, right: "calc(50% - 200px)", background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 12, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 2, textTransform: "uppercase" }}>
              × Close
            </button>
            <AuthForm onAuth={onAuth} initialMode={authMode} />
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "18px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 900, letterSpacing: 1, color: "#fff" }}>BrightPath <span style={{ color: "#C8FF00" }}>Fitness</span></span>
          <span style={{ background: "rgba(200,255,0,0.1)", border: "1px solid rgba(200,255,0,0.25)", borderRadius: 20, padding: "2px 10px", fontSize: 9, color: "#C8FF00", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 2, textTransform: "uppercase" }}>Beta</span>
        </div>
        <button onClick={openLogin} style={{ ...btnGhost, padding: "9px 22px", fontSize: 12 }}>Sign In</button>
      </nav>

      {/* Hero */}
      <main id="main-content">
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "96px 40px 80px", textAlign: "center" }}>
        <div style={{ display: "inline-block", background: "rgba(200,255,0,0.07)", border: "1px solid rgba(200,255,0,0.2)", borderRadius: 20, padding: "4px 16px", marginBottom: 28, fontSize: 11, color: "#C8FF00", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 3, textTransform: "uppercase" }}>
          Invite Only · Currently Free
        </div>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "clamp(52px, 9vw, 100px)", fontWeight: 900, lineHeight: 1.0, margin: "0 0 28px", color: "#fff", letterSpacing: -1 }}>
          Train smarter.<br /><span style={{ color: "#C8FF00" }}>Own your progress.</span>
        </h1>
        <p style={{ fontSize: 18, color: "rgba(255,255,255,0.5)", lineHeight: 1.85, maxWidth: 540, margin: "0 auto 48px" }}>
          A personal fitness dashboard built around your goals — log workouts with AI, track your weight, design your own program, and see real change over time.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={openSignup} style={{ ...btn, padding: "15px 40px", fontSize: 14 }}>Request Early Access</button>
          <button onClick={openLogin}  style={{ ...btnGhost, padding: "15px 40px", fontSize: 14 }}>Sign In →</button>
        </div>
        <div style={{ marginTop: 28, color: "rgba(255,255,255,0.55)", fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 2 }}>Invite-only beta · Ontario, Canada</div>
      </section>

      {/* Features */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "80px 40px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ color: "#C8FF00", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 4, textTransform: "uppercase", marginBottom: 12 }}>What's Inside</div>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 40, fontWeight: 900, margin: 0, color: "#fff" }}>Built for your goals, not ours</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 2 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", padding: "32px 28px" }}>
                <div style={{ color: "#C8FF00", fontSize: 26, marginBottom: 14, fontFamily: "monospace", lineHeight: 1 }}>{f.icon}</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: 0.5, marginBottom: 10, color: "#fff" }}>{f.title}</div>
                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 1.8 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Custom program callout */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "80px 40px", background: "rgba(200,255,0,0.015)" }}>
        <div style={{ maxWidth: 840, margin: "0 auto", textAlign: "center" }}>
          <div style={{ color: "#C8FF00", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 4, textTransform: "uppercase", marginBottom: 16 }}>Design Your Program</div>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 40, fontWeight: 900, margin: "0 0 24px", color: "#fff", lineHeight: 1.1 }}>No cookie-cutter plans. Just yours.</h2>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 16, lineHeight: 1.9, marginBottom: 44, maxWidth: 620, margin: "0 auto 44px" }}>
            Set where you train, how often you want to work out, who your trainer is, and what you're working toward — both this month and this year. Every chart and reminder adapts to the targets <em>you</em> set.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, textAlign: "left" }}>
            {["Workout locations & gym names", "Weekly session & calorie targets", "Trainer name & contact", "Short and long-term objectives", "BMI and body composition goals", "Progress photo milestones"].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: "#C8FF00", fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, lineHeight: 1.65 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "80px 40px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 60, alignItems: "center" }}>
          <div>
            <div style={{ color: "#C8FF00", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 4, textTransform: "uppercase", marginBottom: 16 }}>Your Privacy</div>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 900, margin: "0 0 20px", color: "#fff", lineHeight: 1.15 }}>Your data belongs to you. Full stop.</h2>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 15, lineHeight: 1.85, marginBottom: 28 }}>
              We collect only what you enter. We use that data for one purpose: helping you track your progress. No ads. No selling. No exceptions.
            </p>
            <button onClick={() => setShowPrivacy(true)} style={{ background: "none", border: "1px solid rgba(200,255,0,0.3)", borderRadius: 2, color: "#C8FF00", padding: "9px 20px", fontSize: 11, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 2, textTransform: "uppercase" }}>Read Privacy Policy</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[
              { icon: "◈", title: "No ads, ever",              desc: "We don't sell your data or run advertising. Your workouts are not a product." },
              { icon: "◎", title: "No third-party sharing",    desc: "Your personal information is never sold, rented, or shared with outside parties." },
              { icon: "◉", title: "PIPEDA compliant",          desc: "Collected and stored in compliance with Canada's federal privacy law for personal data." },
              { icon: "◌", title: "Delete anytime",            desc: "Permanently delete your account and all data at any time — no waiting, no questions." },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ color: "#C8FF00", fontSize: 18, flexShrink: 0, marginTop: 2, fontFamily: "monospace" }}>{item.icon}</div>
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, marginBottom: 3, color: "#fff" }}>{item.title}</div>
                  <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 1.7 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "80px 40px", background: "rgba(255,255,255,0.01)" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ color: "#C8FF00", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 4, textTransform: "uppercase", marginBottom: 12 }}>Pricing</div>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 40, fontWeight: 900, margin: "0 0 12px", color: "#fff" }}>Simple plans, no surprises</h2>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, fontStyle: "italic" }}>All features are free during the beta period.</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 2 }}>
            {PLANS.map((plan, i) => (
              <div key={i} style={{ background: plan.active ? "rgba(200,255,0,0.035)" : "rgba(255,255,255,0.02)", border: `1px solid ${plan.active ? "rgba(200,255,0,0.2)" : "rgba(255,255,255,0.06)"}`, padding: "36px 28px", position: "relative" }}>
                <div style={{ position: "absolute", top: 16, right: 16, background: plan.active ? "rgba(200,255,0,0.1)" : "rgba(255,255,255,0.05)", border: `1px solid ${plan.active ? "rgba(200,255,0,0.25)" : "rgba(255,255,255,0.08)"}`, borderRadius: 20, padding: "2px 10px", fontSize: 9, color: plan.active ? "#C8FF00" : "rgba(255,255,255,0.25)", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 2, textTransform: "uppercase" }}>{plan.badge}</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 900, letterSpacing: 1, marginBottom: 6, color: "#fff" }}>{plan.name}</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 34, fontWeight: 700, color: plan.active ? "#C8FF00" : "rgba(255,255,255,0.2)", marginBottom: 16 }}>{plan.price}</div>
                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 1.75, marginBottom: 28 }}>{plan.desc}</div>
                <button onClick={plan.active ? openSignup : undefined} disabled={!plan.active} style={{ ...btn, width: "100%", textAlign: "center", opacity: plan.active ? 1 : 0.25, cursor: plan.active ? "pointer" : "default" }}>
                  {plan.active ? "Get Started" : "Coming Soon"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Invite / CTA */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "80px 40px", textAlign: "center" }}>
        <div style={{ maxWidth: 580, margin: "0 auto" }}>
          <div style={{ color: "#C8FF00", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 4, textTransform: "uppercase", marginBottom: 16 }}>Beta Access</div>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 42, fontWeight: 900, margin: "0 0 20px", color: "#fff", lineHeight: 1.05 }}>Got an invite?</h2>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 16, lineHeight: 1.85, marginBottom: 40 }}>
            BrightPath Fitness is currently in closed beta. If a member has invited you, create your account below — it takes under a minute. Members can send invites directly from their Profile tab.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={openSignup} style={{ ...btn,      padding: "15px 40px", fontSize: 14 }}>Create Account</button>
            <button onClick={openLogin}  style={{ ...btnGhost, padding: "15px 40px", fontSize: 14 }}>Sign In →</button>
          </div>
        </div>
      </section>

      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "32px 40px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 24 }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 1, color: "#fff", marginBottom: 6 }}>BrightPath Fitness</div>
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, lineHeight: 1.7 }}>© {new Date().getFullYear()} · Ontario, Canada</div>
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, lineHeight: 1.7, marginTop: 2 }}>
              Committed to AODA / WCAG 2.0 Level AA accessibility.
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 180 }}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 4 }}>Support</div>
            <a href="mailto:david@brightpathtechnology.io" style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, textDecoration: "none" }}>david@brightpathtechnology.io</a>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif", marginTop: 8, marginBottom: 4 }}>Legal</div>
            <button onClick={() => setShowPrivacy(true)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 13, cursor: "pointer", textAlign: "left", padding: 0, textDecoration: "underline", textUnderlineOffset: 3 }}>Privacy Policy</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 4 }}>Account</div>
            <button onClick={openLogin}  style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 13, cursor: "pointer", textAlign: "left", padding: 0 }}>Sign In</button>
            <button onClick={openSignup} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 13, cursor: "pointer", textAlign: "left", padding: 0 }}>Create Account</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Auth Screen (full-page fallback) ─────────────────────────────────────────
function _AuthScreen({ onAuth }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0e0e0e", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <AuthForm onAuth={onAuth} />
    </div>
  );
}

// ─── Delegation Manager ───────────────────────────────────────────────────────
function DelegationManager({ user, profile }) {
  const [delegates, setDelegates]   = useState([]);
  const [newEmail, setNewEmail]     = useState("");
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState("");

  const inp = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 2, color: "#fff", padding: "8px 12px", fontSize: 13, fontFamily: "Georgia, serif", flex: 1 };

  useEffect(() => {
    supabase.from("delegations").select("id, delegate_email, delegate_user_id").eq("host_user_id", user.id)
      .then(({ data }) => setDelegates(data || []));
  }, [user.id]);

  async function addDelegate() {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    if (delegates.some(d => d.delegate_email === email)) {
      setMsg("Already added."); setTimeout(() => setMsg(""), 3000); return;
    }
    setSaving(true);
    const { error } = await supabase.from("delegations").insert({ host_user_id: user.id, delegate_email: email });
    if (error) { setMsg("Error: " + error.message); setSaving(false); setTimeout(() => setMsg(""), 4000); return; }
    // Send invite email
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-delegation-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
      body: JSON.stringify({ delegate_email: email, host_name: profile?.name || user.email.split("@")[0] }),
    }).catch(() => {});
    setDelegates(d => [...d, { delegate_email: email, delegate_user_id: null }]);
    setNewEmail("");
    setMsg("✓ Added and invite sent.");
    setTimeout(() => setMsg(""), 4000);
    setSaving(false);
  }

  async function removeDelegate(email) {
    await supabase.from("delegations").delete().eq("host_user_id", user.id).eq("delegate_email", email);
    setDelegates(d => d.filter(x => x.delegate_email !== email));
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input type="email" style={inp} placeholder="delegate@example.com" value={newEmail}
          onChange={e => setNewEmail(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addDelegate()} />
        <button onClick={addDelegate} disabled={saving || !newEmail}
          style={{ background: "#C8FF00", color: "#0e0e0e", border: "none", borderRadius: 2, padding: "8px 18px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", cursor: (saving || !newEmail) ? "default" : "pointer", opacity: (saving || !newEmail) ? 0.4 : 1, flexShrink: 0 }}>
          {saving ? "Adding…" : "Add"}
        </button>
      </div>
      {delegates.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
          {delegates.map(d => (
            <div key={d.delegate_email} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, padding: "8px 12px" }}>
              <div>
                <span style={{ fontSize: 13, color: "#fff" }}>{d.delegate_email}</span>
                <span style={{ marginLeft: 8, fontSize: 11, color: d.delegate_user_id ? "#C8FF00" : "rgba(255,255,255,0.3)", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>
                  {d.delegate_user_id ? "Active" : "Pending"}
                </span>
              </div>
              <button onClick={() => removeDelegate(d.delegate_email)}
                style={{ background: "none", border: "none", color: "rgba(255,80,80,0.5)", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>×</button>
            </div>
          ))}
        </div>
      )}
      {delegates.length === 0 && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>No delegates yet.</div>}
      {msg && <div style={{ fontSize: 12, color: msg.startsWith("✓") ? "#C8FF00" : "#f87171", marginTop: 6 }}>{msg}</div>}
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────
function ProfileTab({ user, profile, onSave, onSignOut, units, setUnits }) {
  const [form, setForm] = useState({
    name: profile?.name || "",
    height_cm: profile?.height_cm || "",
    target_bmi: profile?.target_bmi || "24.9",
    trainer_name: profile?.trainer_name || "",
    trainer_email: profile?.trainer_email || "",
    notifications_enabled: profile?.notifications_enabled ?? true,
    weekly_sessions_target: profile?.weekly_sessions_target ?? 3,
    weekly_cal_target: profile?.weekly_cal_target ?? 1500,
    short_term_goal: profile?.short_term_goal || "",
    long_term_goal: profile?.long_term_goal || "",
    food_export_emails: profile?.food_export_emails || [],
    food_export_daily: profile?.food_export_daily ?? false,
    food_export_weekly: profile?.food_export_weekly ?? false,
  });
  const [exportEmailInput, setExportEmailInput] = useState("");
  const [locations, setLocations] = useState(profile?.workout_locations || []);
  const [locInputType, setLocInputType] = useState(null);
  const [locInput, setLocInput] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [changePw, setChangePw] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const strength = getStrength(newPw);

  async function sendInvite() {
    if (!inviteEmail) return;
    setInviteSending(true); setInviteMsg("");
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch("https://ibiszdvdhffvrissciyj.supabase.co/functions/v1/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({ friend_email: inviteEmail, inviter_name: profile?.name }),
      });
      if (res.ok) { setInviteMsg("✓ Invite sent to " + inviteEmail); setInviteEmail(""); }
      else { const d = await res.json().catch(() => ({})); setInviteMsg(d.error || "Failed to send — try again."); }
    } catch { setInviteMsg("Network error — try again."); }
    setInviteSending(false);
  }

  function addLoc(type, label) {
    setLocations(ls => [...ls, { type, label }]);
    setLocInput(""); setLocInputType(null);
  }

  async function deleteAccount() {
    setDeleting(true);
    const { error: e } = await supabase.rpc("delete_current_user");
    if (e) { setMessage("Error: " + e.message); setDeleting(false); setDeleteConfirm(false); return; }
    onSignOut();
  }

  const inp = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 2, color: "#fff", padding: "8px 12px", fontSize: 13, fontFamily: "Georgia, serif", width: "100%", boxSizing: "border-box" };

  function handleAvatar(e) {
    const f = e.target.files[0];
    if (!f) return;
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
  }

  async function save() {
    setSaving(true); setMessage("");
    let avatar_url = profile?.avatar_url || null;

    if (avatarFile) {
      const ext = avatarFile.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });
      if (!upErr) {
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        avatar_url = data.publicUrl + "?t=" + Date.now();
      }
    }

    const upsertData = { id: user.id, ...form, workout_locations: locations, avatar_url, onboarding_complete: true, updated_at: new Date().toISOString() };
    const { error: e } = await supabase.from("profiles").upsert(upsertData);
    if (e) { setMessage("Error: " + e.message); setSaving(false); return; }

    if (changePw && newPw) {
      if (strength.score < 3) { setMessage("New password too weak."); setSaving(false); return; }
      if (newPw !== confirmPw) { setMessage("Passwords don't match."); setSaving(false); return; }
      const { error: pwErr } = await supabase.auth.updateUser({ password: newPw });
      if (pwErr) { setMessage("Password error: " + pwErr.message); setSaving(false); return; }
      setNewPw(""); setConfirmPw(""); setChangePw(false);
    }

    onSave({ ...form, workout_locations: locations, avatar_url, onboarding_complete: true });
    setMessage("Profile saved ✓");
    setSaving(false);
    setTimeout(() => setMessage(""), 3000);
  }

  const heightM = form.height_cm ? parseFloat(form.height_cm) / 100 : null;
  const targetKg = heightM && form.target_bmi ? (parseFloat(form.target_bmi) * heightM * heightM).toFixed(1) : null;

  return (
    <div style={{ marginTop: 32 }}>
      {/* Avatar + name */}
      <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 32 }}>
        <div style={{ position: "relative" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(200,255,0,0.1)", border: "2px solid rgba(200,255,0,0.3)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {avatarPreview
              ? <img src={avatarPreview} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ color: "#C8FF00", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 700 }}>{form.name ? form.name[0].toUpperCase() : "?"}</div>
            }
          </div>
          <label style={{ position: "absolute", bottom: 0, right: 0, background: "#C8FF00", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14 }}>
            ＋<input type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatar} />
          </label>
        </div>
        <div>
          <div style={{ color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700 }}>{form.name || "Your Name"}</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>{user.email}</div>
        </div>
      </div>

      <div className="stack-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Name */}
        <div style={{ gridColumn: "1/-1" }}>
          <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Full Name</label>
          <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your full name" />
        </div>
        {/* Height */}
        <div>
          <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Height {units === "imperial" ? "(ft / in)" : "(cm)"}</label>
          <HeightInput valueCm={form.height_cm} onChangeCm={(v) => setForm(f => ({ ...f, height_cm: v }))} units={units} style={inp} />
        </div>
        {/* Target BMI */}
        <div>
          <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Target BMI</label>
          <input type="number" step="0.1" style={inp} value={form.target_bmi} onChange={e => setForm(f => ({ ...f, target_bmi: e.target.value }))} placeholder="24.9" />
          {targetKg && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>= {formatWeight(targetKg)} target weight</div>}
        </div>
        {/* Trainer name */}
        <div>
          <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Trainer Name</label>
          <input style={inp} value={form.trainer_name} onChange={e => setForm(f => ({ ...f, trainer_name: e.target.value }))} placeholder="Trainer's name" />
        </div>
        {/* Trainer email */}
        <div>
          <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Trainer Email</label>
          <input type="email" style={inp} value={form.trainer_email} onChange={e => setForm(f => ({ ...f, trainer_email: e.target.value }))} placeholder="trainer@example.com" />
        </div>
        {/* Workout locations */}
        <div style={{ gridColumn: "1/-1", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16, marginTop: 4 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>Workout Locations</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <button onClick={() => { if (!locations.find(l => l.type === "home")) addLoc("home", "Home"); }}
              style={{ background: locations.find(l => l.type === "home") ? "rgba(200,255,0,0.12)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(200,255,0,0.25)", borderRadius: 2, color: "#C8FF00", padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>+ Home</button>
            {["gym", "outdoors", "other"].map(type => (
              <button key={type} onClick={() => setLocInputType(locInputType === type ? null : type)}
                style={{ background: locInputType === type ? "rgba(200,255,0,0.08)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 2, color: "rgba(255,255,255,0.6)", padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1, textTransform: "capitalize" }}>+ {type.charAt(0).toUpperCase() + type.slice(1)}</button>
            ))}
          </div>
          {locInputType && (
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input autoFocus style={{ ...inp, flex: 1, fontSize: 12 }}
                placeholder={locInputType === "gym" ? "Gym name" : locInputType === "outdoors" ? "Location name" : "Location name"}
                value={locInput}
                onChange={e => setLocInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && locInput.trim() && addLoc(locInputType, locInput.trim())} />
              <button onClick={() => locInput.trim() && addLoc(locInputType, locInput.trim())}
                style={{ background: "#C8FF00", color: "#0e0e0e", border: "none", borderRadius: 2, padding: "6px 14px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Add</button>
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {locations.map((loc, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(200,255,0,0.06)", border: "1px solid rgba(200,255,0,0.15)", borderRadius: 2, padding: "4px 8px" }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", letterSpacing: 1 }}>{loc.type}</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>{loc.label}</span>
                <button onClick={() => setLocations(ls => ls.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", color: "rgba(255,80,80,0.4)", cursor: "pointer", fontSize: 13, padding: 0, marginLeft: 2, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
        </div>
        {/* Weekly targets */}
        <div style={{ gridColumn: "1/-1", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16, marginTop: 4 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>Weekly Targets</div>
          <div className="stack-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Sessions / week</label>
              <input type="number" min="1" max="14" style={inp} value={form.weekly_sessions_target} onChange={e => setForm(f => ({ ...f, weekly_sessions_target: parseInt(e.target.value) || 3 }))} placeholder="3" />
            </div>
            <div>
              <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Calories / week</label>
              <input type="number" min="100" step="50" style={inp} value={form.weekly_cal_target} onChange={e => setForm(f => ({ ...f, weekly_cal_target: parseInt(e.target.value) || 1500 }))} placeholder="1500" />
            </div>
          </div>
        </div>
        {/* Goals */}
        <div style={{ gridColumn: "1/-1", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16, marginTop: 4 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>Goals</div>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Short-term goal</label>
              <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={form.short_term_goal} onChange={e => setForm(f => ({ ...f, short_term_goal: e.target.value }))} placeholder="e.g. Lose 5 kg before August" />
            </div>
            <div>
              <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Long-term goal</label>
              <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={form.long_term_goal} onChange={e => setForm(f => ({ ...f, long_term_goal: e.target.value }))} placeholder="e.g. Complete a 5K run, reach a healthy BMI" />
            </div>
          </div>
        </div>
        {/* Notifications */}
        <div style={{ gridColumn: "1/-1", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16, marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div onClick={() => setForm(f => ({ ...f, notifications_enabled: !f.notifications_enabled }))} style={{ width: 44, height: 24, borderRadius: 12, background: form.notifications_enabled ? "#C8FF00" : "rgba(255,255,255,0.1)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 3, left: form.notifications_enabled ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: form.notifications_enabled ? "#0e0e0e" : "rgba(255,255,255,0.4)", transition: "left 0.2s" }} />
            </div>
            <span style={{ fontSize: 13, color: form.notifications_enabled ? "#fff" : "rgba(255,255,255,0.4)" }}>Workout &amp; weight reminders</span>
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", lineHeight: 1.7, paddingLeft: 56 }}>
            {form.notifications_enabled
              ? <>Sends a daily email when you haven't logged a workout in 3 days or weight in 7 days. Every email includes a one-click unsubscribe link — or toggle this off and save to stop immediately.</>
              : <>Reminders are off. Toggle on to receive daily nudge emails when your workout or weight log falls behind.</>
            }
          </div>
        </div>
        {/* Measurement units */}
        <div style={{ gridColumn: "1/-1", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16, marginTop: 4 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>Measurement Units</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              onClick={() => setUnits(units === "metric" ? "imperial" : "metric")}
              style={{ width: 44, height: 24, borderRadius: 12, background: units === "imperial" ? "#C8FF00" : "rgba(255,255,255,0.1)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
            >
              <div style={{ position: "absolute", top: 3, left: units === "imperial" ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: units === "imperial" ? "#0e0e0e" : "rgba(255,255,255,0.4)", transition: "left 0.2s" }} />
            </div>
            <span style={{ fontSize: 13, color: "#fff" }}>
              {units === "imperial" ? "Imperial (lb, ft/in)" : "Metric (kg, cm)"}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 8, lineHeight: 1.7 }}>
            Controls the unit you enter values in. Weight and height are always stored and displayed with both units alongside.
          </div>
        </div>
        {/* Delegated access */}
        <div style={{ gridColumn: "1/-1", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16, marginTop: 4 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>Delegated Access</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: 14 }}>
            Grant someone read-only access to your dashboard. They'll see your workouts, weight, food log, and goals but cannot edit anything.
          </div>
          <DelegationManager user={user} profile={profile} />
        </div>
        {/* Food exports */}
        <div style={{ gridColumn: "1/-1", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16, marginTop: 4 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>Food Exports</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: 14 }}>
            Email a summary of your food log to one or more recipients. Daily runs each evening for today's entries; weekly runs Sunday night with the past 7 days.
          </div>

          {/* Email chips */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Recipient emails</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                type="email"
                style={{ ...inp, flex: 1 }}
                placeholder="coach@example.com"
                value={exportEmailInput}
                onChange={e => setExportEmailInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = exportEmailInput.trim();
                    if (v && !form.food_export_emails.includes(v)) {
                      setForm(f => ({ ...f, food_export_emails: [...f.food_export_emails, v] }));
                      setExportEmailInput("");
                    }
                  }
                }}
              />
              <button
                onClick={() => {
                  const v = exportEmailInput.trim();
                  if (v && !form.food_export_emails.includes(v)) {
                    setForm(f => ({ ...f, food_export_emails: [...f.food_export_emails, v] }));
                    setExportEmailInput("");
                  }
                }}
                style={{ background: "#C8FF00", color: "#0e0e0e", border: "none", borderRadius: 2, padding: "6px 14px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
              >Add</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {form.food_export_emails.map((email, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(200,255,0,0.06)", border: "1px solid rgba(200,255,0,0.15)", borderRadius: 2, padding: "4px 8px" }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>{email}</span>
                  <button
                    onClick={() => setForm(f => ({ ...f, food_export_emails: f.food_export_emails.filter((_, idx) => idx !== i) }))}
                    style={{ background: "none", border: "none", color: "rgba(255,80,80,0.5)", cursor: "pointer", fontSize: 13, padding: 0, marginLeft: 2, lineHeight: 1 }}
                  >×</button>
                </div>
              ))}
              {form.food_export_emails.length === 0 && (
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>No recipients yet.</span>
              )}
            </div>
          </div>

          {/* Daily / Weekly toggles */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: form.food_export_emails.length ? "pointer" : "not-allowed", opacity: form.food_export_emails.length ? 1 : 0.4 }}>
              <input
                type="checkbox"
                checked={form.food_export_daily}
                disabled={form.food_export_emails.length === 0}
                onChange={e => setForm(f => ({ ...f, food_export_daily: e.target.checked }))}
                style={{ accentColor: "#C8FF00", width: 16, height: 16 }}
              />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>Daily summary (each evening)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: form.food_export_emails.length ? "pointer" : "not-allowed", opacity: form.food_export_emails.length ? 1 : 0.4 }}>
              <input
                type="checkbox"
                checked={form.food_export_weekly}
                disabled={form.food_export_emails.length === 0}
                onChange={e => setForm(f => ({ ...f, food_export_weekly: e.target.checked }))}
                style={{ accentColor: "#C8FF00", width: 16, height: 16 }}
              />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>Weekly summary (Sunday night)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Invite a Friend */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 2, padding: 20, marginBottom: 16 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>Invite a Friend</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.7, marginBottom: 14 }}>
          Know someone who'd benefit from a private fitness dashboard? Enter their email and we'll send them a personal invite with a link to sign up.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            type="email"
            style={{ ...inp, flex: 1 }}
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="friend@example.com"
            onKeyDown={e => e.key === "Enter" && sendInvite()}
          />
          <button
            onClick={sendInvite}
            disabled={inviteSending || !inviteEmail}
            style={{ background: "rgba(200,255,0,0.1)", border: "1px solid rgba(200,255,0,0.25)", borderRadius: 2, color: "#C8FF00", padding: "8px 18px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", cursor: (inviteSending || !inviteEmail) ? "default" : "pointer", opacity: (inviteSending || !inviteEmail) ? 0.5 : 1, flexShrink: 0 }}>
            {inviteSending ? "Sending…" : "Send Invite"}
          </button>
        </div>
        {inviteMsg && <div style={{ marginTop: 10, fontSize: 12, color: inviteMsg.startsWith("✓") ? "#C8FF00" : "#f87171" }}>{inviteMsg}</div>}
      </div>

      {/* Change password */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 2, padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: changePw ? 16 : 0 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>Password</div>
          <button onClick={() => setChangePw(v => !v)} style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 2, color: "rgba(255,255,255,0.5)", padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>{changePw ? "Cancel" : "Change"}</button>
        </div>
        {changePw && <>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>New Password</label>
            <div style={{ position: "relative" }}>
              <input type={showPw ? "text" : "password"} style={{ ...inp, paddingRight: 44 }} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="12+ chars, uppercase, number, symbol" />
              <button onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 12, padding: 0 }}>{showPw ? "Hide" : "Show"}</button>
            </div>
            {newPw && (
              <div style={{ marginTop: 6 }}>
                <div style={{ display: "flex", gap: 3 }}>
                  {[1,2,3,4].map(i => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: strength.score >= i ? strength.color : "rgba(255,255,255,0.1)" }} />)}
                </div>
                <div style={{ fontSize: 11, color: strength.color, marginTop: 3 }}>{strength.label}</div>
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Confirm New Password</label>
            <input type={showPw ? "text" : "password"} style={{ ...inp, borderColor: confirmPw && confirmPw !== newPw ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.12)" }} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
          </div>
        </>}
      </div>

      {message && <div style={{ background: message.startsWith("Error") ? "rgba(248,113,113,0.1)" : "rgba(200,255,0,0.06)", border: `1px solid ${message.startsWith("Error") ? "rgba(248,113,113,0.3)" : "rgba(200,255,0,0.2)"}`, borderRadius: 2, padding: "10px 14px", fontSize: 13, color: message.startsWith("Error") ? "#f87171" : "#C8FF00", marginBottom: 16 }}>{message}</div>}

      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={save} disabled={saving} style={{ background: "#C8FF00", color: "#0e0e0e", border: "none", borderRadius: 2, padding: "11px 28px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>{saving ? "Saving…" : "Save Profile"}</button>
        <button onClick={onSignOut} style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 2, color: "rgba(255,255,255,0.4)", padding: "11px 20px", fontSize: 13, cursor: "pointer" }}>Sign Out</button>
      </div>

      {/* Install on your phone */}
      <div style={{ marginTop: 40, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 32 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 20 }}>Install on Your Phone</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, padding: "20px 24px" }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "#C8FF00", marginBottom: 14 }}>iPhone (Safari)</div>
            <ol style={{ margin: 0, paddingLeft: 18, color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 2 }}>
              <li>Open this site in <strong style={{ color: "#fff" }}>Safari</strong></li>
              <li>Tap the <strong style={{ color: "#fff" }}>Share</strong> button <span style={{ color: "rgba(255,255,255,0.4)" }}>(box with arrow up)</span></li>
              <li>Tap <strong style={{ color: "#fff" }}>Add to Home Screen</strong></li>
              <li>Tap <strong style={{ color: "#fff" }}>Add</strong></li>
            </ol>
            <div style={{ marginTop: 12, fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.6 }}>Must use Safari — Chrome on iOS does not support this.</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, padding: "20px 24px" }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "#C8FF00", marginBottom: 14 }}>Android (Chrome)</div>
            <ol style={{ margin: 0, paddingLeft: 18, color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 2 }}>
              <li>Open this site in <strong style={{ color: "#fff" }}>Chrome</strong></li>
              <li>Tap the <strong style={{ color: "#fff" }}>three-dot menu</strong> <span style={{ color: "rgba(255,255,255,0.4)" }}>(top right)</span></li>
              <li>Tap <strong style={{ color: "#fff" }}>Add to Home screen</strong></li>
              <li>Tap <strong style={{ color: "#fff" }}>Add</strong></li>
            </ol>
            <div style={{ marginTop: 12, fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.6 }}>Chrome may show an install banner automatically.</div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div style={{ marginTop: 40, borderTop: "1px solid rgba(255,60,60,0.15)", paddingTop: 24 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,80,80,0.4)", marginBottom: 12 }}>Danger Zone</div>
        {!deleteConfirm ? (
          <button onClick={() => setDeleteConfirm(true)} style={{ background: "none", border: "1px solid rgba(255,60,60,0.25)", borderRadius: 2, color: "rgba(255,80,80,0.5)", padding: "9px 18px", fontSize: 12, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>Delete Account</button>
        ) : (
          <div style={{ background: "rgba(255,40,40,0.06)", border: "1px solid rgba(255,60,60,0.2)", borderRadius: 2, padding: 20 }}>
            <div style={{ fontSize: 13, color: "#f87171", marginBottom: 4, fontWeight: "bold" }}>This cannot be undone.</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 16, lineHeight: 1.6 }}>Your account, all workout sessions, and all weight entries will be permanently deleted.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={deleteAccount} disabled={deleting} style={{ background: "#f87171", color: "#0e0e0e", border: "none", borderRadius: 2, padding: "9px 18px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", cursor: deleting ? "default" : "pointer", opacity: deleting ? 0.7 : 1 }}>{deleting ? "Deleting…" : "Yes, delete everything"}</button>
              <button onClick={() => setDeleteConfirm(false)} style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 2, color: "rgba(255,255,255,0.4)", padding: "9px 16px", fontSize: 12, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Admin Tab ───────────────────────────────────────────────────────────────
const ADMIN_EMAIL = "david@brightpathtechnology.io";

function AdminTab({ user }) {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);

  async function loadCodes() {
    setLoading(true);
    const { data, error: e } = await supabase
      .from("invite_codes")
      .select("*")
      .order("created_at", { ascending: false });
    if (e) setError(e.message);
    else setCodes(data || []);
    setLoading(false);
  }

  async function loadUsers() {
    setUsersLoading(true);
    const { data, error: e } = await supabase.rpc("get_admin_user_list");
    if (!e) setUsers(data || []);
    setUsersLoading(false);
  }

  useEffect(() => { loadCodes(); loadUsers(); }, []);

  async function addCode() {
    const code = newCode.trim().toUpperCase();
    if (!code) return;
    setSaving(true); setError(""); setMsg("");
    const { error: e } = await supabase.from("invite_codes").insert({ code, label: newLabel.trim() || null });
    setSaving(false);
    if (e) setError(e.message);
    else { setMsg(`✓ Code ${code} added.`); setNewCode(""); setNewLabel(""); loadCodes(); setTimeout(() => setMsg(""), 4000); }
  }

  async function toggleActive(code, current) {
    const { error: e } = await supabase.from("invite_codes").update({ active: !current }).eq("code", code);
    if (e) setError(e.message);
    else setCodes(cs => cs.map(c => c.code === code ? { ...c, active: !current } : c));
  }

  async function deleteCode(code) {
    const { error: e } = await supabase.from("invite_codes").delete().eq("code", code);
    if (e) setError(e.message);
    else setCodes(cs => cs.filter(c => c.code !== code));
  }

  async function sendInvite() {
    if (!inviteEmail) return;
    setInviteSending(true); setInviteMsg("");
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch("https://ibiszdvdhffvrissciyj.supabase.co/functions/v1/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({ friend_email: inviteEmail, inviter_name: user.email, invite_code: inviteCode || "BETA2026" }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { setInviteMsg(`✓ Invite sent to ${inviteEmail}`); setInviteEmail(""); setInviteCode(""); }
      else setInviteMsg(d.error || `Error ${res.status} — check function logs`);
    } catch (_e) { setInviteMsg("Network error — try again."); } // eslint-disable-line no-unused-vars
    setInviteSending(false);
    setTimeout(() => setInviteMsg(""), 6000);
  }

  const inp = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 2, color: "#fff", padding: "8px 12px", fontSize: 13, fontFamily: "Georgia, serif", width: "100%", boxSizing: "border-box" };
  const activeCount = codes.filter(c => c.active).length;

  return (
    <div style={{ marginTop: 32 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Admin</div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>Invite code management · {user.email}</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ background: "rgba(200,255,0,0.08)", border: "1px solid rgba(200,255,0,0.2)", borderRadius: 2, padding: "8px 16px", textAlign: "center" }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: "#C8FF00", lineHeight: 1 }}>{activeCount}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 2, textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif", marginTop: 3 }}>Active</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, padding: "8px 16px", textAlign: "center" }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{codes.length}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 2, textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif", marginTop: 3 }}>Total</div>
          </div>
        </div>
      </div>

      {/* Users */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>
            Accounts {!usersLoading && <span style={{ color: "#C8FF00" }}>({users.length})</span>}
          </div>
          <button type="button" onClick={loadUsers} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 2, textTransform: "uppercase", padding: 0 }}>↻ Refresh</button>
        </div>
        {usersLoading ? (
          <div style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, letterSpacing: 3 }}>LOADING…</div>
        ) : users.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, fontStyle: "italic" }}>No accounts found.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* Header row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 110px 110px 70px", gap: 12, padding: "6px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 4 }}>
              {["Account", "Joined", "Last Workout", "Last Weight", "Status"].map(h => (
                <div key={h} style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", fontFamily: "'Barlow Condensed', sans-serif" }}>{h}</div>
              ))}
            </div>
            {users.map(u => {
              const lastActive = [u.last_workout, u.last_weight].filter(Boolean).sort().pop() || null;
              const daysSince = lastActive // eslint-disable-next-line react-hooks/purity
                ? Math.floor((Date.now() - new Date(lastActive + "T12:00:00Z").getTime()) / 86400000)
                : null;
              const activeColor = daysSince === null ? "rgba(255,255,255,0.25)"
                : daysSince <= 3 ? "#C8FF00"
                : daysSince <= 7 ? "#facc15"
                : "#f87171";
              return (
                <div key={u.id} style={{ display: "grid", gridTemplateColumns: "1fr 160px 110px 110px 70px", gap: 12, padding: "12px", background: "rgba(255,255,255,0.015)", borderRadius: 2, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, color: "#fff", marginBottom: 2 }}>{u.name || <em style={{ color: "rgba(255,255,255,0.3)" }}>no name</em>}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{u.email}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                    {u.joined_at ? new Date(u.joined_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                    {u.last_workout ? new Date(u.last_workout + "T00:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" }) : <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                    {u.last_weight ? new Date(u.last_weight + "T00:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" }) : <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1, color: activeColor, textTransform: "uppercase" }}>
                    {!u.onboarding_complete ? "Setup" : daysSince === null ? "No data" : daysSince === 0 ? "Today" : `${daysSince}d ago`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Send Invite */}
      <div style={{ background: "rgba(200,255,0,0.03)", border: "1px solid rgba(200,255,0,0.15)", borderRadius: 2, padding: 24, marginBottom: 16 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: "#C8FF00", marginBottom: 16 }}>Send Invite Email</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label htmlFor="admin-invite-email" style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 6 }}>Recipient Email</label>
            <input
              id="admin-invite-email"
              type="email"
              style={inp}
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendInvite()}
              placeholder="friend@example.com"
            />
          </div>
          <div style={{ flex: "0 0 160px" }}>
            <label htmlFor="admin-invite-code-select" style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 6 }}>Invite Code</label>
            <select
              id="admin-invite-code-select"
              style={{ ...inp, appearance: "none" }}
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
            >
              {codes.filter(c => c.active).map(c => (
                <option key={c.code} value={c.code}>{c.code}{c.label ? ` — ${c.label}` : ""}</option>
              ))}
              {codes.filter(c => c.active).length === 0 && <option value="BETA2026">BETA2026</option>}
            </select>
          </div>
          <button
            type="button"
            onClick={sendInvite}
            disabled={inviteSending || !inviteEmail}
            style={{ background: "#C8FF00", color: "#0e0e0e", border: "none", borderRadius: 2, padding: "9px 22px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2, textTransform: "uppercase", cursor: (inviteSending || !inviteEmail) ? "default" : "pointer", opacity: (inviteSending || !inviteEmail) ? 0.4 : 1, flexShrink: 0, height: 38 }}>
            {inviteSending ? "Sending…" : "Send Invite"}
          </button>
        </div>
        {inviteMsg && <div role={inviteMsg.startsWith("✓") ? "status" : "alert"} style={{ marginTop: 12, fontSize: 12, color: inviteMsg.startsWith("✓") ? "#C8FF00" : "#f87171" }}>{inviteMsg}</div>}
      </div>

      {/* Add code form */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, padding: 24, marginBottom: 24 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 16 }}>Add Invite Code</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "0 0 160px" }}>
            <label htmlFor="admin-new-code" style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 6 }}>Code</label>
            <input
              id="admin-new-code"
              type="text"
              style={{ ...inp, textTransform: "uppercase", letterSpacing: 3, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15 }}
              value={newCode}
              onChange={e => setNewCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && addCode()}
              placeholder="MYCODE"
              autoComplete="off"
            />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label htmlFor="admin-new-label" style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 6 }}>Label <span style={{ color: "rgba(255,255,255,0.3)" }}>(optional)</span></label>
            <input
              id="admin-new-label"
              type="text"
              style={inp}
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addCode()}
              placeholder="e.g. Friend of David, Gym cohort 2026"
            />
          </div>
          <button
            type="button"
            onClick={addCode}
            disabled={saving || !newCode.trim()}
            style={{ background: "#C8FF00", color: "#0e0e0e", border: "none", borderRadius: 2, padding: "9px 22px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2, textTransform: "uppercase", cursor: (saving || !newCode.trim()) ? "default" : "pointer", opacity: (saving || !newCode.trim()) ? 0.4 : 1, flexShrink: 0, height: 38 }}>
            {saving ? "Adding…" : "Add Code"}
          </button>
        </div>
        {error && <div role="alert" style={{ marginTop: 12, fontSize: 12, color: "#f87171" }}>{error}</div>}
        {msg   && <div role="status" style={{ marginTop: 12, fontSize: 12, color: "#C8FF00" }}>{msg}</div>}
      </div>

      {/* Code list */}
      {loading ? (
        <div style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, letterSpacing: 3 }}>LOADING…</div>
      ) : codes.length === 0 ? (
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, fontStyle: "italic" }}>No invite codes yet. Add one above.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {codes.map(c => (
            <div key={c.code} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: c.active ? "rgba(200,255,0,0.025)" : "rgba(255,255,255,0.02)", border: `1px solid ${c.active ? "rgba(200,255,0,0.15)" : "rgba(255,255,255,0.06)"}`, borderRadius: 2, flexWrap: "wrap" }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: 3, color: c.active ? "#C8FF00" : "rgba(255,255,255,0.25)", minWidth: 120 }}>{c.code}</div>
              <div style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.6)", minWidth: 100 }}>
                {c.label || <em style={{ color: "rgba(255,255,255,0.25)" }}>no label</em>}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'Barlow Condensed', sans-serif", whiteSpace: "nowrap" }}>
                {new Date(c.created_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
              </div>
              {/* Active toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  role="switch"
                  aria-checked={c.active}
                  aria-label={`${c.active ? "Deactivate" : "Activate"} code ${c.code}`}
                  tabIndex={0}
                  onClick={() => toggleActive(c.code, c.active)}
                  onKeyDown={e => (e.key === "Enter" || e.key === " ") && toggleActive(c.code, c.active)}
                  style={{ width: 36, height: 20, borderRadius: 10, background: c.active ? "#C8FF00" : "rgba(255,255,255,0.1)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
                >
                  <div style={{ position: "absolute", top: 3, left: c.active ? 19 : 3, width: 14, height: 14, borderRadius: "50%", background: c.active ? "#0e0e0e" : "rgba(255,255,255,0.4)", transition: "left 0.2s" }} />
                </div>
                <span style={{ fontSize: 11, color: c.active ? "#C8FF00" : "rgba(255,255,255,0.3)", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1, textTransform: "uppercase", minWidth: 52 }}>{c.active ? "Active" : "Off"}</span>
              </div>
              <button type="button" onClick={() => deleteCode(c.code)} aria-label={`Delete code ${c.code}`} style={{ background: "none", border: "none", color: "rgba(255,80,80,0.35)", cursor: "pointer", fontSize: 20, padding: "0 4px", lineHeight: 1, flexShrink: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sessions, setSessions]       = useState([]);
  const [weights, setWeights]         = useState([]);
  const [photos, setPhotos]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState("dashboard");
  // Delegation: hosts this user can view as a delegate
  const [delegatedHosts, setDelegatedHosts] = useState([]); // [{host_user_id, host_name}]
  const [viewingUserId, setViewingUserId]   = useState(null); // null = own profile
  const [viewingProfile, setViewingProfile] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [adding, setAdding]           = useState(false);
  const [aiMode, setAiMode]           = useState(false);
  const [aiText, setAiText]           = useState("");
  const [aiImage, setAiImage]         = useState(null);
  const [aiParsing, setAiParsing]     = useState(false);
  const [newSession, setNewSession]   = useState({ date: "", location: "", exercises: [{ ...EMPTY_EXERCISE }] });
  const [newWeight, setNewWeight]     = useState("");
  const [newBodyFat, setNewBodyFat]   = useState("");
  const [newWeightDate, setNewWeightDate] = useState(localDateStr());
  const [toast, setToast]             = useState("");
  const [error, setError]             = useState("");
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [units, setUnitsState] = useState(() => localStorage.getItem("units") || "metric");
  const setUnits = (u) => { setUnitsState(u); localStorage.setItem("units", u); };

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load profile + resolve delegation + load hosts this user can view
  useEffect(() => {
    if (!user) return;
    setProfileLoaded(false);
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
      setProfile(data);
      setProfileLoaded(true);
    });
    // Resolve any pending delegation rows for this email
    supabase.rpc("resolve_delegation").catch(() => {});
    // Load hosts this user has been granted access to
    supabase
      .from("delegations")
      .select("host_user_id, profiles!delegations_host_user_id_fkey(name)")
      .eq("delegate_user_id", user.id)
      .then(({ data }) => {
        if (data?.length) {
          setDelegatedHosts(data.map(d => ({
            host_user_id: d.host_user_id,
            host_name: d.profiles?.name || "Unknown",
          })));
        }
      });
  }, [user]);

  // Load data — switches between own profile and a delegated host profile
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const targetId = viewingUserId || user.id;
    const timeout = setTimeout(() => {
      setLoading(false);
      setError("Loading timed out — check your connection and refresh.");
    }, 10000);
    try {
      const queries = [
        supabase.from("workout_sessions").select("*").eq("user_id", targetId).order("date", { ascending: false }),
        supabase.from("weight_log").select("*").eq("user_id", targetId).order("date", { ascending: true }),
        supabase.from("progress_photos").select("*").eq("user_id", targetId).order("date", { ascending: true }),
      ];
      // If viewing a host, also load their profile
      if (viewingUserId && viewingUserId !== user.id) {
        queries.push(supabase.from("profiles").select("*").eq("id", viewingUserId).single());
      }
      const results = await Promise.all(queries);
      const [{ data: sd, error: se }, { data: wd, error: we }, { data: pd }] = results;
      clearTimeout(timeout);
      if (se) throw se; if (we) throw we;
      setSessions(sd || []); setWeights(wd || []); setPhotos(pd || []);
      if (viewingUserId && viewingUserId !== user.id && results[3]) {
        setViewingProfile(results[3].data);
      }
    } catch (e) { clearTimeout(timeout); setError("Failed to load: " + e.message); }
    finally { setLoading(false); }
  }, [user, viewingUserId]);

  useEffect(() => { loadData(); }, [loadData]);

  function showToast(m) { setToast(m); setTimeout(() => setToast(""), 2500); }

  function switchToHost(hostUserId) {
    setViewingUserId(hostUserId);
    setViewingProfile(null);
    setTab("dashboard");
  }

  function switchToSelf() {
    setViewingUserId(null);
    setViewingProfile(null);
    setTab("dashboard");
  }

  const isReadOnly = !!(viewingUserId && viewingUserId !== user?.id);

  // Calorie recalculation
  async function recalcAllCalories() {
    const sortedWeights = [...weights].sort((a, b) => a.date > b.date ? 1 : -1);
    const bw = sortedWeights[sortedWeights.length - 1]?.kg || 80;
    const updates = sessions.map(s => ({
      id: s.id,
      calories_est: estimateCalories(s.exercises || [], bw),
    }));
    for (const u of updates) {
      await supabase.from("workout_sessions").update({ calories_est: u.calories_est }).eq("id", u.id).eq("user_id", user.id);
    }
    showToast("CALORIES UPDATED ✓");
    loadData();
  }

  // Workout helpers
  const totalSets = sessions.reduce((a, s) => a + (s.exercises || []).reduce((b, e) => b + Number(e.sets || 0), 0), 0);
  const _lastSession = sessions[0];

  function addExRow()       { setNewSession(s => ({ ...s, exercises: [...s.exercises, { ...EMPTY_EXERCISE }] })); }
  function removeExRow(i)   { setNewSession(s => ({ ...s, exercises: s.exercises.filter((_, idx) => idx !== i) })); }
  function updateEx(i, f, v) { setNewSession(s => { const e = [...s.exercises]; e[i] = { ...e[i], [f]: v }; return { ...s, exercises: e }; }); }

  async function saveSession() {
    if (!newSession.date || newSession.exercises.some(e => !e.name)) return;
    const bw = [...weights].sort((a, b) => a.date > b.date ? 1 : -1).pop()?.kg || 80;
    const calories_est = estimateCalories(newSession.exercises, bw);
    const record = { user_id: user.id, date: newSession.date, label: `Session #${sessions.length + 1}`, location: newSession.location || "YMCA", exercises: newSession.exercises, calories_est };
    const { error: e } = await supabase.from("workout_sessions").insert(record);
    if (e) { setError("Save failed: " + e.message); return; }
    setAdding(false);
    setNewSession({ date: "", location: profile?.trainer_name ? "YMCA with " + profile.trainer_name : "YMCA", exercises: [{ ...EMPTY_EXERCISE }] });
    showToast("SESSION SAVED ✓"); loadData();
  }

  async function parseWithAI() {
    if (!aiText && !aiImage) return;
    setAiParsing(true);
    try {
      let image_base64 = null;
      let image_media_type = null;
      if (aiImage) {
        const buf = await aiImage.arrayBuffer();
        image_base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        image_media_type = aiImage.type || "image/jpeg";
      }
      const today = localDateStr();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-workout`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ description: aiText, image_base64, image_media_type, today }),
        }
      );
      if (!res.ok) throw new Error(`Function error ${res.status}: ${await res.text()}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const exercises = (data.exercises || []).map(e => ({
        name: e.name || "",
        sets: "1",
        reps: String(e.reps || ""),
        weight: e.weight || "",
      }));
      setNewSession(s => ({
        ...s,
        exercises: exercises.length ? exercises : s.exercises,
        date: data.date || s.date,
        location: data.location || s.location,
      }));
      setAiMode(false);
      setAiText("");
      setAiImage(null);
    } catch (e) {
      setError("AI parse failed: " + e.message);
    } finally {
      setAiParsing(false);
    }
  }

  async function deleteSession(id) {
    const { error: e } = await supabase.from("workout_sessions").delete().eq("id", id).eq("user_id", user.id);
    if (e) { setError(e.message); return; }
    if (activeSession === id) setActiveSession(null); loadData();
  }

  // Weight helpers
  const heightM = profile?.height_cm ? parseFloat(profile.height_cm) / 100 : 1.7018;
  const targetBMI = profile?.target_bmi ? parseFloat(profile.target_bmi) : 24.9;
  const sortedW   = [...weights].sort((a, b) => a.date > b.date ? 1 : -1);
  const latestW   = sortedW[sortedW.length - 1];
  const firstW    = sortedW[0];
  const weightChange  = latestW && firstW && latestW.date !== firstW.date ? (latestW.kg - firstW.kg).toFixed(1) : null;
  const currentBMI    = latestW ? parseFloat(calcBMI(latestW.kg, heightM)) : null;
  const bmiCat        = currentBMI ? bmiCategory(currentBMI) : null;
  const targetKg      = (targetBMI * heightM * heightM).toFixed(1);
  const toTarget      = latestW ? (latestW.kg - parseFloat(targetKg)).toFixed(1) : null;

  // Weekly stats
  const weekStart = (() => {
    const d = new Date(); const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    return localDateStr(d);
  })();
  const thisWeekSessions = sessions.filter(s => s.date >= weekStart);
  const thisWeekCals     = thisWeekSessions.reduce((a, s) => a + (s.calories_est || 0), 0);
  const weekSessionsTarget = profile?.weekly_sessions_target || 3;
  const weekCalTarget      = profile?.weekly_cal_target || 1500;

  async function logWeight() {
    const kg = parseFloat(newWeight);
    if (!newWeight || isNaN(kg)) return;
    const bf = newBodyFat ? parseFloat(newBodyFat) : null;
    const { error: e } = await supabase.from("weight_log").upsert({ user_id: user.id, date: newWeightDate, kg, body_fat_pct: bf }, { onConflict: "date,user_id" });
    if (e) { setError(e.message); return; }
    setNewWeight(""); setNewBodyFat(""); showToast("WEIGHT LOGGED ✓"); loadData();
  }

  async function deleteWeight(date) {
    const { error: e } = await supabase.from("weight_log").delete().eq("date", date).eq("user_id", user.id);
    if (e) { setError(e.message); return; } loadData();
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null); setProfile(null); setSessions([]); setWeights([]); setPhotos([]);
  }

  const inp = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 2, color: "#fff", padding: "8px 12px", fontSize: 13, fontFamily: "Georgia, serif", width: "100%" };

  // ── Render ──
  const loadingScreen = <div style={{ minHeight: "100vh", background: "#0e0e0e", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, letterSpacing: 4 }}>LOADING…</div>;
  if (authLoading) return loadingScreen;
  if (!user) return <LandingPage onAuth={u => setUser(u)} />;
  if (!user.email_confirmed_at) return <ConfirmEmailScreen email={user.email} onSignOut={signOut} />;
  if (!profileLoaded) return loadingScreen;
  if (!profile?.onboarding_complete) return (
    <OnboardingWizard user={user} onComplete={p => { setProfile(p); loadData(); }} units={units} />
  );
  if (loading) return loadingScreen;

  const activeProfile = isReadOnly ? viewingProfile : profile;
  const displayName = activeProfile?.name || (isReadOnly ? "Host" : user.email.split("@")[0]);
  const trainerName = activeProfile?.trainer_name || null;
  const primaryLocation = activeProfile?.workout_locations?.[0]?.label || null;

  return (
    <div style={{ minHeight: "100vh", background: "#0e0e0e", color: "#fff", fontFamily: "Georgia, serif", paddingBottom: 80 }}>
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}

      {toast && <div style={{ position: "fixed", bottom: 32, right: 32, background: "#C8FF00", color: "#0e0e0e", padding: "12px 24px", borderRadius: 2, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: 2, zIndex: 100 }}>{toast}</div>}
      {error && <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", padding: "12px 24px", fontSize: 13, color: "#f87171", display: "flex", justifyContent: "space-between" }}>
        {error}<button onClick={() => setError("")} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 16 }}>×</button>
      </div>}

      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "32px clamp(16px, 5vw, 40px) 28px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ color: "#C8FF00", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 4, textTransform: "uppercase", marginBottom: 6 }}>BrightPath Fitness</div>
          <h1 style={{ margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 48, fontWeight: 900, lineHeight: 1, letterSpacing: -1 }}>
            {displayName}'s <span style={{ color: "#C8FF00" }}>Dashboard</span>
          </h1>
          {(primaryLocation || trainerName) && (
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 8, fontStyle: "italic" }}>
              {[primaryLocation, trainerName ? `Trainer: ${trainerName}` : null].filter(Boolean).join(" · ")}
            </div>
          )}
          {/* Profile switcher */}
          {(delegatedHosts.length > 0 || isReadOnly) && (
            <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
              <button
                onClick={switchToSelf}
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", padding: "5px 12px", borderRadius: 20, border: `1px solid ${!isReadOnly ? "#C8FF00" : "rgba(255,255,255,0.2)"}`, background: !isReadOnly ? "rgba(200,255,0,0.1)" : "transparent", color: !isReadOnly ? "#C8FF00" : "rgba(255,255,255,0.4)", cursor: "pointer" }}
              >
                My Profile
              </button>
              {delegatedHosts.map(h => (
                <button
                  key={h.host_user_id}
                  onClick={() => switchToHost(h.host_user_id)}
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", padding: "5px 12px", borderRadius: 20, border: `1px solid ${viewingUserId === h.host_user_id ? "#C8FF00" : "rgba(255,255,255,0.2)"}`, background: viewingUserId === h.host_user_id ? "rgba(200,255,0,0.1)" : "transparent", color: viewingUserId === h.host_user_id ? "#C8FF00" : "rgba(255,255,255,0.4)", cursor: "pointer" }}
                >
                  {h.host_name}'s View
                </button>
              ))}
            </div>
          )}
          {isReadOnly && (
            <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>
              Read-only view
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          {/* Avatar */}
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(200,255,0,0.1)", border: "1px solid rgba(200,255,0,0.3)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={() => setTab("profile")}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ color: "#C8FF00", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700 }}>{displayName[0].toUpperCase()}</div>
            }
          </div>
          {tab === "workouts" && !isReadOnly ? (
            <button onClick={() => { setAdding(true); setActiveSession(null); }} style={{ background: "#C8FF00", color: "#0e0e0e", border: "none", borderRadius: 2, padding: "12px 24px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap" }}>
              + Log Session
            </button>
          ) : (
            <button onClick={signOut} style={{ background: "none", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 2, color: "rgba(255,255,255,0.65)", padding: "9px 18px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap" }}>Sign Out</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar" style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 clamp(16px, 5vw, 40px)" }}>
        {[
          ["dashboard", "Dashboard"],
          ["workouts", "Workouts"],
          ["weight",   "Weight & BMI"],
          ["goals",    "Goals"],
          ["food",     "Food"],
          ["profile",  "Profile"],
          ...(user.email === ADMIN_EMAIL ? [["admin", "Admin"]] : []),
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ background: "none", border: "none", borderBottom: tab === key ? "2px solid #C8FF00" : "2px solid transparent", color: tab === key ? "#C8FF00" : "rgba(255,255,255,0.35)", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, letterSpacing: 3, textTransform: "uppercase", padding: "14px 20px 12px", cursor: "pointer", marginBottom: -1 }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: "0 clamp(16px, 5vw, 40px)" }}>

        {/* DASHBOARD TAB */}
        {tab === "dashboard" && (
          <DashboardTab supabase={supabase} user={user} profile={activeProfile} sessions={sessions} weights={weights} viewingUserId={viewingUserId || user.id} isReadOnly={isReadOnly} />
        )}

        {/* WORKOUTS TAB */}
        {tab === "workouts" && <>
          <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
            <StatCard label="Sessions" value={sessions.length} sub="YMCA + home" />
            <StatCard label="Total Sets" value={totalSets} sub="across all sessions" />
            <StatCard label="This Week" value={`${thisWeekSessions.length}/${weekSessionsTarget}`} sub="sessions this week" accent={thisWeekSessions.length >= weekSessionsTarget ? "#C8FF00" : "#facc15"} />
            <StatCard label="Week Cals" value={thisWeekCals} sub={`target: ${weekCalTarget} kcal`} accent={thisWeekCals >= weekCalTarget ? "#C8FF00" : "#facc15"} />
          </div>
          <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
            <button onClick={recalcAllCalories} style={{ background: "none", border: "1px solid rgba(200,255,0,0.2)", borderRadius: 2, color: "rgba(200,255,0,0.6)", padding: "6px 16px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>Recalculate Calories</button>
          </div>

          {adding && !isReadOnly && (
            <div style={{ marginTop: 32, background: "rgba(200,255,0,0.04)", border: "1px solid rgba(200,255,0,0.2)", borderRadius: 2, padding: 28 }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#C8FF00" }}>New Session</div>
                <button
                  onClick={() => { setAiMode(v => !v); setAiText(""); setAiImage(null); }}
                  style={{ background: aiMode ? "#C8FF00" : "rgba(200,255,0,0.08)", border: "1px solid rgba(200,255,0,0.3)", borderRadius: 2, color: aiMode ? "#0e0e0e" : "#C8FF00", padding: "6px 14px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}
                >✦ AI Parse</button>
              </div>

              {/* AI Parse panel */}
              {aiMode && (
                <div style={{ background: "rgba(200,255,0,0.03)", border: "1px solid rgba(200,255,0,0.15)", borderRadius: 2, padding: 20, marginBottom: 20 }}>
                  <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>Describe your workout</div>
                  <textarea
                    placeholder={"e.g. 3 sets bench press 100kg x10, squats 80kg 4x8, cable rows 60kg x12..."}
                    style={{ ...inp, width: "100%", minHeight: 80, resize: "vertical", fontFamily: "Georgia, serif", boxSizing: "border-box" }}
                    value={aiText}
                    onChange={e => setAiText(e.target.value)}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "rgba(255,255,255,0.5)", border: "1px dashed rgba(255,255,255,0.15)", borderRadius: 2, padding: "6px 12px" }}>
                      {aiImage ? <span style={{ color: "#C8FF00" }}>✓ {aiImage.name}</span> : <span>+ Attach photo</span>}
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => setAiImage(e.target.files[0] || null)} />
                    </label>
                    {aiImage && <button onClick={() => setAiImage(null)} style={{ background: "none", border: "none", color: "rgba(255,80,80,0.5)", cursor: "pointer", fontSize: 12 }}>Remove</button>}
                    <button
                      onClick={parseWithAI}
                      disabled={aiParsing || (!aiText && !aiImage)}
                      style={{ background: "#C8FF00", color: "#0e0e0e", border: "none", borderRadius: 2, padding: "8px 20px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", cursor: aiParsing ? "default" : "pointer", opacity: aiParsing || (!aiText && !aiImage) ? 0.5 : 1 }}
                    >{aiParsing ? "Parsing…" : "Parse"}</button>
                  </div>
                </div>
              )}

              {/* Date + Location */}
              <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Date</label>
                  <input type="date" style={inp} value={newSession.date} onChange={e => setNewSession(s => ({ ...s, date: e.target.value }))} />
                </div>
                <div style={{ flex: 2, minWidth: 200 }}>
                  <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Location</label>
                  <input type="text" style={inp} value={newSession.location} onChange={e => setNewSession(s => ({ ...s, location: e.target.value }))} placeholder="Where did you train?" list="loc-suggestions" />
                  <datalist id="loc-suggestions">
                    {(profile?.workout_locations || []).map((loc, i) => <option key={i} value={loc.label} />)}
                  </datalist>
                </div>
              </div>

              {/* Exercises */}
              <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>Exercises</div>
              {newSession.exercises.map((ex, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input placeholder="Exercise name" style={{ ...inp, flex: 3, minWidth: 140 }} value={ex.name} onChange={e => updateEx(i, "name", e.target.value)} />
                  <input placeholder="Sets"          style={{ ...inp, flex: 1, minWidth: 55 }} value={ex.sets} onChange={e => updateEx(i, "sets", e.target.value)} />
                  <input placeholder="Reps"          style={{ ...inp, flex: 1, minWidth: 55 }} value={ex.reps} onChange={e => updateEx(i, "reps", e.target.value)} />
                  <input placeholder="Weight / Notes" style={{ ...inp, flex: 2, minWidth: 90 }} value={ex.weight} onChange={e => updateEx(i, "weight", e.target.value)} />
                  {newSession.exercises.length > 1 && <button onClick={() => removeExRow(i)} style={{ background: "none", border: "none", color: "rgba(255,80,80,0.6)", cursor: "pointer", fontSize: 18, padding: "0 4px", flexShrink: 0 }}>×</button>}
                </div>
              ))}
              <button onClick={addExRow} style={{ background: "none", border: "1px dashed rgba(255,255,255,0.15)", borderRadius: 2, color: "rgba(255,255,255,0.4)", padding: "7px 16px", fontSize: 12, cursor: "pointer", marginTop: 4 }}>+ Add Exercise</button>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={saveSession} style={{ background: "#C8FF00", color: "#0e0e0e", border: "none", borderRadius: 2, padding: "11px 24px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>Save Session</button>
                <button onClick={() => { setAdding(false); setAiMode(false); setAiText(""); setAiImage(null); }} style={{ background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 2, color: "rgba(255,255,255,0.5)", padding: "11px 20px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ marginTop: 36 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 16 }}>All Sessions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {sessions.map(session => (
                <div key={session.id}>
                  <div onClick={() => setActiveSession(activeSession === session.id ? null : session.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", background: activeSession === session.id ? "rgba(200,255,0,0.06)" : "rgba(255,255,255,0.03)", border: activeSession === session.id ? "1px solid rgba(200,255,0,0.2)" : "1px solid rgba(255,255,255,0.06)", borderRadius: 2, cursor: "pointer", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: "#C8FF00", letterSpacing: 2, whiteSpace: "nowrap" }}>{session.label}</div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 600 }}>{formatDate(session.date)}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.location}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'Barlow Condensed', sans-serif" }}>{(session.exercises || []).length} exercises</div>
                      {session.calories_est > 0 && <div style={{ fontSize: 12, color: "rgba(200,255,0,0.5)", fontFamily: "'Barlow Condensed', sans-serif" }}>~{session.calories_est} kcal</div>}
                      <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 18 }}>{activeSession === session.id ? "−" : "+"}</div>
                    </div>
                  </div>
                  {activeSession === session.id && (
                    <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(200,255,0,0.1)", borderTop: "none", borderRadius: "0 0 2px 2px", padding: "4px 20px 16px" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
                        <thead><tr>{["#", "Exercise", "Sets", "Reps", "Weight / Notes"].map(h => (
                          <th key={h} style={{ textAlign: "left", fontSize: 10, letterSpacing: 2, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 400 }}>{h}</th>
                        ))}</tr></thead>
                        <tbody>{(session.exercises || []).map((ex, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <td style={{ padding: "10px 8px", color: "rgba(255,255,255,0.25)", fontSize: 12 }}>{i + 1}</td>
                            <td style={{ padding: "10px 8px", color: "#fff", fontSize: 14 }}>{ex.name}</td>
                            <td style={{ padding: "10px 8px", color: "#C8FF00", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 600 }}>{ex.sets}</td>
                            <td style={{ padding: "10px 8px", color: "rgba(255,255,255,0.7)", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16 }}>{ex.reps}</td>
                            <td style={{ padding: "10px 8px", color: "rgba(255,255,255,0.7)", fontSize: 13, fontStyle: "italic" }}>{ex.weight}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                      <button onClick={() => deleteSession(session.id)} style={{ marginTop: 12, background: "none", border: "1px solid rgba(255,60,60,0.2)", borderRadius: 2, color: "rgba(255,80,80,0.5)", padding: "6px 14px", fontSize: 11, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", letterSpacing: 1 }}>Delete Session</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>}

        {/* WEIGHT & BMI TAB */}
        {tab === "weight" && <>
          <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
            <StatCard label="Current Weight" value={latestW ? formatWeight(latestW.kg) : "—"} sub={latestW ? formatDate(latestW.date) : ""} />
            <StatCard label="BMI" value={currentBMI || "—"} sub={bmiCat?.label} accent={bmiCat?.color} />
            <StatCard label="Change" value={weightChange !== null ? `${parseFloat(weightChange) > 0 ? "+" : ""}${formatWeight(weightChange)}` : "—"} sub={`since ${firstW ? shortDate(firstW.date) : "start"}`} accent={weightChange !== null ? (parseFloat(weightChange) < 0 ? "#C8FF00" : parseFloat(weightChange) > 0 ? "#f87171" : "#fff") : "#fff"} />
            <StatCard label="To Target" value={toTarget !== null ? formatWeight(toTarget) : "—"} sub={`target: ${formatWeight(targetKg)} (BMI ${targetBMI})`} accent="#facc15" />
          </div>

          {currentBMI && (
            <div style={{ marginTop: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, padding: "20px 24px" }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>BMI Scale</div>
              <div style={{ position: "relative", height: 10, borderRadius: 5, background: "linear-gradient(to right, #60a5fa 0% 20%, #C8FF00 20% 52%, #facc15 52% 72%, #f87171 72% 100%)" }}>
                {/* Target weight marker */}
                <div style={{ position: "absolute", top: -6, left: bmiLeft(targetBMI), transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "10px solid #facc15" }} title={`Target BMI ${targetBMI} = ${targetKg} kg`} />
                {/* Current weight marker */}
                <div style={{ position: "absolute", top: -4, left: bmiLeft(currentBMI), transform: "translateX(-50%)", width: 18, height: 18, borderRadius: "50%", background: "#fff", border: "3px solid #0e0e0e", boxShadow: "0 0 0 2px " + bmiCat.color }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>
                <span>Under &lt;18.5</span><span>Normal 18.5–24.9</span><span>Over 25–29.9</span><span>Obese ≥30</span>
              </div>
              <div style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.6)", fontStyle: "italic", lineHeight: 1.6 }}>
                Current BMI <span style={{ color: bmiCat.color, fontWeight: "bold" }}>{currentBMI} ({bmiCat.label})</span>.{" "}
                {parseFloat(toTarget) > 0
                  ? <>Losing <span style={{ color: "#facc15" }}>{formatWeight(toTarget)}</span> reaches BMI {targetBMI} at <span style={{ color: "#C8FF00" }}>{formatWeight(targetKg)}</span>.</>
                  : parseFloat(toTarget) < 0
                    ? <>Target reached — you're <span style={{ color: "#C8FF00" }}>{formatWeight(Math.abs(toTarget))}</span> under your BMI {targetBMI} goal.</>
                    : <>You're exactly at your BMI {targetBMI} target of <span style={{ color: "#C8FF00" }}>{formatWeight(targetKg)}</span>.</>
                }
              </div>
            </div>
          )}

          <div style={{ marginTop: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, padding: "20px 24px" }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 16 }}>Weight Over Time</div>
            {sortedW.length > 1 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={sortedW.map(w => ({ date: shortDate(w.date), kg: w.kg }))}>
                  <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif" }} axisLine={false} tickLine={false} />
                  <YAxis domain={["auto", "auto"]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="kg" stroke="#C8FF00" strokeWidth={2} dot={{ fill: "#C8FF00", r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: "#fff" }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.25)", fontSize: 13, fontStyle: "italic" }}>Log a second entry to see your trend chart.</div>
            )}
          </div>

          {!isReadOnly && <div style={{ marginTop: 20, background: "rgba(200,255,0,0.04)", border: "1px solid rgba(200,255,0,0.15)", borderRadius: 2, padding: 24 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16, color: "#C8FF00" }}>Log Weight</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Date</label>
                <input type="date" style={inp} value={newWeightDate} onChange={e => setNewWeightDate(e.target.value)} />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Weight {units === "imperial" ? "(lb)" : "(kg)"}</label>
                <WeightInput valueKg={newWeight} onChangeKg={setNewWeight} units={units} style={inp} placeholder={units === "imperial" ? "e.g. 230" : "e.g. 105.5"} onKeyDown={e => e.key === "Enter" && logWeight()} />
              </div>
              <div style={{ flex: 1, minWidth: 100 }}>
                <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Body Fat %</label>
                <input type="number" step="0.1" placeholder="e.g. 22.5" style={inp} value={newBodyFat} onChange={e => setNewBodyFat(e.target.value)} onKeyDown={e => e.key === "Enter" && logWeight()} />
              </div>
              <button onClick={logWeight} style={{ background: "#C8FF00", color: "#0e0e0e", border: "none", borderRadius: 2, padding: "9px 22px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", height: 38, flexShrink: 0 }}>Save</button>
            </div>
          </div>}

          <div style={{ marginTop: 20 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>History</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {[...sortedW].reverse().map((w, i) => {
                const b = parseFloat(calcBMI(w.kg, heightM));
                const cat = bmiCategory(b);
                const prevIdx = sortedW.length - 2 - i;
                const prev = prevIdx >= 0 ? sortedW[prevIdx] : null;
                const diff = prev ? (w.kg - prev.kg).toFixed(1) : null;
                return (
                  <div key={w.date} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 2 }}>
                    <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", flex: 1 }}>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14 }}>{formatDate(w.date)}</div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700 }}>{formatWeight(w.kg)}</div>
                      <div style={{ fontSize: 12, color: cat.color, fontStyle: "italic" }}>BMI {b} · {cat.label}</div>
                      {w.body_fat_pct != null && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "'Barlow Condensed', sans-serif" }}>{w.body_fat_pct}% body fat</div>}
                      {diff !== null && <div style={{ fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", color: parseFloat(diff) < 0 ? "#C8FF00" : parseFloat(diff) > 0 ? "#f87171" : "rgba(255,255,255,0.3)" }}>{parseFloat(diff) > 0 ? "+" : ""}{formatWeight(diff)}</div>}
                    </div>
                    <button onClick={() => deleteWeight(w.date)} style={{ background: "none", border: "none", color: "rgba(255,80,80,0.4)", cursor: "pointer", fontSize: 16, padding: "0 4px", flexShrink: 0 }}>×</button>
                  </div>
                );
              })}
            </div>
          </div>
        </>}

        {/* GOALS TAB */}
        {tab === "goals" && (
          <GoalsTab user={user} profile={activeProfile} weights={weights} sessions={sessions}
            photos={photos} onProfileUpdate={updates => !isReadOnly && setProfile(p => ({ ...p, ...updates }))}
            onPhotosChange={!isReadOnly ? loadData : () => {}} />
        )}

        {/* FOOD TAB */}
        {tab === "food" && (
          <FoodTab supabase={supabase} user={user} viewingUserId={viewingUserId || user.id} isReadOnly={isReadOnly} toast={msg => { setToast(msg); setTimeout(() => setToast(""), 2500); }} />
        )}

        {/* PROFILE TAB */}
        {tab === "profile" && (
          <ProfileTab user={user} profile={profile} onSave={p => setProfile(p)} onSignOut={signOut} units={units} setUnits={setUnits} />
        )}

        {/* ADMIN TAB */}
        {tab === "admin" && user.email === ADMIN_EMAIL && (
          <AdminTab user={user} />
        )}

      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 60, padding: "20px clamp(16px, 5vw, 40px)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", letterSpacing: 1 }}>© {new Date().getFullYear()} BrightPath Fitness · Ontario, Canada</div>
        <button onClick={() => setShowPrivacy(true)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", fontSize: 11, cursor: "pointer", letterSpacing: 1, textDecoration: "underline", textUnderlineOffset: 3 }}>Privacy Policy</button>
      </div>
    </div>
  );
}
