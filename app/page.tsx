"use client";

import { useEffect, useRef, useState } from "react";

type Node3D = { x:number; y:number; z:number; r:number; label:string; group:string; color:string };
type StoredItem = { id:number; kind:string; title:string; content:string; project:string; done:number|boolean; created_at:string };

const nodes: Node3D[] = [
  {x:-90,y:-40,z:40,r:17,label:"Plantfriend",group:"Projekt",color:"#37d8ff"},
  {x:95,y:-15,z:65,r:20,label:"MainWiesen",group:"Projekt",color:"#147dff"},
  {x:-25,y:60,z:110,r:14,label:"Videoideen",group:"Plantfriend",color:"#9b70ff"},
  {x:-125,y:75,z:-10,r:12,label:"Wildkräuter",group:"Plantfriend",color:"#25d8a2"},
  {x:45,y:-105,z:30,r:13,label:"Shorts",group:"Plantfriend",color:"#ff4eaf"},
  {x:145,y:65,z:-20,r:16,label:"Events",group:"MainWiesen",color:"#27c3ff"},
  {x:85,y:120,z:80,r:10,label:"Farid",group:"Person",color:"#ffd36a"},
  {x:-160,y:-95,z:50,r:11,label:"Brunnen",group:"MainWiesen",color:"#52a2ff"},
  {x:15,y:15,z:145,r:22,label:"Paddo",group:"Person",color:"#eefaff"},
  {x:165,y:-85,z:40,r:12,label:"Aufgaben",group:"System",color:"#ff875e"},
  {x:-20,y:-145,z:-20,r:10,label:"Termine",group:"System",color:"#ffd23f"},
  {x:-65,y:125,z:-65,r:12,label:"Dokumente",group:"Wissen",color:"#49e1c1"},
  {x:125,y:10,z:-105,r:9,label:"Kontakte",group:"Wissen",color:"#7aa7ff"},
  {x:-145,y:10,z:-95,r:8,label:"Ideen",group:"Wissen",color:"#b578ff"},
  {x:25,y:145,z:-85,r:8,label:"Notizen",group:"Wissen",color:"#ff5ca8"},
];

