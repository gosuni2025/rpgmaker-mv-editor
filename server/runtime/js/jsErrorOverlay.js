(()=>{var N=null,K=null,J=null,R=null,P=[],T=!1;function X(){_(),j(),$(),F()}function _(){let q=document.createElement("style");q.textContent=`
    .jeo-badge {
      position: fixed;
      bottom: 12px;
      right: 12px;
      z-index: 99999;
      background: #dc2626;
      color: #fff;
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      font-size: 14px;
      font-weight: 700;
      font-family: monospace;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      transition: transform 0.15s;
    }
    .jeo-badge:hover { transform: scale(1.1); }

    .jeo-overlay {
      position: fixed;
      inset: 0;
      z-index: 100000;
      display: none;
      flex-direction: column;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(4px);
      padding: 24px;
      font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
      font-size: 13px;
      color: #e4e4e7;
    }
    .jeo-overlay.open { display: flex; }

    .jeo-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      flex-shrink: 0;
    }
    .jeo-title {
      font-size: 16px;
      font-weight: 700;
      color: #fca5a5;
    }
    .jeo-actions {
      display: flex;
      gap: 8px;
    }
    .jeo-btn {
      background: #27272a;
      color: #e4e4e7;
      border: 1px solid #3f3f46;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.15s;
    }
    .jeo-btn:hover { background: #3f3f46; }

    .jeo-list {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .jeo-list::-webkit-scrollbar { width: 6px; }
    .jeo-list::-webkit-scrollbar-track { background: transparent; }
    .jeo-list::-webkit-scrollbar-thumb { background: #52525b; border-radius: 3px; }

    .jeo-item {
      background: #1c1917;
      border: 1px solid #44403c;
      border-left: 3px solid #dc2626;
      border-radius: 6px;
      padding: 12px;
    }
    .jeo-item.warn {
      border-left-color: #d97706;
    }
    .jeo-item.warn .jeo-msg {
      color: #fcd34d;
    }
    .jeo-item-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;
    }
    .jeo-time {
      color: #71717a;
      font-size: 11px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .jeo-msg {
      color: #fca5a5;
      font-weight: 600;
      word-break: break-word;
    }
    .jeo-stack {
      margin-top: 8px;
      padding: 8px;
      background: #0c0a09;
      border-radius: 4px;
      color: #a8a29e;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 12px;
      max-height: 200px;
      overflow-y: auto;
    }
    .jeo-copy {
      margin-top: 6px;
      font-size: 11px;
      color: #71717a;
      cursor: pointer;
      text-decoration: underline;
    }
    .jeo-copy:hover { color: #a1a1aa; }

    .jeo-empty {
      color: #71717a;
      text-align: center;
      padding: 40px;
      font-size: 14px;
    }
  `,document.head.appendChild(q)}function $(){J=document.createElement("div"),J.className="jeo-badge",J.title="Errors & Warnings (click to open)",J.addEventListener("click",w),document.body.appendChild(J)}function j(){N=document.createElement("div"),N.className="jeo-overlay";let q=document.createElement("div");q.className="jeo-header",R=document.createElement("div"),R.className="jeo-title",R.textContent="Errors & Warnings",q.appendChild(R);let z=document.createElement("div");z.className="jeo-actions";let D=document.createElement("button");D.className="jeo-btn",D.textContent="Copy All",D.addEventListener("click",W),z.appendChild(D);let G=document.createElement("button");G.className="jeo-btn",G.textContent="Clear",G.addEventListener("click",f),z.appendChild(G);let H=document.createElement("button");H.className="jeo-btn",H.textContent="Close",H.addEventListener("click",V),z.appendChild(H),q.appendChild(z),N.appendChild(q),K=document.createElement("div"),K.className="jeo-list",N.appendChild(K),document.addEventListener("keydown",(I)=>{if(I.key==="Escape"&&T)V()}),document.body.appendChild(N)}function F(){window.addEventListener("error",(z)=>{U({timestamp:new Date,level:"error",message:z.message||String(z.error),stack:z.error?.stack,source:z.filename?`${z.filename}:${z.lineno}:${z.colno}`:void 0})}),window.addEventListener("unhandledrejection",(z)=>{let D=z.reason,G=D instanceof Error?D.message:String(D),H=D instanceof Error?D.stack:void 0;U({timestamp:new Date,level:"error",message:`[Unhandled Promise] ${G}`,stack:H})});let q=console.warn.bind(console);console.warn=(...z)=>{q(...z),U({timestamp:new Date,level:"warn",message:z.map(String).join(" "),stack:Error().stack?.split(`
`).slice(2).join(`
`)})}}function U(q){P.push(q),Y(),S(q)}function Y(){if(!J)return;let q=P.length;J.textContent=q>99?"99+":String(q),J.style.display=q>0?"flex":"none";let z=P.some((D)=>D.level==="error");if(J.style.background=z?"#dc2626":"#d97706",R){let D=P.filter((I)=>I.level==="error").length,G=P.filter((I)=>I.level==="warn").length,H=[];if(D>0)H.push(`${D} error${D>1?"s":""}`);if(G>0)H.push(`${G} warning${G>1?"s":""}`);R.textContent=H.length>0?H.join(", "):"Errors & Warnings"}}function S(q){if(!K)return;let z=K.querySelector(".jeo-empty");if(z)z.remove();let D=document.createElement("div");D.className=`jeo-item ${q.level}`;let G=document.createElement("div");G.className="jeo-item-header";let H=document.createElement("div");H.className="jeo-msg",H.textContent=q.message,G.appendChild(H);let I=document.createElement("div");if(I.className="jeo-time",I.textContent=q.timestamp.toLocaleTimeString(),G.appendChild(I),D.appendChild(G),q.source){let M=document.createElement("div");M.style.cssText="color:#71717a;font-size:11px;margin-top:2px;",M.textContent=q.source,D.appendChild(M)}if(q.stack){let M=document.createElement("div");M.className="jeo-stack",M.textContent=q.stack,D.appendChild(M)}let Q=document.createElement("div");Q.className="jeo-copy",Q.textContent="Copy",Q.addEventListener("click",()=>{navigator.clipboard.writeText(Z(q)),Q.textContent="Copied!",setTimeout(()=>Q.textContent="Copy",1500)}),D.appendChild(Q),K.appendChild(D)}function Z(q){let z=`[${q.level.toUpperCase()}] [${q.timestamp.toLocaleTimeString()}] ${q.message}`;if(q.source)z+=`
  at ${q.source}`;if(q.stack)z+=`
${q.stack}`;return z}function W(){let q=P.map(Z).join(`

---

`);navigator.clipboard.writeText(q)}function f(){if(P=[],Y(),K){K.innerHTML="";let q=document.createElement("div");q.className="jeo-empty",q.textContent="No errors",K.appendChild(q)}}function w(){if(T)V();else x()}function x(){T=!0,N?.classList.add("open")}function V(){T=!1,N?.classList.remove("open")}X();})();
