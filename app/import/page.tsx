"use client";

import { useState } from "react";

const defaultPath = String.raw`C:\Users\paddo\Documents\JARVIS\data\imports\jarvis-chatgpt-export-2026-08-05.zip`;
const command = String.raw`powershell -ExecutionPolicy Bypass -File .\scripts\import-chatgpt-export.ps1`;

export default function ImportPage() {
  const [copied, setCopied] = useState(false);

  const copyCommand = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main style={{minHeight:"100vh",background:"radial-gradient(circle at 50% 20%,#102a45 0,#06111f 42%,#02070d 100%)",color:"#dff7ff",padding:"40px 20px",fontFamily:"var(--font-geist-sans),sans-serif"}}>
      <section style={{maxWidth:920,margin:"0 auto",border:"1px solid rgba(74,195,255,.32)",background:"rgba(5,18,32,.82)",boxShadow:"0 0 60px rgba(0,151,255,.12)",padding:32}}>
        <div style={{fontSize:12,letterSpacing:3,color:"#52cfff"}}>J.A.R.V.I.S. // MEMORY INGESTION CORE</div>
        <h1 style={{fontSize:"clamp(30px,5vw,56px)",margin:"10px 0 8px",fontWeight:500}}>ChatGPT-Export importieren</h1>
        <p style={{color:"#a9c7d6",lineHeight:1.65,maxWidth:760}}>Der Export bleibt vollständig auf deinem Computer. Der lokale Importer entpackt die ZIP-Datei, validiert <code>conversations.json</code> und erzeugt durchsuchbare JSONL-Dateien für das Second Brain.</p>

        <div style={{display:"grid",gap:14,marginTop:28}}>
          <Status title="QUELLE" value={defaultPath} state="BEREIT" />
          <Status title="AUSGABE" value={String.raw`C:\Users\paddo\Documents\JARVIS\data\processed`} state="LOKAL" />
          <Status title="MODUS" value="Delta-Erkennung über Konversations-Hashes" state="AKTIV" />
        </div>

        <div style={{marginTop:30,padding:22,border:"1px solid rgba(74,195,255,.2)",background:"rgba(0,0,0,.25)"}}>
          <div style={{fontSize:12,letterSpacing:2,color:"#52cfff",marginBottom:12}}>IMPORT STARTEN</div>
          <ol style={{lineHeight:1.8,color:"#c5dce7",paddingLeft:20}}>
            <li>Öffne den lokalen Ordner des J.A.R.V.I.S.-Repositorys.</li>
            <li>Öffne dort PowerShell.</li>
            <li>Führe den folgenden Befehl aus.</li>
          </ol>
          <pre style={{whiteSpace:"pre-wrap",wordBreak:"break-all",padding:16,background:"#02070c",border:"1px solid rgba(80,214,255,.2)",color:"#78e4ff"}}>{command}</pre>
          <button onClick={copyCommand} style={{border:"1px solid #45cfff",background:"rgba(20,150,220,.16)",color:"#dffaff",padding:"12px 18px",letterSpacing:1,cursor:"pointer"}}>{copied?"BEFEHL KOPIERT ✓":"BEFEHL KOPIEREN"}</button>
        </div>

        <div style={{marginTop:24,color:"#83a6b8",fontSize:14,lineHeight:1.6}}>Die 930-MB-ZIP wird nicht in die Cloud hochgeladen. Nach dem Import entstehen <code>conversations.jsonl</code>, <code>messages.jsonl</code>, <code>manifest.json</code> und <code>import-state.json</code>.</div>
        <a href="/" style={{display:"inline-block",marginTop:28,color:"#64d9ff",textDecoration:"none"}}>← ZURÜCK ZUR ZENTRALE</a>
      </section>
    </main>
  );
}

function Status({title,value,state}:{title:string;value:string;state:string}) {
  return <div style={{display:"grid",gridTemplateColumns:"110px 1fr auto",gap:16,alignItems:"center",padding:"14px 16px",border:"1px solid rgba(98,205,255,.14)",background:"rgba(3,12,21,.55)"}}><span style={{fontSize:11,letterSpacing:2,color:"#6db9d7"}}>{title}</span><code style={{overflowWrap:"anywhere",color:"#d9f6ff"}}>{value}</code><b style={{fontSize:11,letterSpacing:1,color:"#49e2a7"}}>● {state}</b></div>;
}