function BrainGraph() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const rot = useRef({x:-.12,y:.45}); const drag = useRef<{x:number;y:number}|null>(null);
  const [active,setActive] = useState<Node3D|null>(null);
  useEffect(()=>{
    const c=canvas.current!; const ctx=c.getContext("2d")!; let raf=0; let projected:any[]=[];
    const resize=()=>{const d=devicePixelRatio||1; const r=c.getBoundingClientRect();c.width=r.width*d;c.height=r.height*d;ctx.setTransform(d,0,0,d,0,0)};
    const draw=()=>{ const w=c.clientWidth,h=c.clientHeight;ctx.clearRect(0,0,w,h); const cy=Math.cos(rot.current.y),sy=Math.sin(rot.current.y),cx=Math.cos(rot.current.x),sx=Math.sin(rot.current.x);
      projected=nodes.map(n=>{let x=n.x*cy-n.z*sy,z=n.x*sy+n.z*cy;let y=n.y*cx-z*sx;z=n.y*sx+z*cx;const s=1200/(620+z);return {...n,px:w/2+x*s,py:h/2+y*s,pz:z,s}}).sort((a,b)=>b.pz-a.pz);
      ctx.strokeStyle="rgba(46,151,255,.2)";ctx.lineWidth=.8;
      for(let i=0;i<projected.length;i++)for(let j=i+1;j<projected.length;j++){const a=projected[i],b=projected[j];if(a.group===b.group||Math.abs(i-j)<2){ctx.beginPath();ctx.moveTo(a.px,a.py);ctx.lineTo(b.px,b.py);ctx.stroke()}}
      projected.forEach(n=>{const rr=Math.max(4,n.r*n.s*1.8);const g=ctx.createRadialGradient(n.px-rr*.3,n.py-rr*.3,1,n.px,n.py,rr*1.3);g.addColorStop(0,"#fff");g.addColorStop(.18,n.color);g.addColorStop(1,"rgba(8,25,50,.15)");ctx.fillStyle=g;ctx.shadowBlur=18;ctx.shadowColor=n.color;ctx.beginPath();ctx.arc(n.px,n.py,rr,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;if(rr>8){ctx.font=`${Math.max(9,rr*.52)}px var(--font-geist-sans)`;ctx.fillStyle="rgba(232,247,255,.9)";ctx.textAlign="center";ctx.fillText(n.label,n.px,n.py+rr+14)}});
      if(!drag.current)rot.current.y+=.0015;raf=requestAnimationFrame(draw)};
    resize();draw();addEventListener("resize",resize);
    const down=(e:PointerEvent)=>{drag.current={x:e.clientX,y:e.clientY};c.setPointerCapture(e.pointerId)};
    const move=(e:PointerEvent)=>{if(!drag.current)return;rot.current.y+=(e.clientX-drag.current.x)*.006;rot.current.x+=(e.clientY-drag.current.y)*.006;drag.current={x:e.clientX,y:e.clientY}};
    const up=(e:PointerEvent)=>{if(drag.current&&Math.hypot(e.clientX-drag.current.x,e.clientY-drag.current.y)<5){const r=c.getBoundingClientRect();let hit=[...projected].reverse().find(n=>Math.hypot(e.clientX-r.left-n.px,e.clientY-r.top-n.py)<Math.max(10,n.r*n.s*2));if(hit)setActive(hit)}drag.current=null};
    c.addEventListener("pointerdown",down);c.addEventListener("pointermove",move);c.addEventListener("pointerup",up);
    return()=>{cancelAnimationFrame(raf);removeEventListener("resize",resize);c.removeEventListener("pointerdown",down);c.removeEventListener("pointermove",move);c.removeEventListener("pointerup",up)}
  },[]);
  return <div className="brain-stage"><canvas ref={canvas} aria-label="Interaktives dreidimensionales Wissensnetz"/><div className="brain-top"><span>SECOND BRAIN // 3D MAP</span><span className="online">● 15 KNOTEN AKTIV</span></div><div className="brain-help">ZIEHEN: DREHEN&nbsp;&nbsp;•&nbsp;&nbsp;KLICKEN: ÖFFNEN</div>{active&&<button className="node-info" onClick={()=>setActive(null)}><b>{active.label}</b><small>{active.group} · Knoten öffnen →</small></button>}</div>
}

function DataPanel({kind}:{kind:"note"|"task"}) {
  const [items,setItems]=useState<StoredItem[]>([]); const [title,setTitle]=useState(""); const [content,setContent]=useState(""); const [project,setProject]=useState("Allgemein"); const [busy,setBusy]=useState(true); const [error,setError]=useState("");
  const load=async()=>{setBusy(true);setError("");try{const r=await fetch(`/api/items?kind=${kind}`);const d=await r.json();if(!r.ok)throw new Error(d.error);setItems(d.items||[])}catch(e){setError(e instanceof Error?e.message:"Verbindung fehlgeschlagen")}finally{setBusy(false)}};
  useEffect(()=>{load()},[kind]);
  const add=async()=>{if(!title.trim())return;setBusy(true);try{const r=await fetch("/api/items",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({kind,title,content,project})});const d=await r.json();if(!r.ok)throw new Error(d.error);setItems(v=>[d.item,...v]);setTitle("");setContent("")}catch(e){setError(e instanceof Error?e.message:"Speichern fehlgeschlagen")}finally{setBusy(false)}};
  const toggle=async(item:StoredItem)=>{await fetch("/api/items",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:item.id,done:!item.done})});setItems(v=>v.map(x=>x.id===item.id?{...x,done:!x.done}:x))};
  const remove=async(id:number)=>{await fetch(`/api/items?id=${id}`,{method:"DELETE"});setItems(v=>v.filter(x=>x.id!==id))};
  return <div className="data-panel"><div className="panel-title"><div><span>J.A.R.V.I.S. // {kind==="note"?"WISSENSSPEICHER":"TASK CONTROL"}</span><h2>{kind==="note"?"Gedächtnis & Notizen":"Aufgaben"}</h2></div><b>{items.length} EINTRÄGE</b></div>
    <div className="composer"><div><input value={title} onChange={e=>setTitle(e.target.value)} placeholder={kind==="note"?"Was soll ich mir merken?":"Neue Aufgabe …"}/><select value={project} onChange={e=>setProject(e.target.value)}><option>Allgemein</option><option>Plantfriend</option><option>MainWiesen</option><option>Privat</option></select></div><textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="Details, Gedanken oder Kontext …"/><button onClick={add} disabled={busy}>{kind==="note"?"IM SECOND BRAIN SPEICHERN":"AUFGABE ANLEGEN"}</button></div>
    {error&&<div className="system-error">⚠ {error}</div>}{busy&&items.length===0?<div className="empty">VERBINDE MIT GEDÄCHTNIS …</div>:items.length===0?<div className="empty">NOCH KEINE EINTRÄGE — J.A.R.V.I.S. IST BEREIT</div>:<div className="item-grid">{items.map(item=><article key={item.id} className={item.done?"done":""}><div className="item-meta"><span>{item.project}</span><small>{new Date(item.created_at+"Z").toLocaleDateString("de-DE")}</small></div><h3>{item.title}</h3>{item.content&&<p>{item.content}</p>}<div className="item-actions">{kind==="task"&&<button onClick={()=>toggle(item)}>{item.done?"↻ REAKTIVIEREN":"✓ ERLEDIGT"}</button>}<button onClick={()=>remove(item.id)}>× LÖSCHEN</button></div></article>)}</div>}
  </div>
}

