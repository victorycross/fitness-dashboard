import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "./supabase.js";
const USER_HEIGHT_M = 1.7018;
const EMPTY_EXERCISE = { name: "", sets: "", reps: "", weight: "" };
const calcBMI = (kg) => (kg / (USER_HEIGHT_M * USER_HEIGHT_M)).toFixed(1);
function bmiCategory(b) {
  if (b < 18.5) return { label: "Underweight", color: "#60a5fa" };
  if (b < 25) return { label: "Normal", color: "#C8FF00" };
  if (b < 30) return { label: "Overweight", color: "#facc15" };
  return { label: "Obese", color: "#f87171" };
}
function formatDate(d) { return new Date(d + "T00:00:00").toLocaleDateString("en-CA", {weekday:"short",month:"short",day:"numeric",year:"numeric"}); }
function shortDate(d) { return new Date(d + "T00:00:00").toLocaleDateString("en-CA", {month:"short",day:"numeric"}); }
function StatCard({ label, value, sub, accent }) {
  return (<div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:2,padding:"20px 24px",minWidth:120,flex:1}}><div style={{color:accent||"#C8FF00",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,letterSpacing:3,textTransform:"uppercase",marginBottom:8}}>{label}</div><div style={{color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontSize:40,fontWeight:700,lineHeight:1}}>{value}</div>{sub&&<div style={{color:"rgba(255,255,255,0.4)",fontSize:12,marginTop:6,fontStyle:"italic"}}>{sub}</div>}</div>);
}
const CustomTooltip = ({active,payload}) => {
  if(!active||!payload?.length) return null;
  const kg=payload[0].value; const b=parseFloat(calcBMI(kg)); const cat=bmiCategory(b);
  return(<div style={{background:"#1a1a1a",border:"1px solid rgba(200,255,0,0.3)",borderRadius:2,padding:"10px 14px"}}><div style={{color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:700}}>{kg} kg</div><div style={{color:cat.color,fontSize:11,marginTop:2}}>BMI {b} · {cat.label}</div></div>);
};
export default function App() {
  const [sessions,setSessions]=useState([]);
  const [weights,setWeights]=useState([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("workouts");
  const [activeSession,setActiveSession]=useState(null);
  const [adding,setAddin