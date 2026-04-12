import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "./supabase.js";

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
      <div style={{ color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700 }}>{kg} kg</div>
    </div>
  );
};

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login"); // login | signup | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const strength = getStrength(password);
  const inp = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 2, color: "#fff", padding: "10px 14px", fontSize: 14, fontFamily: "Georgia, serif", width: "100%", boxSizing: "border-box" };

  async function handleSubmit() {
    setError(""); setMessage("");
    if (!email) { setError("Email required."); return; }

    if (mode === "reset") {
      setLoading(true);
      const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "https://fitness.brightpathtechnology.io",
      });
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
      const { data, error: e } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (e) setError(e.message);
      else if (data.user?.identities?.length === 0) setError("An account with this email already exists.");
      else setMessage("Account created! Check your email to confirm, then log in.");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0e0e0e", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ color: "#C8FF00", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 4, textTransform: "uppercase", marginBottom: 8 }}>Training Log</div>
        <h1 style={{ margin: "0 0 8px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 42, fontWeight: 900, lineHeight: 1, color: "#fff" }}>
          Dave's <span style={{ color: "#C8FF00" }}>Fitness</span>
        </h1>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 40, fontStyle: "italic" }}>McDonald YMCA · Trainer: Susan Jadidi</div>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, padding: 32 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#C8FF00", marginBottom: 24 }}>
            {mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Reset Password"}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Email</label>
            <input type="email" style={inp} value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="you@example.com" />
          </div>

          {mode !== "reset" && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Password</label>
              <div style={{ position: "relative" }}>
                <input type={showPw ? "text" : "password"} style={{ ...inp, paddingRight: 44 }} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder={mode === "signup" ? "12+ chars, uppercase, number, symbol" : "••••••••"} />
                <button onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 13, padding: 0 }}>{showPw ? "Hide" : "Show"}</button>
              </div>
              {mode === "signup" && password && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: strength.score >= i ? strength.color : "rgba(255,255,255,0.1)", transition: "background 0.2s" }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: strength.color, marginTop: 4 }}>{strength.label}</div>
                  {strength.score < 4 && (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
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
              <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Confirm Password</label>
              <input type={showPw ? "text" : "password"} style={{ ...inp, borderColor: confirmPw && confirmPw !== password ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.12)" }} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="••••••••" />
              {confirmPw && confirmPw !== password && <div style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>Passwords don't match</div>}
            </div>
          )}

          {error && <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 2, padding: "10px 14px", fontSize: 13, color: "#f87171", marginBottom: 16 }}>{error}</div>}
          {message && <div style={{ background: "rgba(200,255,0,0.06)", border: "1px solid rgba(200,255,0,0.2)", borderRadius: 2, padding: "10px 14px", fontSize: 13, color: "#C8FF00", marginBottom: 16 }}>{message}</div>}

          <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", background: "#C8FF00", color: "#0e0e0e", border: "none", borderRadius: 2, padding: "12px 24px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: 2, textTransform: "uppercase", cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Please wait…" : mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
          </button>

          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
            {mode === "login" && <>
              <button onClick={() => { setMode("signup"); setError(""); setMessage(""); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 13, cursor: "pointer" }}>Don't have an account? Sign up</button>
              <button onClick={() => { setMode("reset"); setError(""); setMessage(""); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", fontSize: 12, cursor: "pointer" }}>Forgot password?</button>
            </>}
            {mode !== "login" && <button onClick={() => { setMode("login"); setError(""); setMessage(""); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 13, cursor: "pointer" }}>Back to sign in</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────
function ProfileTab({ user, profile, onSave, onSignOut }) {
  const [form, setForm] = useState({
    name: profile?.name || "",
    height_cm: profile?.height_cm || "",
    target_bmi: profile?.target_bmi || "24.9",
    trainer_name: profile?.trainer_name || "",
    trainer_email: profile?.trainer_email || "",
    notifications_enabled: profile?.notifications_enabled ?? true,
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [changePw, setChangePw] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const strength = getStrength(newPw);

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

    const upsertData = { id: user.id, ...form, avatar_url, updated_at: new Date().toISOString() };
    const { error: e } = await supabase.from("profiles").upsert(upsertData);
    if (e) { setMessage("Error: " + e.message); setSaving(false); return; }

    if (changePw && newPw) {
      if (strength.score < 3) { setMessage("New password too weak."); setSaving(false); return; }
      if (newPw !== confirmPw) { setMessage("Passwords don't match."); setSaving(false); return; }
      const { error: pwErr } = await supabase.auth.updateUser({ password: newPw });
      if (pwErr) { setMessage("Password error: " + pwErr.message); setSaving(false); return; }
      setNewPw(""); setConfirmPw(""); setChangePw(false);
    }

    onSave({ ...form, avatar_url });
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Name */}
        <div style={{ gridColumn: "1/-1" }}>
          <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Full Name</label>
          <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Dave Martin" />
        </div>
        {/* Height */}
        <div>
          <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Height (cm)</label>
          <input type="number" style={inp} value={form.height_cm} onChange={e => setForm(f => ({ ...f, height_cm: e.target.value }))} placeholder="170" />
        </div>
        {/* Target BMI */}
        <div>
          <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Target BMI</label>
          <input type="number" step="0.1" style={inp} value={form.target_bmi} onChange={e => setForm(f => ({ ...f, target_bmi: e.target.value }))} placeholder="24.9" />
          {targetKg && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>= {targetKg} kg target weight</div>}
        </div>
        {/* Trainer name */}
        <div>
          <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Trainer Name</label>
          <input style={inp} value={form.trainer_name} onChange={e => setForm(f => ({ ...f, trainer_name: e.target.value }))} placeholder="Susan Jadidi" />
        </div>
        {/* Trainer email */}
        <div>
          <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Trainer Email</label>
          <input type="email" style={inp} value={form.trainer_email} onChange={e => setForm(f => ({ ...f, trainer_email: e.target.value }))} placeholder="trainer@ymca.ca" />
        </div>
        {/* Notifications */}
        <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 12 }}>
          <div onClick={() => setForm(f => ({ ...f, notifications_enabled: !f.notifications_enabled }))} style={{ width: 44, height: 24, borderRadius: 12, background: form.notifications_enabled ? "#C8FF00" : "rgba(255,255,255,0.1)", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
            <div style={{ position: "absolute", top: 3, left: form.notifications_enabled ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: form.notifications_enabled ? "#0e0e0e" : "rgba(255,255,255,0.4)", transition: "left 0.2s" }} />
          </div>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Workout & weight reminders</span>
        </div>
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
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState("workouts");
  const [activeSession, setActiveSession] = useState(null);
  const [adding, setAdding]           = useState(false);
  const [newSession, setNewSession]   = useState({ date: "", location: "", exercises: [{ ...EMPTY_EXERCISE }] });
  const [newWeight, setNewWeight]     = useState("");
  const [newBodyFat, setNewBodyFat]   = useState("");
  const [newWeightDate, setNewWeightDate] = useState(new Date().toISOString().split("T")[0]);
  const [toast, setToast]             = useState("");
  const [error, setError]             = useState("");

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

  // Load profile
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
      setProfile(data);
      if (data?.trainer_name) setNewSession(s => ({ ...s, location: "YMCA with " + data.trainer_name }));
    });
  }, [user]);

  // Load data
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: sd, error: se }, { data: wd, error: we }] = await Promise.all([
        supabase.from("workout_sessions").select("*").eq("user_id", user.id).order("date", { ascending: false }),
        supabase.from("weight_log").select("*").eq("user_id", user.id).order("date", { ascending: true }),
      ]);
      if (se) throw se; if (we) throw we;
      setSessions(sd || []); setWeights(wd || []);
    } catch (e) { setError("Failed to load: " + e.message); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  function showToast(m) { setToast(m); setTimeout(() => setToast(""), 2500); }

  // Workout helpers
  const totalSets = sessions.reduce((a, s) => a + (s.exercises || []).reduce((b, e) => b + Number(e.sets || 0), 0), 0);
  const lastSession = sessions[0];

  function addExRow()       { setNewSession(s => ({ ...s, exercises: [...s.exercises, { ...EMPTY_EXERCISE }] })); }
  function removeExRow(i)   { setNewSession(s => ({ ...s, exercises: s.exercises.filter((_, idx) => idx !== i) })); }
  function updateEx(i, f, v) { setNewSession(s => { const e = [...s.exercises]; e[i] = { ...e[i], [f]: v }; return { ...s, exercises: e }; }); }

  async function saveSession() {
    if (!newSession.date || newSession.exercises.some(e => !e.name)) return;
    const record = { id: Date.now(), user_id: user.id, date: newSession.date, label: `Session #${sessions.length + 1}`, location: newSession.location || "YMCA", exercises: newSession.exercises };
    const { error: e } = await supabase.from("workout_sessions").insert(record);
    if (e) { setError("Save failed: " + e.message); return; }
    setAdding(false);
    setNewSession({ date: "", location: profile?.trainer_name ? "YMCA with " + profile.trainer_name : "YMCA", exercises: [{ ...EMPTY_EXERCISE }] });
    showToast("SESSION SAVED ✓"); loadData();
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
    setUser(null); setProfile(null); setSessions([]); setWeights([]);
  }

  const inp = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 2, color: "#fff", padding: "8px 12px", fontSize: 13, fontFamily: "Georgia, serif", width: "100%" };

  // ── Render ──
  if (authLoading) return <div style={{ minHeight: "100vh", background: "#0e0e0e", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, letterSpacing: 4 }}>LOADING…</div>;
  if (!user) return <AuthScreen onAuth={u => setUser(u)} />;
  if (loading) return <div style={{ minHeight: "100vh", background: "#0e0e0e", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, letterSpacing: 4 }}>LOADING…</div>;

  const displayName = profile?.name || user.email.split("@")[0];
  const trainerName = profile?.trainer_name || "Susan";

  return (
    <div style={{ minHeight: "100vh", background: "#0e0e0e", color: "#fff", fontFamily: "Georgia, serif", paddingBottom: 80 }}>

      {toast && <div style={{ position: "fixed", bottom: 32, right: 32, background: "#C8FF00", color: "#0e0e0e", padding: "12px 24px", borderRadius: 2, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: 2, zIndex: 100 }}>{toast}</div>}
      {error && <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", padding: "12px 24px", fontSize: 13, color: "#f87171", display: "flex", justifyContent: "space-between" }}>
        {error}<button onClick={() => setError("")} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 16 }}>×</button>
      </div>}

      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "32px 40px 28px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ color: "#C8FF00", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 4, textTransform: "uppercase", marginBottom: 6 }}>Training Log</div>
          <h1 style={{ margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 48, fontWeight: 900, lineHeight: 1, letterSpacing: -1 }}>
            {displayName}'s <span style={{ color: "#C8FF00" }}>Fitness</span>
          </h1>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 8, fontStyle: "italic" }}>McDonald YMCA · Trainer: {trainerName}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          {/* Avatar */}
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(200,255,0,0.1)", border: "1px solid rgba(200,255,0,0.3)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={() => setTab("profile")}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ color: "#C8FF00", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700 }}>{displayName[0].toUpperCase()}</div>
            }
          </div>
          {tab === "workouts" && (
            <button onClick={() => { setAdding(true); setActiveSession(null); }} style={{ background: "#C8FF00", color: "#0e0e0e", border: "none", borderRadius: 2, padding: "12px 24px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap" }}>
              + Log Session
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 40px" }}>
        {[["workouts", "Workouts"], ["weight", "Weight & BMI"], ["profile", "Profile"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ background: "none", border: "none", borderBottom: tab === key ? "2px solid #C8FF00" : "2px solid transparent", color: tab === key ? "#C8FF00" : "rgba(255,255,255,0.35)", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, letterSpacing: 3, textTransform: "uppercase", padding: "14px 20px 12px", cursor: "pointer", marginBottom: -1 }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: "0 40px" }}>

        {/* WORKOUTS TAB */}
        {tab === "workouts" && <>
          <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
            <StatCard label="Sessions" value={sessions.length} sub="YMCA + home" />
            <StatCard label="Total Sets" value={totalSets} sub="across all sessions" />
            <StatCard label="Exercises" value={sessions.reduce((a, s) => a + (s.exercises || []).length, 0)} sub="movements logged" />
            <StatCard label="Last Session" value={lastSession ? shortDate(lastSession.date) : "—"} sub={lastSession ? formatDate(lastSession.date) : ""} />
          </div>

          {adding && (
            <div style={{ marginTop: 32, background: "rgba(200,255,0,0.04)", border: "1px solid rgba(200,255,0,0.2)", borderRadius: 2, padding: 28 }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 20, color: "#C8FF00" }}>New Session</div>
              <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Date</label>
                  <input type="date" style={inp} value={newSession.date} onChange={e => setNewSession(s => ({ ...s, date: e.target.value }))} />
                </div>
                <div style={{ flex: 2, minWidth: 200 }}>
                  <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Location</label>
                  <input type="text" style={inp} value={newSession.location} onChange={e => setNewSession(s => ({ ...s, location: e.target.value }))} placeholder="YMCA with Susan" />
                </div>
              </div>
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
                <button onClick={() => setAdding(false)} style={{ background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 2, color: "rgba(255,255,255,0.5)", padding: "11px 20px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
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
            <StatCard label="Current Weight" value={latestW ? `${latestW.kg} kg` : "—"} sub={latestW ? formatDate(latestW.date) : ""} />
            <StatCard label="BMI" value={currentBMI || "—"} sub={bmiCat?.label} accent={bmiCat?.color} />
            <StatCard label="Change" value={weightChange !== null ? `${parseFloat(weightChange) > 0 ? "+" : ""}${weightChange} kg` : "—"} sub={`since ${firstW ? shortDate(firstW.date) : "start"}`} accent={weightChange !== null ? (parseFloat(weightChange) < 0 ? "#C8FF00" : parseFloat(weightChange) > 0 ? "#f87171" : "#fff") : "#fff"} />
            <StatCard label="To Target" value={toTarget !== null ? `${toTarget} kg` : "—"} sub={`target: ${targetKg} kg (BMI ${targetBMI})`} accent="#facc15" />
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
                  ? <>Losing <span style={{ color: "#facc15" }}>{toTarget} kg</span> reaches BMI {targetBMI} at <span style={{ color: "#C8FF00" }}>{targetKg} kg</span>.</>
                  : parseFloat(toTarget) < 0
                    ? <>Target reached — you're <span style={{ color: "#C8FF00" }}>{Math.abs(toTarget)} kg</span> under your BMI {targetBMI} goal.</>
                    : <>You're exactly at your BMI {targetBMI} target of <span style={{ color: "#C8FF00" }}>{targetKg} kg</span>.</>
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

          <div style={{ marginTop: 20, background: "rgba(200,255,0,0.04)", border: "1px solid rgba(200,255,0,0.15)", borderRadius: 2, padding: 24 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16, color: "#C8FF00" }}>Log Weight</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Date</label>
                <input type="date" style={inp} value={newWeightDate} onChange={e => setNewWeightDate(e.target.value)} />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Weight (kg)</label>
                <input type="number" step="0.1" placeholder="e.g. 105.5" style={inp} value={newWeight} onChange={e => setNewWeight(e.target.value)} onKeyDown={e => e.key === "Enter" && logWeight()} />
              </div>
              <div style={{ flex: 1, minWidth: 100 }}>
                <label style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Body Fat %</label>
                <input type="number" step="0.1" placeholder="e.g. 22.5" style={inp} value={newBodyFat} onChange={e => setNewBodyFat(e.target.value)} onKeyDown={e => e.key === "Enter" && logWeight()} />
              </div>
              <button onClick={logWeight} style={{ background: "#C8FF00", color: "#0e0e0e", border: "none", borderRadius: 2, padding: "9px 22px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", height: 38, flexShrink: 0 }}>Save</button>
            </div>
          </div>

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
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700 }}>{w.kg} kg</div>
                      <div style={{ fontSize: 12, color: cat.color, fontStyle: "italic" }}>BMI {b} · {cat.label}</div>
                      {w.body_fat_pct != null && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "'Barlow Condensed', sans-serif" }}>{w.body_fat_pct}% body fat</div>}
                      {diff !== null && <div style={{ fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", color: parseFloat(diff) < 0 ? "#C8FF00" : parseFloat(diff) > 0 ? "#f87171" : "rgba(255,255,255,0.3)" }}>{parseFloat(diff) > 0 ? "+" : ""}{diff} kg</div>}
                    </div>
                    <button onClick={() => deleteWeight(w.date)} style={{ background: "none", border: "none", color: "rgba(255,80,80,0.4)", cursor: "pointer", fontSize: 16, padding: "0 4px", flexShrink: 0 }}>×</button>
                  </div>
                );
              })}
            </div>
          </div>
        </>}

        {/* PROFILE TAB */}
        {tab === "profile" && (
          <ProfileTab user={user} profile={profile} onSave={p => setProfile(p)} onSignOut={signOut} />
        )}

      </div>
    </div>
  );
}