function VaultPanel({onUnlocked}:{onUnlocked:(password:string)=>void}) {
  const [configured,setConfigured]=useState<boolean|null>(null); const [apiKey,setApiKey]=useState(""); const [password,setPassword]=useState(""); const [repeat,setRepeat]=useState(""); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
  useEffect(()=>{fetch("/api/vault").then(r=>r.json()).then(d=>setConfigured(Boolean(d.configured))).catch(()=>setConfigured(false))},[]);
  const save=async()=>{setMessage("");if(password.length<8){setMessage("Das Tresor-Passwort braucht mindestens 8 Zeichen.");return}if(password!==repeat){setMessage("Die Passwörter stimmen nicht überein.");return}setBusy(true);try{const r=await fetch("/api/vault",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({apiKey,password})});const d=await r.json();if(!r.ok)throw new Error(d.error);sessionStorage.setItem("jarvis-vault",password);onUnlocked(password);setConfigured(true);setApiKey("");setMessage("API-Verbindung eingerichtet. Der Tresor ist für diese Sitzung entsperrt.")}catch(e){setMessage(e instanceof Error?e.message:"Einrichtung fehlgeschlagen")}finally{setBusy(false)}};
  const unlock=()=>{if(password.length<8){setMessage("Bitte gib dein Tresor-Passwort ein.");return}sessionStorage.setItem("jarvis-vault",password);onUnlocked(password);setMessage("Tresor für diese Sitzung entsperrt.")};
  return <div className="data-panel vault-panel"><div className="panel-title"><div><span>J.A.R.V.I.S. // SECURE CORE</span><h2>KI-Verbindung</h2></div><b>{configured?"● KEY VERSCHLÜSSELT":"○ SETUP ERFORDERLICH"}</b></div><div className="vault-card"><div className="vault-icon">⌾</div><div><label>{configured?"TRESOR ENTSPERREN":"OPENAI API-KEY SICHER HINTERLEGEN"}</label><h3>{configured?"Dein Key ist verschlüsselt gespeichert":"Einmalige Einrichtung"}</h3><p>{configured?"Gib dein Tresor-Passwort ein. Es bleibt nur bis zum Schließen dieses Browser-Tabs verfügbar.":"Der API-Key wird vor dem Speichern mit AES-256 verschlüsselt. J.A.R.V.I.S. kann ihn nur mit deinem Tresor-Passwort verwenden."}</p></div></div>{!configured&&<input className="vault-input" type="password" autoComplete="off" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="OpenAI API-Key (sk-…)"/>}<input className="vault-input" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Tresor-Passwort (mindestens 8 Zeichen)"/>{!configured&&<input className="vault-input" type="password" autoComplete="new-password" value={repeat} onChange={e=>setRepeat(e.target.value)} placeholder="Tresor-Passwort wiederholen"/>}<button className="vault-button" onClick={configured?unlock:save} disabled={busy}>{busy?"VERSCHLÜSSELE …":configured?"TRESOR ENTSPERREN":"KEY VERSCHLÜSSELT SPEICHERN"}</button>{message&&<div className="vault-message">{message}</div>}<p className="vault-warning">Wichtig: Vergisst du das Tresor-Passwort, kann der gespeicherte Key nicht wiederhergestellt werden. Du kannst ihn dann nur durch einen neuen Key ersetzen.</p></div>
}

