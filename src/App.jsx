import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "./supabase.js";

// ─── Constants ───────────────────────────────────────────────────────────────
const USER_HEIGHT_M = 1.7018; // 5'7"
const EMPTY_EXERCISE = { name: "", sets: "", reps: "", weight: "" };

// ─── Helpers ─────────────────────────────────────────────────────────────────
const calcBMI = (kg) => (kg / (USER_HEIGHT_M * USER_HEIGHT_M)).toFixed(1);

function bmiCategory(b) {
  if (b < 18.5) return { label: "Underweight", color: "#60a5fa" };
  if (b < 25)   return { label: "Normal",      color: "#C8FF00" };
  if (b < 30)   return { label: "Overweight",  color: "#facc15" };
  return               { label: "Obese",        color: "#f87171" };
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function shortDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

// ─── Sub-components ──────────────────────────────────────────────────────────
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
  const b = parseFloat(calcBMI(kg));
  const cat = bmiCategory(b);
  return (
    <div style={{ background: "#1a1a1a", border: "1px solid rgba(200,255,0,0.3)", borderRadius: 2, padding: "10px 14px" }}>
      <div style={{ color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700 }}>{kg} kg</div>
      <div style={{ color: cat.color, fontSize: 11, marginTop: 2 }}>BMI {b} · {cat.label}</div>
    </div>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [sessions, setSessions]       = useState([]);
  const [weights, setWeights]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [tab, seTTab]                 = useState("workouts");
  const [activeSession, setActiveSession] = useState(null);
  const [adding, setAdding]           = useState(false);
  const [newSession, setNewSession]   = useState({ date: "", location: "YMCA with Susan", exercises: [{ ...EMPTY_EXERCISE }] });
  const [newWeight, setNewWeight]     = useState("");
  const [newWeightDate, setNewWeightDate] = useState(new Date().toISOString().split("T")[0]);
  const [toast, setToast]             = useState("");
  const [error, setError]             = useState("");

  // ── Load data from Supabase ──
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: sessData, error: sessErr }, { data: wtData, error: wtErr }] = await Promise.all([
        supabase.from("workout_sessions").select("*").order("date", { ascending: false }),
        supabase.from("weight_log").select("*").order("date", { ascending: true }),
      ]);
      if (sessErr) throw sessErr;
      if (wtErr)   throw wtErr;
      setSessions(sessData || []);
      setWeights(wtData || []);
    } catch (e) {
      setError("Failed to load data: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 2500); }

  // ── Workout helpers ──
  const totalSets = sessions.reduce((a, s) => a + (s.exercises || []).reduce((b, e) => b + Number(e.sets || 0), 0), 0);
  const lastSession = sessions[0]; // already ordered desc

  function addExRow()        { setNewSession(s => ({ ...s, exercises: [...s.exercises, { ...EMPTY_EXERCISE }] })); }
  function removeExRow(i)    { setNewSession(s => ({ ...s, exercises: s.exercises.filter((_, idx) => idx !== i) })); }
  function updateEx(i, f, v) { setNewSession(s => { const e = [...s.exercises]; e[i] = { ...e[i], [f]: v }; return { ...s, exercises: e }; }); }

  async function saveSession() {
    if (!newSession.date || newSession.exercises.some(e => !e.name)) return;
    const record = {
      id: Date.now(),
      date: newSession.date,
      label: `Session #${sessions.length + 1}`,
      location: newSession.location || "YMCA with Susan",
      exercises: newSession.exercises,
    };
    const { error: e } = await supabase.from("workout_sessions").insert(record);
    if (e) { setError("Save failed: " + e.message); return; }
    setAdding(false);
    setNewSession({ date: "", location: "YMCA with Susan", exercises: [{ ...EMPTY_EXERCISE }] });
    showToast("SESSION SAVED ✓");
    loadData();
  }

  async function deleteSession(id) {
    const { error: e } = await supabase.from("workout_sessions").delete().eq("id", id);
    if (e) { setError("Delete failed: " + e.message); return; }
    if (activeSession === id) setActiveSession(null);
    loadData();
  }

  // ── Weight helpers ──
  const sortedW   = [...weights].sort((a, b) => a.date > b.date ? 1 : -1);
  const latestW   = sortedW[sortedW.length - 1];
  const firstW    = sortedW[0];
  const weightChange  = latestW && firstW && latestW.date !== firstW.date ? (latestW.kg - firstW.kg).toFixed(1) : null;
  const currentBMI    = latestW ? parseFloat(calcBMI(latestW.kg)) : null;
  const bmiCat        = currentBMI ? bmiCategory(currentBMI) : null;
  const targetKg      = (24.9 * USER_HEIGHT_M * USER_HEIGHT_M).toFixed(1);
  const toTarget      = latestW ? (latestW.kg - parseFloat(targetKg)).toFixed(1) : null;

  async function logWeight() {
    const kg = parseFloat(newWeight);
    if (!newWeight || isNaN(kg)) return;
    const { error: e } = await supabase.from("weight_log").upsert({ date: newWeightDate, kg }, { onConflict: "date" });
    if (e) { setError("Save failed: " + e.message); return; }
    setNewWeight("");
    showToast("WEIGHT LOGGED ✓");
    loadData();
  }

  async function deleteWeight(date) {
    const { error: e } = await supabase.from("weight_log").delete().eq("date", date);
    if (e) { setError("Delete failed: " + e.message); return; }
    loadData();
  }

  function bmiLeft(b) { return `${Math.min(98, Math.max(2, ((b - 16) / (45 - 16)) * 100))}%`; }

  // ── Shared styles ──
  const inp = {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 2, color: "#fff", padding: "8px 12px", fontSize: 13,
    fontFamily: "Georgia, serif", width: "100%",
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0e0e0e", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, letterSpacing: 4 }}>
      LOADING…
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0e0e0e", color: "#fff", fontFamily: "Georgia, serif", paddingBottom: 80 }}>

      {/* Toast */}
      {toast && <div style={{ position: "fixed", bottom: 32, right: 32, background: "#C8FF00", color: "#0e0e0e", padding: "12px 24px", borderRadius: 2, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: 2, zIndex: 100 }}>{toast}</div>}

      {/* Error */}
      {error && (
        <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", padding: "12px 24px", fontSize: 13, color: "#f87171", display: "flex", justifyContent: "space-between" }}>
          {error}
          <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 16 }}>×</button>
        </div>
      )}

      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "32px 40px 28px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ color: "#C8FF00", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 4, textTransform: "uppercase", marginBottom: 6 }}>Training Log</div>
          <h1 style={{ margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 48, fontWeight: 900, lineHeight: 1, letterSpacing: -1 }}>
            Dave's <span style={{ color: "#C8FF00" }}>Fitness</span> Dashboard
          </h1>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 8, fontStyle: "italic" }}>McDonald YMCA · Trainer: Susan Jadidi · 5′7″</div>
        </div>
        {tab === "workouts" && (
          <button onClick={() => { setAdding(true); setActiveSession(null); }} style={{ background: "#C8FF00", color: "#0e0e0e", border: "none", borderRadius: 2, padding: "12px 24px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
            + Log Session
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 40px" }}>
        {[["workouts", "Workouts"], ["weight", "Weight & BMI"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ background: "none", border: "none", borderBottom: tab === key ? "2px solid #C8FF00" : "2px solid transparent", color: tab === key ? "#C8FF00" : "rgba(255,255,255,0.35)", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, letterSpacing: 3, textTransform: "uppercase", padding: "14px 20px 12px", cursor: "pointer", marginBottom: -1 }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: "0 40px" }}>

        {/* ── WORKOUTS TAB ── */}
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
                  <input type="text" style={inp} value={newSession.location} onChange={e => setNewSession(s => ({ ...s, location: e.target.value }))} />
                </div>
              </div>
              <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>Exercises</div>
              {newSession.exercises.map((ex, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input placeholder="Exercise name" style={{ ...inp, flex: 3, minWidth: 140 }} value={ex.name} onChange={e => updateEx(i, "name", e.target.value)} />
                  <input placeholder="Sets"          style={{ ...inp, flex: 1, minWidth: 55  }} value={ex.sets} onChange={e => updateEx(i, "sets", e.target.value)} />
                  <input placeholder="Reps"          style={{ ...inp, flex: 1, minWidth: 55  }} value={ex.reps} onChange={e => updateEx(i, "reps", e.target.value)} />
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
                        <thead>
                          <tr>{["#", "Exercise", "Sets", "Reps", "Weight / Notes"].map(h => (
                            <th key={h} style={{ textAlign: "left", fontSize: 10, letterSpacing: 2, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 400 }}>{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody>
                          {(session.exercises || []).map((ex, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <td style={{ padding: "10px 8px", color: "rgba(255,255,255,0.25)", fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif" }}>{i + 1}</td>
                              <td style={{ padding: "10px 8px", color: "#fff", fontSize: 14 }}>{ex.name}</td>
                              <td style={{ padding: "10px 8px", color: "#C8FF00", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 600 }}>{ex.sets}</td>
                              <td style={{ padding: "10px 8px", color: "rgba(255,255,255,0.7)", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16 }}>{ex.reps}</td>
                              <td style={{ padding: "10px 8px", color: "rgba(255,255,255,0.7)", fontSize: 13, fontStyle: "italic" }}>{ex.weight}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button onClick={() => deleteSession(session.id)} style={{ marginTop: 12, background: "none", border: "1px solid rgba(255,60,60,0.2)", borderRadius: 2, color: "rgba(255,80,80,0.5)", padding: "6px 14px", fontSize: 11, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", letterSpacing: 1 }}>Delete Session</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>}

        {/* ── WEIGHT & BMI TAB ── */}
        {tab === "weight" && <>
          <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
            <StatCard label="Current Weight" value={latestW ? `${latestW.kg} kg` : "—"} sub={latestW ? formatDate(latestW.date) : ""} />
            <StatCard label="BMI" value={currentBMI || "—"} sub={bmiCat?.label} accent={bmiCat?.color} />
            <StatCard label="Change" value={weightChange !== null ? `${parseFloat(weightChange) > 0 ? "+" : ""}${weightChange} kg` : "—"} sub={`since ${firstW ? shortDate(firstW.date) : "start"}`} accent={weightChange !== null ? (parseFloat(weightChange) < 0 ? "#C8FF00" : parseFloat(weightChange) > 0 ? "#f87171" : "#fff") : "#fff"} />
            <StatCard label="To Target" value={toTarget !== null ? `${toTarget} kg` : "—"} sub={`target: ${targetKg} kg (BMI 24.9)`} accent="#facc15" />
          </div>

          {currentBMI && (
            <div style={{ marginTop: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, padding: "20px 24px" }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>BMI Scale</div>
              <div style={{ position: "relative", height: 10, borderRadius: 5, background: "linear-gradient(to right, #60a5fa 0% 20%, #C8FF00 20% 52%, #facc15 52% 72%, #f87171 72% 100%)" }}>
                <div style={{ position: "absolute", top: -4, left: bmiLeft(currentBMI), transform: "translateX(-50%)", width: 18, height: 18, borderRadius: "50%", background: "#fff", border: "3px solid #0e0e0e", boxShadow: "0 0 0 2px " + bmiCat.color }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>
                <span>Under &lt;18.5</span><span>Normal 18.5–24.9</span><span>Over 25–29.9</span><span>Obese ≥30</span>
              </div>
              <div style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.6)", fontStyle: "italic", lineHeight: 1.6 }}>
                Current BMI <span style={{ color: bmiCat.color, fontWeight: "bold" }}>{currentBMI} ({bmiCat.label})</span>. Losing <span style={{ color: "#facc15" }}>{toTarget} kg</span> reaches BMI 24.9 at <span style={{ color: "#C8FF00" }}>{targetKg} kg</span>.
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
              <button onClick={logWeight} style={{ background: "#C8FF00", color: "#0e0e0e", border: "none", borderRadius: 2, padding: "9px 22px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", height: 38, flexShrink: 0 }}>Save</button>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>History</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {[...sortedW].reverse().map((w, i) => {
                const b = parseFloat(calcBMI(w.kg));
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
                      {diff !== null && <div style={{ fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", color: parseFloat(diff) < 0 ? "#C8FF00" : parseFloat(diff) > 0 ? "#f87171" : "rgba(255,255,255,0.3)" }}>{parseFloat(diff) > 0 ? "+" : ""}{diff} kg</div>}
                    </div>
                    <button onClick={() => deleteWeight(w.date)} style={{ background: "none", border: "none", color: "rgba(255,80,80,0.4)", cursor: "pointer", fontSize: 16, padding: "0 4px", flexShrink: 0 }}>×</button>
                  </div>
                );
              })}
            </div>
          </div>
        </>}
      </div>
    </div>
  );
}
