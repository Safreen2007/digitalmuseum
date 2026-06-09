import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vfzzuvqdnvduugkyxdix.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmenp1dnFkbnZkdXVna3l4ZGl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NDY5OTksImV4cCI6MjA5NjMyMjk5OX0.ES4IaiFltUBh6_iXIGJeTJPJehXQKLiu8jSM8nAJCeE";
const ADMIN_PASSWORD = "artlinesfull";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ORB_PALETTES = [
  { core:"#e879f9", mid:"#a855f7", outer:"#7c3aed" },
  { core:"#f472b6", mid:"#ec4899", outer:"#be185d" },
  { core:"#60a5fa", mid:"#3b82f6", outer:"#1d4ed8" },
  { core:"#34d399", mid:"#10b981", outer:"#065f46" },
  { core:"#fb923c", mid:"#f97316", outer:"#c2410c" },
  { core:"#facc15", mid:"#eab308", outer:"#854d0e" },
  { core:"#f87171", mid:"#ef4444", outer:"#991b1b" },
  { core:"#a78bfa", mid:"#8b5cf6", outer:"#5b21b6" },
];
function orbPalette(id) {
  if (!id) return ORB_PALETTES[0];
  let h = 0; const s = String(id);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return ORB_PALETTES[h % ORB_PALETTES.length];
}

async function sbFetch(path, opts = {}) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
      Prefer: opts.prefer || "return=representation",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
async function insertVisitor(name, email, px) {
  const d = await sbFetch("visitors", { method:"POST", body:JSON.stringify({ name, avatar_key:"orb", position_x:px, email: email||null }) });
  return d?.[0];
}
async function updateVisitor(id, px) {
  await sbFetch("visitors?id=eq."+id, { method:"PATCH", body:JSON.stringify({ position_x:px, last_seen:new Date().toISOString() }), prefer:"return=minimal" });
}
async function deleteVisitor(id) {
  await sbFetch("visitors?id=eq."+id, { method:"DELETE", prefer:"return=minimal" });
}
async function getActiveVisitors() {
  const since = new Date(Date.now()-30000).toISOString();
  return (await sbFetch("visitors?last_seen=gte."+since+"&select=*")) || [];
}
async function getTotalCount() {
  const res = await fetch(SUPABASE_URL+"/rest/v1/visitors?select=id", {
    headers:{ apikey:SUPABASE_KEY, Authorization:"Bearer "+SUPABASE_KEY, "Content-Type":"application/json", Prefer:"count=exact" },
  });
  const c = res.headers.get("content-range");
  if (c) { const m = c.match(/\/(\d+)/); return m ? parseInt(m[1]) : 0; }
  return 0;
}
async function getLikes() {
  const d = await sbFetch("painting_likes?select=*");
  const map = {}; (d||[]).forEach(r => { map[r.painting_id] = r.count; }); return map;
}
async function doLike(id, cur) {
  await sbFetch("painting_likes?painting_id=eq."+id, { method:"PATCH", body:JSON.stringify({ count:(cur||0)+1 }), prefer:"return=minimal" });
}
async function getStrokes() {
  const d = await sbFetch("canvas_strokes?select=*&order=created_at.asc&limit=1000");
  return (d||[]).map(r => {
    try { return typeof r.stroke_data==="string" ? JSON.parse(r.stroke_data) : r.stroke_data; }
    catch(e) { return null; }
  }).filter(Boolean);
}
async function saveStroke(s) {
  await sbFetch("canvas_strokes", { method:"POST", body:JSON.stringify({ stroke_data:JSON.stringify(s) }) });
}
async function clearAllStrokes() {
  await sbFetch("canvas_strokes?id=gt.0", { method:"DELETE", prefer:"return=minimal" });
}
async function logVisitor(name, email) {
  await sbFetch("visitor_log", { method:"POST", body:JSON.stringify({ name, email }), prefer:"return=minimal" });
}
async function logLike(name, email, paintingId, paintingTitle) {
  await sbFetch("likes_log", { method:"POST", body:JSON.stringify({ name, email, painting_id:paintingId, painting_title:paintingTitle }), prefer:"return=minimal" });
}
async function logDrawing(name, email) {
  await sbFetch("drawing_log", { method:"POST", body:JSON.stringify({ name, email }), prefer:"return=minimal" });
}
async function hasAgreedToTerms(email) {
  const d = await sbFetch("terms_agreements?email=eq."+encodeURIComponent(email)+"&select=id");
  return d && d.length > 0;
}
async function recordAgreement(name, email) {
  await sbFetch("terms_agreements", { method:"POST", body:JSON.stringify({ name, email }), prefer:"return=minimal" });
}