const nav=[['◈','Zentrale'],['◉','Second Brain'],['⌁','Gedächtnis'],['✓','Aufgaben'],['▱','Dateien'],['▦','Kalender'],['⬡','Projekte'],['⌾','System']];

export default function Home(){
 const [tab,setTab]=useState('Zentrale'); const [listening,setListening]=useState(false); const [input,setInput]=useState(''); const [messages,setMessages]=useState<{who:string;text:string}[]>([]); const [vaultPassword,setVaultPassword]=useState(''); const [thinking,setThinking]=useState(false); const [chatError,setChatError]=useState('');
 const [clock,setClock]=useState({date:'',time:''});
 useEffect(()=>{setVaultPassword(sessionStorage.getItem("jarvis-vault")||"")},[]);
 useEffect(()=>{const update=()=>{const now=new Date();setClock({date:new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',weekday:'short',day:'2-digit',month:'short'}).format(now).replace(/\./g,'').toUpperCase(),time:new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit',hour12:false}).format(now)})};update();const id=setInterval(update,1000);return()=>clearInterval(id)},[]);
 const speak=()=>{if(listening){setListening(false);return}setListening(true);if('speechSynthesis'in window)speechSynthesis.speak(new SpeechSynthesisUtterance('Ich höre zu, Paddo.'));const Recognition=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(Recognition){const recognition=new Recognition();recognition.lang="de-DE";recognition.interimResults=false;recognition.onresult=(e:any)=>setInput(e.results[0][0].transcript);recognition.onend=()=>setListening(false);recognition.onerror=()=>setListening(false);recognition.start()}else setTimeout(()=>setListening(false),1800)};
 const send=async()=>{const text=input.trim();if(!text||thinking)return;if(!vaultPassword){setTab('System');setChatError('Entsperre zuerst den KI-Tresor.');return}setMessages(m=>[...m,{who:'Du',text}]);setInput('');setThinking(true);setChatError('');try{const r=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:text,password:vaultPassword,history:messages.slice(-8)})});const d=await r.json();if(!r.ok)throw new Error(d.error);setMessages(m=>[...m,{who:'J.A.R.V.I.S.',text:d.text}]);if('speechSynthesis'in window){const utterance=new SpeechSynthesisUtterance(d.text);utterance.lang='de-DE';speechSynthesis.speak(utterance)}}catch(e){setChatError(e instanceof Error?e.message:'KI-Verbindung fehlgeschlagen')}finally{setThinking(false)}};
 const coreState=listening?'listening':thinking?'thinking':messages.length?'active':'idle';
 const quickCapture=()=>{if(!input.trim())return;setTab('Gedächtnis')};
 return <main className="shell cyber-shell">
  <aside><div className="brand-mark">J</div><div className="nav">{nav.map(([i,n])=><button key={n} className={tab===n?'active':''} onClick={()=>setTab(n)}><span>{i}</span>{n}</button>)}</div><div className="secure"><i/> PRIVAT & VERSCHLÜSSELT<small>Nur für Paddo</small></div></aside>
  <section className="workspace">
   <header><div><h1>J.A.R.V.I.S.</h1><p>PRIVATE NEURAL INTERFACE</p></div><div className="sys"><span>{clock.date||'--'}</span><b>{clock.time||'--:--'}</b><em>● SYSTEM ONLINE</em></div></header>
   {tab==='Second Brain'?<BrainGraph/>:tab==='Gedächtnis'?<DataPanel kind="note"/>:tab==='Aufgaben'?<DataPanel kind="task"/>:tab==='System'?<VaultPanel onUnlocked={setVaultPassword}/>:<div className="hud-dashboard">
    <div className="hud-status" aria-label="Systemstatus"><div><small>AI CORE</small><b className="cyan">{thinking?'74':'18'}%</b><i><u style={{width:thinking?'74%':'18%'}}/></i></div><div><small>MEMORY INDEX</small><b>2.48 GB</b><i><u style={{width:'61%'}}/></i></div><div><small>NEURAL SYNC</small><b className="green">● SYNCHRON</b><span>LATENZ 24 MS</span></div><div className="hud-location"><small>NODE // BERLIN</small><b>{clock.time||'--:--'}</b><span>{clock.date||'--'}</span></div></div>
    <div className="hud-grid">
     <section className="hud-left">
      <button className="hud-widget knowledge-widget" onClick={()=>setTab('Second Brain')}><div className="corner-label"><span>KNOWLEDGE GRAPH</span><b>15 NODES</b></div><div className="mini-universe"><i/><i/><i/><i/><i/><i/><svg viewBox="0 0 300 180" aria-hidden="true"><path d="M54 122L112 74L160 105L225 43M112 74L76 34M160 105L236 139M160 105L191 73"/></svg><strong>SECOND<br/>BRAIN</strong></div><small>INTERAKTIVE 3D-ANSICHT ÖFFNEN →</small></button>
      <div className="hud-widget quick-widget"><div className="corner-label"><span>QUICK CAPTURE</span><b>READY</b></div><p>Gedanken sofort sichern</p><button onClick={speak} aria-label="Sprachnotiz starten">◉</button><input value={input} onChange={e=>setInput(e.target.value)} placeholder="Notiz oder Idee erfassen …"/><button className="capture-action" onClick={quickCapture}>INBOX →</button></div>
      <div className="hud-widget project-widget"><div className="corner-label"><span>ACTIVE DOMAINS</span><b>02</b></div><p><i className="dot plant"/>Plantfriend <span>68%</span></p><p><i className="dot main"/>MainWiesen <span>42%</span></p></div>
     </section>
     <section className="hud-console">
      <div className="console-head"><span>NEURAL CONSOLE // PRIMARY CHANNEL</span><b>ENCRYPTED</b></div>
      <div className="orb-stage" data-state={coreState}><div className="hud-reticle"><i/><i/><i/><i/></div><div className={'core '+(listening?'listening ':'')+(thinking?'processing':'')} onClick={speak} role="button" tabIndex={0} aria-label="Sprachsteuerung starten"><span className="scanner"/><span className="orbit orbit-a"><u/><u/><u/></span><span className="orbit orbit-b"><u/><u/></span><i/><i/><i/><strong>J</strong></div><div className="telemetry t-left">VECTOR<br/><b>0.847</b></div><div className="telemetry t-right">CHANNEL<br/><b>VOICE-01</b></div></div>
      <div className="core-copy"><small>{thinking?'PROCESSING REQUEST':listening?'VOICE INPUT ACTIVE':'CORE STANDBY'}</small><h2>{thinking?'Ich verarbeite deine Anfrage …':listening?'Ich höre zu …':'Bereit, Paddo'}</h2><p>{vaultPassword?'Sichere KI-Verbindung aktiv':'KI-Tresor muss entsperrt werden'}</p></div>
      {chatError&&<div className="chat-error">⚠ {chatError}</div>}{messages.length>0&&<div className="transcript hud-transcript">{messages.slice(-4).map((m,i)=><p key={i}><b>{m.who}</b>{m.text}</p>)}</div>}
      <div className="command hud-command"><span>›</span><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder={thinking?"J.A.R.V.I.S. denkt …":"Frage stellen oder Befehl eingeben …"}/><button onClick={speak}>◉</button><button onClick={send} disabled={thinking}>{thinking?"DENKE …":"SENDEN"}</button></div>
     </section>
    </div>
    <div className="event-ticker"><span>LIVE FEED</span><div><b>23:41</b> Second Brain synchronisiert</div><div><b>22:18</b> Plantfriend-Wissen aktualisiert</div><div><b>20:04</b> 3 Aufgaben offen</div><button onClick={()=>setTab('Aufgaben')}>TIMELINE ÖFFNEN →</button></div>
   </div>}
  </section>
 </main>
}