function TermsScreen({ name, email, onAgree }) {
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vis,     setVis    ] = useState(false);
  useEffect(() => { setTimeout(() => setVis(true), 80); }, []);
  const handleAgree = async () => {
    if (!checked) return;
    setLoading(true);
    try { await recordAgreement(name, email); onAgree(); }
    catch(e) { console.error(e); setLoading(false); }
  };
  return (
    <div style={{ position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Cormorant Garamond',serif",padding:"20px",overflow:"hidden" }}>
      <div style={{ position:"absolute",inset:0,background:"url('/bg.png') center/cover no-repeat",zIndex:0 }}/>
      <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.65)",zIndex:1 }}/>
      <div style={{ position:"absolute",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(180,50,30,0.12) 0%,transparent 70%)",top:"10%",left:"10%",filter:"blur(50px)",pointerEvents:"none" }}/>
      <div style={{ position:"absolute",width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,rgba(120,40,100,0.1) 0%,transparent 70%)",bottom:"10%",right:"10%",filter:"blur(50px)",pointerEvents:"none" }}/>
      <div style={{ position:"relative",zIndex:2,maxWidth:600,width:"100%",opacity:vis?1:0,transform:vis?"none":"translateY(20px)",transition:"all 0.9s ease 0.1s" }}>
        <div style={{ textAlign:"center",marginBottom:28 }}>
          <div style={{ width:60,height:1,background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)",margin:"0 auto 20px" }}/>
          <div style={{ fontSize:10,letterSpacing:6,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",marginBottom:10 }}>Before You Enter</div>
          <h2 style={{ fontSize:"clamp(24px,4vw,36px)",fontWeight:300,color:"#fff",letterSpacing:1 }}>Visitor Agreement</h2>
          <div style={{ width:60,height:1,background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)",margin:"16px auto 0" }}/>
        </div>
        <div style={{ background:"rgba(255,255,255,0.05)",backdropFilter:"blur(12px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:16,padding:"28px 32px",marginBottom:24,maxHeight:340,overflowY:"auto" }}>
          <div style={{ fontSize:13,color:"rgba(255,255,255,0.7)",lineHeight:1.9,letterSpacing:0.3 }}>
            <p style={{ color:"rgba(255,255,255,0.5)",fontSize:11,letterSpacing:3,textTransform:"uppercase",marginBottom:16 }}>Zafreen's Gallery — Visitor Code of Conduct</p>
            <p style={{ marginBottom:14 }}>Welcome to Zafreen's Gallery, an interactive art experience featuring original works by the artist. By entering this space, you agree to engage with this gallery — and its collaborative drawing board — in a manner that is respectful, constructive, and in good faith.</p>
            <p style={{ color:"rgba(255,255,255,0.85)",fontWeight:600,marginBottom:8,letterSpacing:1 }}>1. Identity & Accountability</p>
            <p style={{ marginBottom:14 }}>Your Google account credentials are collected upon entry. Your name and email address are permanently associated with all activity you perform within this gallery, including any content you contribute to the collaborative canvas. This information is retained by the artist for accountability purposes.</p>
            <p style={{ color:"rgba(255,255,255,0.85)",fontWeight:600,marginBottom:8,letterSpacing:1 }}>2. Collaborative Canvas</p>
            <p style={{ marginBottom:14 }}>The drawing board is a shared creative space intended for respectful artistic expression. You agree not to use the canvas to draw, write, or otherwise contribute any content that is offensive, obscene, hateful, sexually explicit, or otherwise inappropriate. This includes but is not limited to: slurs, profanity, graphic imagery, or content targeting any individual or group.</p>
            <p style={{ color:"rgba(255,255,255,0.85)",fontWeight:600,marginBottom:8,letterSpacing:1 }}>3. Moderation & Enforcement</p>
            <p style={{ marginBottom:14 }}>The artist reserves the right to remove any content from the canvas at any time without notice. Visitors who violate this agreement may be identified by their registered email address and reported or blocked from future access. By proceeding, you acknowledge that your contributions are not anonymous.</p>
            <p style={{ color:"rgba(255,255,255,0.85)",fontWeight:600,marginBottom:8,letterSpacing:1 }}>4. Respect for the Art</p>
            <p style={{ marginBottom:14 }}>All paintings displayed in this gallery are original works by the artist. You agree not to reproduce, redistribute, or claim ownership of any artwork featured herein without the explicit written consent of the artist.</p>
            <p style={{ color:"rgba(255,255,255,0.85)",fontWeight:600,marginBottom:8,letterSpacing:1 }}>5. Acceptance</p>
            <p>By checking the box below and clicking "Agree & Enter", you confirm that you have read, understood, and agree to abide by this Visitor Agreement. This agreement is recorded against your registered email address and applies to all future visits.</p>
          </div>
        </div>
        <div onClick={()=>setChecked(v=>!v)} style={{ display:"flex",alignItems:"flex-start",gap:12,cursor:"pointer",marginBottom:24,padding:"12px 16px",background:"rgba(255,255,255,0.04)",borderRadius:10,border:`1px solid ${checked?"rgba(255,200,100,0.4)":"rgba(255,255,255,0.1)"}`,transition:"all 0.2s" }}>
          <div style={{ width:20,height:20,borderRadius:4,border:`2px solid ${checked?"rgba(255,200,100,0.8)":"rgba(255,255,255,0.3)"}`,background:checked?"rgba(255,200,100,0.2)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1,transition:"all 0.2s" }}>
            {checked && <span style={{ color:"rgba(255,200,100,0.9)",fontSize:13,lineHeight:1 }}>✓</span>}
          </div>
          <span style={{ fontSize:13,color:"rgba(255,255,255,0.95)",lineHeight:1.6,letterSpacing:0.3 }}>I have read and agree to the Visitor Agreement. I understand that my identity is recorded and that I am responsible for all content I contribute to this gallery.</span>
        </div>
        <div style={{ textAlign:"center" }}>
          <button onClick={handleAgree} disabled={!checked||loading}
            style={{ background:checked?"linear-gradient(135deg,rgba(200,80,40,0.9),rgba(150,40,100,0.9))":"rgba(255,255,255,0.08)",border:`1px solid ${checked?"rgba(255,255,255,0.3)":"rgba(255,255,255,0.1)"}`,color:checked?"#fff":"rgba(255,255,255,0.6)",padding:"14px 48px",fontFamily:"'Cormorant Garamond',serif",fontSize:14,letterSpacing:5,textTransform:"uppercase",cursor:checked?"pointer":"not-allowed",borderRadius:40,transition:"all 0.3s",opacity:loading?0.7:1 }}>
            {loading ? "Recording..." : "Agree & Enter Gallery"}
          </button>
          <div style={{ marginTop:12,fontSize:11,color:"rgba(255,255,255,0.6)",letterSpacing:2 }}>Signed in as {email}</div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
* { box-sizing:border-box; margin:0; padding:0; }
body { overflow:hidden; }
@keyframes orbPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.14)} }
@keyframes orbDrift { 0%,100%{transform:translateY(0) translateX(0)} 33%{transform:translateY(-12px) translateX(7px)} 66%{transform:translateY(5px) translateX(-9px)} }
@keyframes nameTag { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(-3px)} }
@keyframes orbGlow { 0%,100%{opacity:0.5} 50%{opacity:1} }
@keyframes orbIn { from{opacity:0;transform:translateX(-50%) translateY(20px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
@keyframes floatDust { 0%{transform:translateY(0);opacity:0} 20%{opacity:0.4} 80%{opacity:0.15} 100%{transform:translateY(-100px) translateX(18px);opacity:0} }
@keyframes heartPop { 0%{transform:scale(1)} 30%{transform:scale(1.6)} 60%{transform:scale(0.85)} 100%{transform:scale(1)} }
@keyframes brushBounce { 0%,100%{transform:translateY(0) rotate(-15deg)} 50%{transform:translateY(-6px) rotate(-15deg)} }
@keyframes fadeIn { from{opacity:0} to{opacity:1} }
@keyframes slideUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
@keyframes modalIn { from{opacity:0;transform:scale(0.9)} to{opacity:1;transform:scale(1)} }
.enter-btn:hover { background:rgba(255,255,255,0.28) !important; }
.name-input:focus { outline:none; border-bottom:1px solid rgba(255,255,255,0.9) !important; }
.brush-btn:hover { transform:scale(1.15) rotate(-15deg) !important; }
.google-btn:hover { background:rgba(255,255,255,0.95) !important; transform:translateY(-1px); box-shadow:0 6px 20px rgba(0,0,0,0.3) !important; }
canvas { touch-action:none; -webkit-touch-callout:none; -webkit-user-select:none; user-select:none; }
@media (max-width:768px) {
  .desktop-bg-video { display:none !important; }
  .about-card { border-radius:14px !important; }
}
@media (min-width:769px) {
  .mobile-bg-img { display:none !important; }
}
.about-card:hover { transform:scale(1.01); }
`;

const PAINTINGS = [
  { id:1, title:"Monsoon Veranda",   year:"2022", medium:"Acrylic on canvas",          desc:"A lush tropical downpour seen from a sheltered veranda.",      aspect:"3/4", src:"/paintings2/monsoon-veranda.png" },
  { id:2, title:"Golden Road",        year:"2022", medium:"Acrylic on canvas",          desc:"A winding path through golden fields under a stormy sky.",     aspect:"3/4", src:"/paintings2/golden-road.png" },
  { id:3, title:"The Lighthouse",     year:"2023", medium:"Acrylic on canvas",          desc:"A solitary lighthouse on dark rocky shores.",                  aspect:"3/4", src:"/paintings2/lighthouse.png" },
  { id:4, title:"Flower Market",      year:"2023", medium:"Acrylic on canvas",          desc:"An explosion of market blooms from above.",                    aspect:"4/3", src:"/paintings2/flower-market.png" },
  { id:5, title:"Storm at Sea",       year:"2023", medium:"Acrylic on canvas",          desc:"Violent waves beneath a blood-red moon.",                      aspect:"3/4", src:"/paintings2/storm-at-sea.png" },
  { id:6, title:"Tea by the Nile",    year:"2023", medium:"Acrylic on canvas",          desc:"Two Turkish tea glasses catching afternoon light.",             aspect:"3/5", src:"/paintings2/tea-by-the-nile.png" },
  { id:7, title:"Pomegranate Table",  year:"2024", medium:"Acrylic on canvas",          desc:"Pomegranates on a kilim rug, seeds scattered like rubies.",    aspect:"3/4", src:"/paintings2/pomegranate-table.png" },
  { id:8, title:"Two Birds",          year:"2024", medium:"Acrylic on popsicle sticks", desc:"Two jewel-toned birds on a blossom branch.",                   aspect:"2/1", src:"/paintings2/two-birds.png" },
  { id:9, title:"Koi Pond",           year:"2024", medium:"Acrylic on canvas",          desc:"A koi pond: lily pads, magenta water lilies, two orange koi.", aspect:"3/4", src:"/paintings2/koi-pond.png" },
];

const DUST = Array.from({length:12},(_,i)=>({ id:i, x:Math.random()*100, y:5+Math.random()*80, s:1+Math.random()*1.5, d:10+Math.random()*14, dl:Math.random()*10 }));
function Dust() {
  return (
    <div style={{ position:"fixed",inset:0,pointerEvents:"none",zIndex:2,overflow:"hidden" }}>
      {DUST.map(p=><div key={p.id} style={{ position:"absolute",left:p.x+"%",top:p.y+"%",width:p.s,height:p.s,borderRadius:"50%",background:"rgba(255,220,180,0.45)",animation:`floatDust ${p.d}s ${p.dl}s infinite ease-in-out` }}/>)}
    </div>
  );
}

// ── About Screen ──────────────────────────────────────────────────────────────
const ABOUT_SLIDES = [
  {
    src: "/goldenroadlighthousepomegranate.mp4",
    ratio: "portrait",
    text: `"Hi, I'm Zafreen — a 19 year old girl who is just trying to be good at something." Growing up I was the kid who did all sorts of artistic activities. "Used to" is such a sad phrase — so let's try to change that, one painting at a time.`,
  },
  {
    src: "/teastormatthesea.mp4",
    ratio: "portrait",
    text: `I feel like painting is one of the arts that doesn't need an open stage to perform — every piece is unique and your very own masterpiece. I stopped painting for a long time because, as my Instagram bio says, it really makes me overthink.`,
  },
  {
    src: "/koifishflowershop.mp4",
    ratio: "landscape",
    text: `I sometimes feel it would only be a matter of time before I end up being one of those brilliant, slightly unhinged artists — but this gallery is also a fight against my own thoughts. Every painting comes with a silent victory. 🤍`,
  },
  {
    src: "/twobirds.mp4",
    ratio: "landscape",
    text: `This gallery is my first experiment — a small corner of the internet where I get to share what I make, quietly and on my own terms. I appreciate every single one of you who stopped by. Thank you for being here. 🎨`,
  },
];

function AboutScreen({ onClose }) {
  const [current, setCurrent] = useState(0);
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) { videoRef.current.load(); videoRef.current.play().catch(()=>{}); }
  }, [current]);

  const slide = ABOUT_SLIDES[current];
  const isPortrait = slide.ratio === "portrait";

  return (
    <div style={{ position:"fixed",inset:0,zIndex:300,background:"url('/bg.png') center/cover no-repeat",fontFamily:"'Cormorant Garamond',serif",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden" }}>



      {/* Header */}
      <div style={{ position:"absolute",top:0,left:0,right:0,zIndex:10,padding:"18px 24px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <div style={{ fontSize:10,letterSpacing:6,color:"rgba(255,255,255,0.3)",textTransform:"uppercase" }}>About the Artist</div>
        <button onClick={onClose} style={{ background:"rgba(255,255,255,0.08)",backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.7)",width:36,height:36,borderRadius:"50%",fontSize:17,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>×</button>
      </div>

      {/* Big card */}
      <div className="about-card" style={{
        position:"relative",
        width: "min(880px, 95vw)",
        borderRadius:24,
        overflow:"hidden",
        boxShadow:"0 40px 100px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.1)",
        transition:"width 0.4s ease, transform 0.3s ease",
        maxHeight:"84vh",
      }}>
        {/* Video */}
        <video ref={videoRef} key={current} autoPlay loop muted playsInline
          style={{ display:"block",width:"100%",height:"clamp(320px,70vh,700px)",objectFit:"cover" }}>
          <source src={slide.src} type="video/mp4"/>
        </video>

        {/* Full overlay — dark gradient everywhere so text reads */}
        <div style={{ position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(0,0,0,0.08) 0%,rgba(0,0,0,0.12) 40%,rgba(0,0,0,0.32) 70%,rgba(0,0,0,0.48) 100%)",pointerEvents:"none" }}/>

        {/* Text — centered in middle of card */}
        <div style={{
          position:"absolute",
          inset:0,
          display:"flex",
          alignItems:"center",
          justifyContent:"center",
          padding:"clamp(28px,5vw,64px)",
          textAlign:"center",
        }}>
          <p style={{
            fontSize:"clamp(11px,1.1vw,13px)",
            color:"rgba(255,255,255,0.92)",
            lineHeight:2.1,
            letterSpacing:"0.12em",
            fontStyle:"italic",
            textShadow:"0 1px 12px rgba(0,0,0,0.8)",
            maxWidth:480,
          }}>
            {slide.text}
          </p>
        </div>

        {/* Counter */}
        <div style={{ position:"absolute",top:16,right:16,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(10px)",borderRadius:20,padding:"4px 14px",fontSize:10,letterSpacing:3,color:"rgba(255,255,255,0.45)",textTransform:"uppercase" }}>
          {current+1} / {ABOUT_SLIDES.length}
        </div>

        {/* Prev arrow */}
        {current > 0 && (
          <button onClick={()=>setCurrent(p=>p-1)}
            style={{ position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",zIndex:10,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff",width:46,height:46,borderRadius:"50%",fontSize:24,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
            ‹
          </button>
        )}
        {/* Next arrow */}
        {current < ABOUT_SLIDES.length-1 && (
          <button onClick={()=>setCurrent(p=>p+1)}
            style={{ position:"absolute",right:16,top:"50%",transform:"translateY(-50%)",zIndex:10,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff",width:46,height:46,borderRadius:"50%",fontSize:24,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
            ›
          </button>
        )}
      </div>

      {/* Dots */}
      <div style={{ position:"absolute",bottom:22,left:"50%",transform:"translateX(-50%)",display:"flex",gap:8 }}>
        {ABOUT_SLIDES.map((_,i)=>(
          <div key={i} onClick={()=>setCurrent(i)}
            style={{ width:i===current?22:7,height:7,borderRadius:4,background:i===current?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.25)",cursor:"pointer",transition:"all 0.3s" }}/>
        ))}
      </div>
    </div>
  );
}

// ── Auth Gate ─────────────────────────────────────────────────────────────────
function AuthGate({ onEnter }) {
  const [name,    setName]    = useState(() => localStorage.getItem("zaf_name") || "");
  const [vis,     setVis]     = useState(false);
  const [shake,   setShake]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [status,  setStatus]  = useState("idle");
  const enteredRef = useRef(false);

  useEffect(() => {
    setTimeout(() => setVis(true), 80);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (enteredRef.current) return;
      if (session?.user) {
        const savedName = localStorage.getItem("zaf_name");
        if (savedName) {
          enteredRef.current = true;
          setStatus("entering");
          onEnter(savedName, session.user.email, session.user.user_metadata?.avatar_url)
            .catch(e => { console.error(e); enteredRef.current = false; setStatus("idle"); setLoading(false); });
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleGo = () => {
    if (!name.trim()) { setShake(true); setTimeout(() => setShake(false), 600); return; }
    localStorage.setItem("zaf_name", name.trim());
    setLoading(true);
    supabase.auth.signInWithOAuth({ provider:"google", options:{ redirectTo: window.location.origin + window.location.pathname } });
  };

  return (
    <div style={{ position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Cormorant Garamond',serif",overflow:"hidden" }}>
      {/* Desktop: video bg */}
      <video autoPlay loop muted playsInline style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",zIndex:0,display:"block" }} className="desktop-bg-video">
        <source src="/bgvideo.mp4" type="video/mp4"/>
      </video>
      {/* Mobile: static image bg */}
      <div className="mobile-bg-img" style={{ position:"absolute",inset:0,background:"url('/bgmobile.png') center/cover no-repeat",zIndex:0 }}/>
      <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.3)",zIndex:1 }}/>

      <div style={{ position:"relative",zIndex:2,textAlign:"center",opacity:vis?1:0,transform:vis?"none":"translateY(22px)",transition:"all 1.1s ease 0.2s",width:"90%",maxWidth:420 }}>
        <div style={{ width:90,height:1,background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.75),transparent)",margin:"0 auto 26px" }}/>
        <div style={{ fontSize:"clamp(7px,1.1vw,10px)",letterSpacing:3,color:"rgba(255,255,255,0.75)",marginBottom:16,fontFamily:"'Press Start 2P',monospace",textTransform:"uppercase",textShadow:"2px 2px 0px rgba(0,0,0,0.5)",lineHeight:1.8 }}>Welcome to</div>
        <h1 style={{ fontSize:"clamp(10px,1.6vw,15px)",fontFamily:"'Press Start 2P',monospace",color:"#fff",lineHeight:1.8,textShadow:"3px 3px 0px rgba(0,0,0,0.5)",marginBottom:4 }}>Zafreen's<br/>Digital Museum</h1>
        <div style={{ width:90,height:1,background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.75),transparent)",margin:"22px auto 38px" }}/>
        {status === "entering" ? (
          <div style={{ color:"rgba(255,255,255,0.6)",fontSize:14,letterSpacing:3,textTransform:"uppercase" }}>Entering gallery...</div>
        ) : (
          <>
            <div style={{ marginBottom:28 }}>
              <div style={{ fontSize:12,letterSpacing:3,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",marginBottom:14 }}>Enter your name to visit</div>
              <input className="name-input" value={name} onChange={e=>setName(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&handleGo()} placeholder="Your name..." autoFocus
                style={{ background:"transparent",border:"none",borderBottom:shake?"1px solid #ff8888":"1px solid rgba(255,255,255,0.4)",color:"#fff",fontSize:22,fontFamily:"'Cormorant Garamond',serif",fontWeight:300,letterSpacing:2,padding:"8px 4px",width:250,textAlign:"center",transition:"border-color 0.3s" }}/>
              {shake&&<div style={{ color:"#ffaaaa",fontSize:11,letterSpacing:2,marginTop:8,textTransform:"uppercase" }}>Please enter your name</div>}
            </div>
            <button className="google-btn" onClick={handleGo} disabled={loading}
              style={{ display:"flex",alignItems:"center",gap:12,background:"#fff",color:"#333",border:"none",borderRadius:8,padding:"13px 28px",fontSize:15,fontWeight:500,cursor:"pointer",boxShadow:"0 4px 14px rgba(0,0,0,0.25)",transition:"all 0.2s",opacity:loading?0.7:1,margin:"0 auto" }}>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {loading ? "Redirecting..." : "Sign in with Google to Enter"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function GlowOrb({ visitor, isMe }) {
  const p = orbPalette(visitor.id);
  const h = String(visitor.id).split("").reduce((a,c)=>a+c.charCodeAt(0),0);
  const dd=5+(h%4), pd=2.5+(h%2), dl=(h%30)/10, bp=8+(h%18);
  return (
    <div style={{ position:"absolute",bottom:bp+"%",left:visitor.position_x+"%",zIndex:isMe?9:7,animation:"orbIn 0.6s ease",transition:"left 2s ease",pointerEvents:"none" }}>
      <div style={{ position:"absolute",bottom:"calc(100% + 10px)",left:"50%",transform:"translateX(-50%)",background:isMe?"rgba(180,60,40,0.85)":"rgba(0,0,0,0.55)",backdropFilter:"blur(8px)",color:"#fff",fontSize:10,letterSpacing:2,padding:"3px 10px",borderRadius:12,whiteSpace:"nowrap",fontFamily:"'Cormorant Garamond',serif",textTransform:"uppercase",animation:"nameTag 3s ease-in-out infinite",border:isMe?"1px solid rgba(255,255,255,0.3)":"1px solid rgba(255,255,255,0.1)" }}>
        {visitor.name}
      </div>
      <div style={{ position:"absolute",width:72,height:72,borderRadius:"50%",background:`radial-gradient(circle,${p.mid}30 0%,transparent 70%)`,filter:"blur(14px)",top:"50%",left:"50%",transform:"translate(-50%,-50%)",animation:`orbGlow ${pd*1.4}s ${dl}s ease-in-out infinite` }}/>
      <div style={{ width:28,height:28,borderRadius:"50%",background:`radial-gradient(circle at 35% 35%,${p.core},${p.mid} 55%,${p.outer})`,boxShadow:`0 0 18px 6px ${p.mid}88,0 0 40px 14px ${p.outer}44`,animation:`orbDrift ${dd}s ${dl}s ease-in-out infinite,orbPulse ${pd}s ${dl}s ease-in-out infinite` }}/>
    </div>
  );
}

function LoopPopup({ onGoCanvas, onStay }) {
  return (
    <div style={{ position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.72)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn 0.4s ease" }}>
      <div style={{ background:"linear-gradient(135deg,rgba(30,10,5,0.97),rgba(20,8,20,0.97))",border:"1px solid rgba(255,255,255,0.15)",borderRadius:20,padding:"52px 48px 44px",maxWidth:520,width:"90%",textAlign:"center",fontFamily:"'Cormorant Garamond',serif",boxShadow:"0 32px 80px rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize:44,marginBottom:20 }}>🎨</div>
        <div style={{ fontSize:11,letterSpacing:6,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",marginBottom:16 }}>A gift from the artist</div>
        <h2 style={{ fontSize:"clamp(22px,4vw,32px)",fontWeight:300,color:"#fff",lineHeight:1.3,marginBottom:18 }}>You've journeyed through<br/>all of Zafreen's paintings</h2>
        <p style={{ fontSize:15,color:"rgba(255,255,255,0.55)",lineHeight:1.7,marginBottom:36,fontStyle:"italic" }}>As a token of appreciation, Zafreen has opened a collaborative drawing board — a shared canvas where visitors from around the world can leave their mark together.</p>
        <div style={{ display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap" }}>
          <button onClick={onGoCanvas} style={{ background:"linear-gradient(135deg,rgba(200,80,40,0.9),rgba(150,40,100,0.9))",border:"1px solid rgba(255,255,255,0.25)",color:"#fff",padding:"14px 34px",fontFamily:"'Cormorant Garamond',serif",fontSize:14,letterSpacing:4,textTransform:"uppercase",cursor:"pointer",borderRadius:40 }}>✦ Open Drawing Board</button>
          <button onClick={onStay} style={{ background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.7)",padding:"14px 34px",fontFamily:"'Cormorant Garamond',serif",fontSize:14,letterSpacing:4,textTransform:"uppercase",cursor:"pointer",borderRadius:40 }}>Stay in Museum</button>
        </div>
      </div>
    </div>
  );
}

function DrawNudge({ onYes, onNo }) {
  return (
    <div style={{ position:"fixed",bottom:86,right:24,zIndex:90,background:"rgba(20,8,4,0.94)",backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:14,padding:"14px 18px",fontFamily:"'Cormorant Garamond',serif",animation:"slideUp 0.35s ease",boxShadow:"0 8px 32px rgba(0,0,0,0.5)",maxWidth:220 }}>
      <div style={{ fontSize:12,color:"rgba(255,255,255,0.6)",letterSpacing:1,marginBottom:10 }}>Visit the drawing board?</div>
      <div style={{ display:"flex",gap:8 }}>
        <button onClick={onYes} style={{ flex:1,background:"rgba(200,80,40,0.7)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff",padding:"7px 0",borderRadius:8,fontSize:12,letterSpacing:2,cursor:"pointer",fontFamily:"'Cormorant Garamond',serif" }}>Yes ✦</button>
        <button onClick={onNo}  style={{ flex:1,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.6)",padding:"7px 0",borderRadius:8,fontSize:12,letterSpacing:2,cursor:"pointer",fontFamily:"'Cormorant Garamond',serif" }}>No</button>
      </div>
    </div>
  );
}

function BrushButton({ onClick }) {
  const [show,setShow]=useState(false);
  return (
    <>
      <button className="brush-btn" onClick={()=>setShow(v=>!v)}
        style={{ position:"fixed",bottom:24,right:24,zIndex:88,width:54,height:54,borderRadius:"50%",background:"linear-gradient(135deg,rgba(220,90,40,0.9),rgba(160,50,120,0.9))",border:"1px solid rgba(255,255,255,0.3)",fontSize:24,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 18px rgba(220,90,40,0.5)",animation:"brushBounce 3s ease-in-out infinite",transform:"rotate(-15deg)" }}>
        🖌️
      </button>
      {show&&<DrawNudge onYes={()=>{ setShow(false); onClick(); }} onNo={()=>setShow(false)}/>}
    </>
  );
}

const DB_COLORS = ["#1a1a1a","#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#ffffff","#64748b","#7c3aed","#0ea5e9","#f472b6","#a3e635","#fb923c","#34d399"];
const DB_TOOLS  = [{id:"pen",label:"✏️"},{id:"brush",label:"🖌️"},{id:"eraser",label:"🧹"}];
const DB_SIZES  = [2,5,10,18,28];
const TOOLBAR_H = 110; // two rows on mobile

function DrawingBoard({ visitorName, authorId, onBack }) {
  const canvasRef   = useRef(null);
  const sizedRef    = useRef(false);
  const isDown      = useRef(false);
  const lastPt      = useRef(null);
  const curStroke   = useRef([]);
  const allStrokes  = useRef([]);
  const myStrokes   = useRef([]);
  const redoStack   = useRef([]);
  const lastCount   = useRef(0);
  const toolRef     = useRef("brush");
  const colorRef    = useRef("#1a1a1a");
  const sizeRef     = useRef(8);
  const labelRef    = useRef(null);
  const [tool,   setToolUI]  = useState("brush");
  const [color,  setColorUI] = useState("#1a1a1a");
  const [size,   setSizeUI]  = useState(8);
  const [online, setOnline]  = useState(0);
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminPw, setAdminPw] = useState("");
  const [adminErr, setAdminErr] = useState(false);
  const setTool  = v => { toolRef.current=v;  setToolUI(v);  };
  const setColor = v => { colorRef.current=v; setColorUI(v); };
  const setSize  = v => { sizeRef.current=v;  setSizeUI(v);  };
  function getCtx() { return canvasRef.current?.getContext("2d") ?? null; }
  function paintStroke(ctx, stroke, W, H) {
    if (!stroke?.points?.length || stroke.points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = stroke.color || "#1a1a1a";
    ctx.lineWidth   = stroke.size;
    ctx.lineCap     = "round"; ctx.lineJoin = "round";
    ctx.globalAlpha = stroke.tool==="brush" ? 0.65 : 1.0;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x * W, stroke.points[0].y * H);
    for (let i=1; i<stroke.points.length; i++) ctx.lineTo(stroke.points[i].x * W, stroke.points[i].y * H);
    ctx.stroke(); ctx.restore();
  }
  function redrawAll() {
    const c = canvasRef.current; if (!c) return;
    const ctx = getCtx(); const W = c.width, H = c.height;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    allStrokes.current.forEach(s => paintStroke(ctx, s, W, H));
  }
  useEffect(() => {
    const c = canvasRef.current; if (!c || sizedRef.current) return;
    // Use visualViewport for mobile to handle address bar correctly
    const vw = window.visualViewport ? window.visualViewport.width  : window.innerWidth;
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    c.width  = vw;
    c.height = vh - TOOLBAR_H;
    sizedRef.current = true;
    const ctx = getCtx(); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
  }, []);
  useEffect(() => {
    const poll = async () => {
      try {
        const all = await getStrokes();
        if (all.length !== lastCount.current) {
          allStrokes.current = all; lastCount.current = all.length;
          myStrokes.current = all.filter(s => s.author === authorId);
          redrawAll();
        }
        const v = await getActiveVisitors(); setOnline(v.length);
      } catch(e) {}
    };
    poll(); const id = setInterval(poll, 3000); return () => clearInterval(id);
  }, []);
  function normPt(e) {
    const c = canvasRef.current; const r = c.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x:(src.clientX-r.left)/c.width, y:(src.clientY-r.top)/c.height };
  }
  function moveLabelTo(e) {
    const label = labelRef.current; if (!label) return;
    const src = e.touches ? e.touches[0] : e;
    label.style.left = (src.clientX + 14) + "px"; label.style.top = (src.clientY - 28) + "px"; label.style.opacity = "1";
  }
  function onDown(e) {
    e.preventDefault(); if (toolRef.current === "eraser") return;
    isDown.current = true; const pt = normPt(e);
    lastPt.current = pt; curStroke.current = [pt]; moveLabelTo(e);
  }
  function onMove(e) {
    e.preventDefault(); if (!isDown.current) return;
    const c = canvasRef.current; if (!c) return;
    const ctx = getCtx(); const pt = normPt(e);
    curStroke.current.push(pt); const prev = lastPt.current;
    ctx.save(); ctx.strokeStyle = colorRef.current; ctx.lineWidth = sizeRef.current;
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.globalAlpha = toolRef.current==="brush" ? 0.65 : 1.0;
    ctx.beginPath(); ctx.moveTo(prev.x*c.width, prev.y*c.height); ctx.lineTo(pt.x*c.width, pt.y*c.height);
    ctx.stroke(); ctx.restore(); lastPt.current = pt; moveLabelTo(e);
  }
  async function onUp(e) {
    if (!isDown.current) return; isDown.current = false;
    if (labelRef.current) labelRef.current.style.opacity = "0";
    if (curStroke.current.length < 2) { curStroke.current=[]; lastPt.current=null; return; }
    const stroke = { points:curStroke.current, color:colorRef.current, size:sizeRef.current, tool:toolRef.current, author:authorId, author_name:visitorName };
    allStrokes.current.push(stroke); myStrokes.current.push(stroke);
    redoStack.current = []; lastCount.current = allStrokes.current.length;
    curStroke.current = []; lastPt.current = null; await saveStroke(stroke);
  }
  const handleUndo = async () => {
    if (myStrokes.current.length === 0) return;
    const last = myStrokes.current[myStrokes.current.length - 1];
    redoStack.current.push(last); myStrokes.current = myStrokes.current.slice(0, -1);
    allStrokes.current = allStrokes.current.filter(s => s !== last); lastCount.current = allStrokes.current.length;
    await sbFetch("canvas_strokes?id=gt.0", { method:"DELETE", prefer:"return=minimal" });
    for (const s of allStrokes.current) await saveStroke(s); redrawAll();
  };
  const handleRedo = async () => {
    if (redoStack.current.length === 0) return;
    const stroke = redoStack.current.pop();
    allStrokes.current.push(stroke); myStrokes.current.push(stroke);
    lastCount.current = allStrokes.current.length; await saveStroke(stroke); redrawAll();
  };
  const handleEraserDown = (e) => { if (toolRef.current !== "eraser") return; e.preventDefault(); eraseAtPoint(e); };
  const handleEraserMove = (e) => { if (toolRef.current !== "eraser' || !e.buttons") return; e.preventDefault(); eraseAtPoint(e); };
  async function eraseAtPoint(e) {
    const c = canvasRef.current; if (!c) return;
    const pt = normPt(e); const threshold = (sizeRef.current * 2) / Math.min(c.width, c.height);
    const toRemove = myStrokes.current.filter(s => s.points.some(p => Math.hypot(p.x - pt.x, p.y - pt.y) < threshold));
    if (toRemove.length === 0) return;
    toRemove.forEach(s => { allStrokes.current = allStrokes.current.filter(x => x !== s); myStrokes.current = myStrokes.current.filter(x => x !== s); redoStack.current.push(s); });
    lastCount.current = allStrokes.current.length;
    await sbFetch("canvas_strokes?id=gt.0", { method:"DELETE", prefer:"return=minimal" });
    for (const s of allStrokes.current) await saveStroke(s); redrawAll();
  }
  const handleAdminClear = async () => {
    if (adminPw === ADMIN_PASSWORD) {
      try {
        await sbFetch("canvas_strokes?id=gt.0", { method:"DELETE", prefer:"return=minimal" });
        allStrokes.current = []; myStrokes.current = []; redoStack.current = []; lastCount.current = 0; redrawAll();
        setShowAdminPrompt(false); setAdminPw(""); setAdminErr(false);
      } catch(e) { console.error(e); }
    } else { setAdminErr(true); }
  };
  const tbBg = "#f7f4ef", tbBord = "#e0dbd2";
  return (
    <div style={{ position:"fixed",inset:0,zIndex:150,background:"#ffffff",animation:"fadeIn 0.3s ease" }}>

      {/* ── Toolbar: two rows on mobile, one row on desktop ── */}
      <div style={{ position:"absolute",top:0,left:0,right:0,zIndex:2,background:tbBg,borderBottom:"1px solid "+tbBord,boxShadow:"0 2px 10px rgba(0,0,0,0.07)" }}>

        {/* Row 1: Back + Tools + Undo/Redo + Sizes + Clear */}
        <div style={{ display:"flex",alignItems:"center",gap:6,padding:"8px 12px",overflowX:"auto",WebkitOverflowScrolling:"touch" }}>
          <button onClick={onBack} style={{ background:"rgba(0,0,0,0.06)",border:"1px solid rgba(0,0,0,0.12)",color:"#555",padding:"8px 12px",borderRadius:8,fontSize:11,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'Cormorant Garamond',serif",flexShrink:0,minHeight:40 }}>← Museum</button>
          <div style={{ width:1,height:30,background:tbBord,flexShrink:0 }}/>
          {DB_TOOLS.map(t=>(<button key={t.id} onClick={()=>setTool(t.id)} style={{ background:tool===t.id?"rgba(0,0,0,0.13)":"rgba(0,0,0,0.04)",border:`1px solid ${tool===t.id?"rgba(0,0,0,0.35)":"rgba(0,0,0,0.1)"}`,borderRadius:8,width:42,height:42,fontSize:18,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s" }}>{t.label}</button>))}
          <button onClick={handleUndo} title="Undo" style={{ background:"rgba(0,0,0,0.04)",border:"1px solid rgba(0,0,0,0.1)",borderRadius:8,width:42,height:42,fontSize:17,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center" }}>↩</button>
          <button onClick={handleRedo} title="Redo" style={{ background:"rgba(0,0,0,0.04)",border:"1px solid rgba(0,0,0,0.1)",borderRadius:8,width:42,height:42,fontSize:17,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center" }}>↪</button>
          <div style={{ width:1,height:30,background:tbBord,flexShrink:0 }}/>
          {DB_SIZES.map(s=>(<button key={s} onClick={()=>setSize(s)} style={{ background:size===s?"rgba(0,0,0,0.13)":"rgba(0,0,0,0.04)",border:`1px solid ${size===s?"rgba(0,0,0,0.35)":"rgba(0,0,0,0.1)"}`,borderRadius:"50%",width:42,height:42,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center" }}><div style={{ width:Math.min(s,26),height:Math.min(s,26),borderRadius:"50%",background:"#333",opacity:size===s?1:0.35 }}/></button>))}
          <div style={{ marginLeft:"auto",fontSize:10,letterSpacing:1,color:"#aaa",whiteSpace:"nowrap",flexShrink:0,fontFamily:"'Cormorant Garamond',serif" }}>{online} together</div>
          <button onClick={()=>{ setShowAdminPrompt(true); setAdminPw(""); setAdminErr(false); }} style={{ background:"rgba(200,40,40,0.08)",border:"1px solid rgba(200,40,40,0.25)",color:"rgba(160,30,30,0.8)",padding:"6px 12px",borderRadius:8,fontSize:11,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,fontFamily:"'Cormorant Garamond',serif",minHeight:40 }}>Clear</button>
        </div>

        {/* Row 2: Colors — full scrollable row */}
        <div style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 12px 8px",overflowX:"auto",WebkitOverflowScrolling:"touch" }}>
          {DB_COLORS.map(c=>(<button key={c} onClick={()=>setColor(c)} style={{ width:28,height:28,borderRadius:"50%",background:c,border:color===c?"3px solid #333":"2px solid rgba(0,0,0,0.15)",cursor:"pointer",flexShrink:0,transition:"transform 0.12s",transform:color===c?"scale(1.25)":"scale(1)",boxShadow:color===c?"0 0 0 2px #fff,0 0 0 4px #555":"none",minWidth:28 }}/>))}
        </div>
      </div>
      <div style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:"clamp(14px,2.5vw,22px)",letterSpacing:8,color:"rgba(0,0,0,0.04)",textTransform:"uppercase",pointerEvents:"none",whiteSpace:"nowrap",fontFamily:"'Cormorant Garamond',serif",userSelect:"none",zIndex:1 }}>Zafreen's Collaborative Canvas</div>
      <canvas ref={canvasRef} style={{ position:"absolute",top:TOOLBAR_H,left:0,display:"block",cursor:tool==="eraser"?"cell":"crosshair",touchAction:"none",zIndex:3 }}
        onMouseDown={e=>{ onDown(e); handleEraserDown(e); }} onMouseMove={e=>{ onMove(e); handleEraserMove(e); }}
        onMouseUp={onUp} onMouseLeave={onUp} onTouchStart={e=>{ onDown(e); handleEraserDown(e); }} onTouchMove={e=>{ onMove(e); handleEraserMove(e); }} onTouchEnd={onUp}/>
      <div ref={labelRef} style={{ position:"fixed",pointerEvents:"none",zIndex:10,background:"rgba(0,0,0,0.65)",color:"#fff",fontSize:11,letterSpacing:2,padding:"3px 10px",borderRadius:10,fontFamily:"'Cormorant Garamond',serif",textTransform:"uppercase",whiteSpace:"nowrap",backdropFilter:"blur(4px)",opacity:0,transition:"opacity 0.15s",top:0,left:0 }}>{visitorName}</div>
      {showAdminPrompt && (
        <div style={{ position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn 0.2s ease" }}>
          <div style={{ background:"#fff",borderRadius:16,padding:"32px 36px",textAlign:"center",fontFamily:"'Cormorant Garamond',serif",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",minWidth:300 }}>
            <div style={{ fontSize:28,marginBottom:12 }}>🔒</div>
            <div style={{ fontSize:16,letterSpacing:2,color:"#333",marginBottom:20 }}>Admin Access Required</div>
            <input value={adminPw} onChange={e=>{ setAdminPw(e.target.value); setAdminErr(false); }} onKeyDown={e=>e.key==="Enter"&&handleAdminClear()} type="password" placeholder="Enter password..." style={{ width:"100%",padding:"10px 14px",border:adminErr?"1px solid #ef4444":"1px solid #ddd",borderRadius:8,fontSize:14,fontFamily:"'Cormorant Garamond',serif",letterSpacing:2,marginBottom:8,outline:"none" }} autoFocus/>
            {adminErr && <div style={{ color:"#ef4444",fontSize:12,marginBottom:10 }}>Incorrect password</div>}
            <div style={{ display:"flex",gap:10,marginTop:12 }}>
              <button onClick={()=>{ setShowAdminPrompt(false); setAdminPw(""); setAdminErr(false); }} style={{ flex:1,padding:"10px",border:"1px solid #ddd",borderRadius:8,background:"#f5f5f5",cursor:"pointer",fontFamily:"'Cormorant Garamond',serif",fontSize:13,letterSpacing:2 }}>Cancel</button>
              <button onClick={handleAdminClear} style={{ flex:1,padding:"10px",border:"none",borderRadius:8,background:"#ef4444",color:"#fff",cursor:"pointer",fontFamily:"'Cormorant Garamond',serif",fontSize:13,letterSpacing:2 }}>Clear All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function wrap(min,max,v){ const r=max-min; return ((((v-min)%r)+r)%r)+min; }

function FocusRail({ paintings, likes, onLike, onActivePainting, onLooped }) {
  const [active,setActive]=useState(0);
  const lwt=useRef(0), hasLooped=useRef(false), drag=useRef(null);
  const count=paintings.length, ai=wrap(0,count,active);
  useEffect(()=>{ onActivePainting(paintings[ai]); },[ai]);
  const next=useCallback(()=>{
    setActive(p=>{ const n=p+1; if(!hasLooped.current&&wrap(0,count,n)===0){ hasLooped.current=true; setTimeout(()=>onLooped(),300); } return n; });
  },[count,onLooped]);
  const prev=useCallback(()=>setActive(p=>p-1),[]);
  const onWheel=useCallback((e)=>{
    const now=Date.now(); if(now-lwt.current<400)return;
    const d=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;
    if(Math.abs(d)>20){ d>0?next():prev(); lwt.current=now; }
  },[next,prev]);
  return (
    <div style={{ position:"relative",width:"100%",height:"100%",overflow:"hidden",outline:"none" }}
      onWheel={onWheel} tabIndex={0}
      onKeyDown={e=>{ if(e.key==="ArrowLeft")prev(); if(e.key==="ArrowRight")next(); }}
      onMouseDown={e=>{ drag.current=e.clientX; }}
      onMouseUp={e=>{ if(drag.current===null)return; const d=drag.current-e.clientX; if(Math.abs(d)>50)d>0?next():prev(); drag.current=null; }}>
      <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",perspective:"1200px",zIndex:1 }}>
        {[-2,-1,0,1,2].map(offset=>{
          const idx=wrap(0,count,active+offset), p=paintings[idx];
          const isCtr=offset===0, dist=Math.abs(offset);
          return (
            <div key={active+offset} onClick={()=>{ if(offset!==0)setActive(a=>a+offset); }}
              style={{ position:"absolute",width:isCtr?320:210,transform:`translateX(${offset*300}px) translateZ(${-dist*160}px) scale(${isCtr?1:0.82}) rotateY(${offset*-18}deg)`,opacity:isCtr?1:Math.max(0.1,1-dist*0.45),filter:`blur(${isCtr?0:dist*5}px)`,transition:"all 0.45s cubic-bezier(0.34,1.56,0.64,1)",zIndex:isCtr?10:5-dist,cursor:isCtr?"default":"pointer",borderRadius:12 }}>
              <div style={{ position:"relative",borderRadius:12,overflow:"hidden",boxShadow:isCtr?"0 24px 64px rgba(0,0,0,0.6)":"0 8px 24px rgba(0,0,0,0.4)",border:"1px solid rgba(255,255,255,0.15)" }}>
                <img src={p.src} alt={p.title} style={{ display:"block",width:"100%",aspectRatio:p.aspect,objectFit:"cover" }} draggable={false}/>
                <div style={{ position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(255,255,255,0.06) 0%,transparent 40%)",pointerEvents:"none" }}/>
                {isCtr&&(
                  <div style={{ position:"absolute",bottom:10,right:10 }}>
                    <button onClick={e=>{ e.stopPropagation(); onLike(p.id); }}
                      style={{ background:likes[p.id]>0?"rgba(200,40,40,0.88)":"rgba(0,0,0,0.5)",backdropFilter:"blur(6px)",border:likes[p.id]>0?"1px solid rgba(255,120,120,0.5)":"1px solid rgba(255,255,255,0.25)",borderRadius:22,padding:"7px 16px",display:"flex",alignItems:"center",gap:7,cursor:"pointer",animation:likes[p.id]>0?"heartPop 0.4s ease":"none" }}>
                      <span style={{ fontSize:16 }}>{likes[p.id]>0?"❤️":"🤍"}</span>
                      <span style={{ color:"#fff",fontSize:13,fontFamily:"'Cormorant Garamond',serif",letterSpacing:1 }}>{likes[p.id]>0?likes[p.id]:"Show love"}</span>
                    </button>
                  </div>
                )}
              </div>
              {isCtr&&(
                <div style={{ marginTop:14,textAlign:"center",fontFamily:"'Cormorant Garamond',serif",color:"#fff" }}>
                  <div style={{ fontSize:20,fontWeight:300,letterSpacing:0.5,textShadow:"0 1px 8px rgba(0,0,0,0.5)" }}>{p.title}</div>
                  <div style={{ fontSize:11,letterSpacing:4,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",marginTop:4 }}>{p.medium} · {p.year}</div>
                  <div style={{ fontSize:12,color:"rgba(255,255,255,0.4)",fontStyle:"italic",marginTop:6,maxWidth:220,margin:"6px auto 0" }}>{p.desc}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button onClick={prev} style={{ position:"absolute",left:20,top:"45%",transform:"translateY(-50%)",zIndex:20,background:"rgba(0,0,0,0.35)",backdropFilter:"blur(6px)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff",width:40,height:40,borderRadius:"50%",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>‹</button>
      <button onClick={next} style={{ position:"absolute",right:20,top:"45%",transform:"translateY(-50%)",zIndex:20,background:"rgba(0,0,0,0.35)",backdropFilter:"blur(6px)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff",width:40,height:40,borderRadius:"50%",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>›</button>
      <div style={{ position:"absolute",bottom:16,left:"50%",transform:"translateX(-50%)",zIndex:20,color:"rgba(255,255,255,0.6)",fontSize:11,letterSpacing:3,fontFamily:"'Cormorant Garamond',serif" }}>{ai+1} / {count}</div>
    </div>
  );
}

export default function ZafreenMuseum() {
  const [visitorName,    setVisitorName]    = useState(null);
  const [authorId,       setAuthorId]       = useState(null);
  const [myId,           setMyId]           = useState(null);
  const [visitors,       setVisitors]       = useState([]);
  const [totalVisitors,  setTotalVisitors]  = useState(0);
  const [likes,          setLikes]          = useState({});
  const [activePainting, setActivePainting] = useState(PAINTINGS[0]);
  const [showAbout,      setShowAbout]      = useState(false);
  const [showLoopPopup,  setShowLoopPopup]  = useState(false);
  const [brushUnlocked,  setBrushUnlocked]  = useState(false);
  const [showCanvas,     setShowCanvas]     = useState(false);
  const [pendingEntry,   setPendingEntry]   = useState(null);
  const [showTerms,      setShowTerms]      = useState(false);
  const loopShownRef=useRef(false), myXRef=useRef(null), hbRef=useRef(null), pRef=useRef(null), lpRef=useRef(null);

  useEffect(()=>{
    const cleanup=async()=>{ if(myId)await deleteVisitor(myId); };
    window.addEventListener("beforeunload",cleanup);
    return ()=>{ window.removeEventListener("beforeunload",cleanup); cleanup(); [hbRef,pRef,lpRef].forEach(r=>clearInterval(r.current)); };
  },[myId]);

  const handleEnter=async(name, email, avatar)=>{
    try {
      const agreed = await hasAgreedToTerms(email);
      if (!agreed) { setPendingEntry({ name, email, avatar }); setShowTerms(true); return; }
    } catch(e) { console.error(e); }
    await completeEntry(name, email, avatar);
  };

  const completeEntry = async (name, email, avatar) => {
    const px=8+Math.random()*84; myXRef.current=px;
    const v=await insertVisitor(name, email, px); if(!v)throw new Error("fail");
    setMyId(v.id); setVisitorName(name); setAuthorId(email||name);
    setTotalVisitors(await getTotalCount());
    try { await logVisitor(name, email); } catch(e) {}
    const fv=async()=>{ try{setVisitors(await getActiveVisitors());}catch(e){} };
    const fl=async()=>{ try{setLikes(await getLikes());}catch(e){} };
    fv(); fl();
    pRef.current=setInterval(fv,4000); lpRef.current=setInterval(fl,5000);
    hbRef.current=setInterval(async()=>{ try{await updateVisitor(v.id,myXRef.current);}catch(e){} },10000);
    localStorage.removeItem("zaf_name");
    setShowTerms(false); setPendingEntry(null);
  };

  const handleLike=async(id)=>{
    const cur=likes[id]||0;
    setLikes(p=>({...p,[id]:(p[id]||0)+1}));
    await doLike(id,cur);
    try { const painting=PAINTINGS.find(p=>p.id===id); await logLike(visitorName,authorId,id,painting?.title||""); } catch(e) {}
  };

  const handleLooped=()=>{ if(loopShownRef.current)return; loopShownRef.current=true; setShowLoopPopup(true); };

  if(!visitorName && !showTerms) return <><style>{CSS}</style><AuthGate onEnter={handleEnter}/></>;
  if(showTerms && pendingEntry)   return <><style>{CSS}</style><TermsScreen name={pendingEntry.name} email={pendingEntry.email} onAgree={()=>completeEntry(pendingEntry.name, pendingEntry.email, pendingEntry.avatar)}/></>;
  if(showCanvas) return <><style>{CSS}</style><DrawingBoard visitorName={visitorName} authorId={authorId} onBack={()=>setShowCanvas(false)}/></>;

  return (
    <div style={{ position:"fixed",inset:0,overflow:"hidden",fontFamily:"'Cormorant Garamond',serif" }}>
      <style>{CSS}</style>
      <div style={{ position:"absolute",inset:0,zIndex:0,overflow:"hidden" }}>
        <img key={activePainting.id} src={activePainting.src} alt="" style={{ width:"100%",height:"100%",objectFit:"cover",filter:"blur(52px) saturate(160%) brightness(0.42)",transform:"scale(1.12)" }}/>
        <div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 30%,rgba(0,0,0,0) 0%,rgba(0,0,0,0.6) 100%)" }}/>
        <div style={{ position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(8,3,1,0) 0%,rgba(8,3,1,0.5) 70%,rgba(8,3,1,0.8) 100%)" }}/>
      </div>
      <Dust/>
      <div style={{ position:"absolute",top:0,left:0,right:0,zIndex:10,padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <div style={{ display:"flex",alignItems:"center",gap:16 }}>
          <div style={{ fontSize:11,letterSpacing:6,color:"rgba(255,255,255,0.65)",textTransform:"uppercase" }}>Zafreen's Gallery</div>
          <div style={{ position:"relative",display:"flex",alignItems:"center",gap:10 }}>
            <button onClick={()=>setShowAbout(true)} style={{ background:"rgba(255,255,255,0.08)",backdropFilter:"blur(6px)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.55)",padding:"5px 14px",borderRadius:20,fontSize:10,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:"'Cormorant Garamond',serif",transition:"all 0.2s" }}>✦ About</button>
            <span style={{ fontSize:10,color:"rgba(255,255,255,0.35)",fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif",letterSpacing:1,whiteSpace:"nowrap",animation:"fadeIn 2s ease" }}>← learn about the artist</span>
          </div>
        </div>
        <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2 }}>
          <div style={{ fontSize:11,letterSpacing:3,color:"rgba(255,255,255,0.5)",textTransform:"uppercase" }}>Welcome, {visitorName}</div>
          <div style={{ fontSize:10,letterSpacing:2,color:"rgba(255,255,255,0.3)",textTransform:"uppercase" }}>{visitors.length} online · {totalVisitors} total visits</div>
        </div>
      </div>
      <div style={{ position:"absolute",top:0,left:0,right:0,bottom:"24%",zIndex:3 }}>
        <FocusRail paintings={PAINTINGS} likes={likes} onLike={handleLike} onActivePainting={setActivePainting} onLooped={handleLooped}/>
      </div>
      <div style={{ position:"absolute",bottom:0,left:0,right:0,height:"28%",zIndex:5,pointerEvents:"none" }}>
        {visitors.map(v=><GlowOrb key={v.id} visitor={v} isMe={v.id===myId}/>)}
      </div>
      {showAbout&&<AboutScreen onClose={()=>setShowAbout(false)}/>}
      {showLoopPopup&&<LoopPopup onGoCanvas={()=>{ setShowLoopPopup(false); setBrushUnlocked(true); setShowCanvas(true); try{logDrawing(visitorName,authorId);}catch(e){} }} onStay={()=>{ setShowLoopPopup(false); setBrushUnlocked(true); }}/>}
      {brushUnlocked&&!showLoopPopup&&<BrushButton onClick={()=>{ setShowCanvas(true); try{logDrawing(visitorName,authorId);}catch(e){} }}/>}
    </div>
  );
}