/* ═══════════════════════════════════════════════════════════════
   lab.js — shared engine for the options series
   Math, plotting, controls, and the teaching layer.
   Page files supply only their own figures, then call LAB.boot(drawAll).
   ═══════════════════════════════════════════════════════════════ */
"use strict";

/* ═══════════ math ═══════════ */
const SQRT2PI=Math.sqrt(2*Math.PI);
const npdf=x=>Math.exp(-.5*x*x)/SQRT2PI;
function ncdf(x){const s=x<0?-1:1,a=Math.abs(x),t=1/(1+.2316419*a);
  const p=npdf(a)*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
  return s>0?1-p:p;}
function bs(S,K,T,v,r,q,cp){
  T=Math.max(T,1e-9);v=Math.max(v,1e-9);S=Math.max(S,1e-9);
  const sq=Math.sqrt(T),sv=v*sq;
  const d1=(Math.log(S/K)+(r-q+.5*v*v)*T)/sv,d2=d1-sv;
  const eq=Math.exp(-q*T),er=Math.exp(-r*T);
  const N1=ncdf(d1),N2=ncdf(d2),n1=npdf(d1);
  const t1=S*eq*(cp?N1:N1-1),t2=K*er*(cp?N2:N2-1);
  const delta=cp?eq*N1:eq*(N1-1);
  const gamma=eq*n1/(S*sv), vega=S*eq*n1*sq;
  const dec=-(S*eq*n1*v)/(2*sq);
  const theta=cp?dec+q*S*eq*N1-r*K*er*N2:dec-q*S*eq*(1-N1)+r*K*er*(1-N2);
  const vanna=-eq*n1*d2/v, volga=vega*d1*d2/v;
  const cc=eq*n1*(2*(r-q)*T-d2*sv)/(2*T*sv);
  const charm=cp?q*eq*N1-cc:-q*eq*(1-N1)-cc;
  return{price:t1-t2,d1,d2,N1,N2,n1,t1,t2,delta,gamma,vega,theta,vanna,volga,charm,eq,er};
}
let zSpare=null;
function gauss(){
  if(zSpare!==null){const z=zSpare;zSpare=null;return z;}
  let u=0,v=0;while(u===0)u=Math.random();while(v===0)v=Math.random();
  const m=Math.sqrt(-2*Math.log(u));zSpare=m*Math.sin(2*Math.PI*v);return m*Math.cos(2*Math.PI*v);
}
function gbm(S0,mu,sig,T,n){
  const dt=T/n,a=(mu-.5*sig*sig)*dt,b=sig*Math.sqrt(dt);
  const p=new Float64Array(n+1);let x=Math.log(S0);p[0]=S0;
  for(let i=1;i<=n;i++){x+=a+b*gauss();p[i]=Math.exp(x);}
  return p;
}

/* ═══════════ style tokens ═══════════ */
const CS=getComputedStyle(document.documentElement);
const C=n=>CS.getPropertyValue(n).trim();
const RM=window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ═══════════ responsive helpers ═══════════ */
const NARROW = () => window.innerWidth < 700;
/* canvas heights shrink on phones so a figure still fits above the fold */
function cvh(v){ return NARROW() ? Math.round(v*0.82) : v; }

/* ═══════════ figure helper ═══════════ */
function Fig(cv,opts){
  const h=cvh(opts.h), dpr=window.devicePixelRatio||1, w=cv.clientWidth||600;
  cv.width=w*dpr; cv.height=h*dpr; cv.style.height=h+"px";
  const g=cv.getContext("2d"); g.setTransform(dpr,0,0,dpr,0,0);
  g.clearRect(0,0,w,h);
  const P=Object.assign({l:46,r:10,t:10,b:24},opts.pad||{});
  if(NARROW()){ P.l=Math.min(P.l,44); P.r=Math.min(P.r,8); P.b=Math.min(P.b,22); }
  const pw=w-P.l-P.r, ph=h-P.t-P.b;
  const o={g,w,h,P,pw,ph,
    x0:opts.x0,x1:opts.x1,y0:opts.y0,y1:opts.y1,
    X(v){return P.l+(v-this.x0)/(this.x1-this.x0)*pw;},
    Y(v){return P.t+ph-(v-this.y0)/(this.y1-this.y0)*ph;}};
  g.font="10px "+"'IBM Plex Mono', monospace";
  return o;
}
function nice(range,t){const raw=range/t,m=Math.pow(10,Math.floor(Math.log10(raw))),n=raw/m;
  return (n<1.5?1:n<3?2:n<7?5:10)*m;}
function fnum(v){const a=Math.abs(v);
  if(a===0)return "0"; if(a<1e-4)return v.toExponential(1);
  if(a<.01)return v.toFixed(4); if(a<1)return v.toFixed(3);
  if(a<100)return v.toFixed(2); if(a<1e4)return v.toFixed(0);
  return (v/1000).toFixed(1)+"k";}
function axes(o,xf,yf,nx,ny){
  const {g,P,pw,ph}=o;
  g.strokeStyle=C("--hair"); g.lineWidth=1;
  g.fillStyle=C("--grey"); g.textBaseline="middle"; g.textAlign="right";
  const ys=nice(o.y1-o.y0,NARROW()?Math.max(2,(ny||4)-1):(ny||4));
  for(let v=Math.ceil(o.y0/ys)*ys;v<=o.y1;v+=ys){
    const y=Math.round(o.Y(v))+.5;
    g.globalAlpha=.55;g.beginPath();g.moveTo(P.l,y);g.lineTo(P.l+pw,y);g.stroke();g.globalAlpha=1;
    g.fillText(yf?yf(v):fnum(v),P.l-7,y);
  }
  if(o.y0<0&&o.y1>0){g.strokeStyle=C("--grey");g.globalAlpha=.5;
    const y=Math.round(o.Y(0))+.5;g.beginPath();g.moveTo(P.l,y);g.lineTo(P.l+pw,y);g.stroke();g.globalAlpha=1;}
  g.textAlign="center";g.textBaseline="top";g.fillStyle=C("--grey");
  const xs=nice(o.x1-o.x0,NARROW()?Math.max(2,(nx||5)-2):(nx||5));
  for(let v=Math.ceil(o.x0/xs)*xs;v<=o.x1;v+=xs) g.fillText(xf?xf(v):fnum(v),o.X(v),P.t+ph+7);
  g.strokeStyle=C("--hair");g.beginPath();
  g.moveTo(P.l+.5,P.t);g.lineTo(P.l+.5,P.t+ph+.5);g.lineTo(P.l+pw,P.t+ph+.5);g.stroke();
}
function line(o,xs,ys,col,w,dash,alpha){
  const g=o.g;g.save();g.strokeStyle=col;g.lineWidth=w||1.8;
  if(dash)g.setLineDash(dash); if(alpha!==undefined)g.globalAlpha=alpha;
  g.beginPath();let st=false;
  for(let i=0;i<xs.length;i++){const y=ys[i];
    if(!isFinite(y)){st=false;continue;}
    const px=o.X(xs[i]),py=o.Y(y);
    if(!st){g.moveTo(px,py);st=true;}else g.lineTo(px,py);}
  g.stroke();g.restore();
}
function vline(o,x,col,label,dash){
  if(x<o.x0||x>o.x1)return;const g=o.g;g.save();
  g.strokeStyle=col;g.lineWidth=1;g.setLineDash(dash||[3,3]);
  const px=Math.round(o.X(x))+.5;
  g.beginPath();g.moveTo(px,o.P.t);g.lineTo(px,o.P.t+o.ph);g.stroke();
  if(label){g.setLineDash([]);g.fillStyle=col;g.textAlign="left";g.textBaseline="top";
    g.font="9.5px 'IBM Plex Mono', monospace";
    g.fillText(label,Math.min(px+4,o.P.l+o.pw-34),o.P.t+2);}
  g.restore();
}
function clip(o,fn){const g=o.g;g.save();
  g.beginPath();g.rect(o.P.l,o.P.t,o.pw,o.ph);g.clip();fn();g.restore();}

/* ═══════════ slider factory ═══════════ */
const SYNC={};
function sliders(host,specs,state,onchange,key){
  host.innerHTML=specs.map(s=>`<div class="ctl">
    <div class="r"><span class="n"><b>${s.lbl}</b>${s.name}</span><span class="v" id="v_${s.id}"></span></div>
    <input type="range" id="i_${s.id}" min="${s.min}" max="${s.max}" step="${s.step}" aria-label="${s.name}">
  </div>`).join("");
  const sync=()=>specs.forEach(s=>{
    document.getElementById("i_"+s.id).value=state[s.k];
    document.getElementById("v_"+s.id).textContent=s.fmt(state[s.k]);});
  specs.forEach(s=>{
    document.getElementById("i_"+s.id).addEventListener("input",e=>{
      state[s.k]=parseFloat(e.target.value);sync();onchange(s.k);});
  });
  sync();
  if(key)SYNC[key]={state,sync,run:()=>onchange()};
  return sync;
}
function preset(key,patch,focusId){
  const e=SYNC[key];if(!e)return;
  Object.assign(e.state,patch);e.sync();e.run();
  if(focusId){const el=document.getElementById(focusId);
    if(el)el.scrollIntoView({behavior:RM?"auto":"smooth",block:"center"});}
}
/* Focus an input only when the widget holding it is actually on screen, and
   never let focus move the page. A drill renders its first question during boot,
   and focusing an input fifteen thousand pixels down makes the browser scroll it
   into view — with smooth scrolling, that is a slow ride to the bottom of the
   page the moment it loads. Pass the container to test; the input itself works
   too when there is no wrapper. */
function focusSoft(el,within){
  if(!el)return;
  const b=(within||el).getBoundingClientRect();
  if(b.top<window.innerHeight&&b.bottom>0)el.focus({preventScroll:true});
}
const kvHTML=rows=>rows.map(([k,v])=>`<span class="k">${k}</span><span class="v">${v}</span>`).join("");
const pct=v=>(v*100).toFixed(1)+"%";
const pct2=v=>(v*100).toFixed(2)+"%";



/* term tooltips */
(function(){
  const tip=document.createElement("div");tip.id="tip";document.body.appendChild(tip);
  let open=null;
  function hide(){tip.style.display="none";open=null;}
  document.querySelectorAll(".term").forEach(el=>{
    el.setAttribute("tabindex","0");el.setAttribute("role","button");
    const show=()=>{
      tip.innerHTML='<span class="t">'+(el.dataset.t||"Definition")+'</span>'+el.dataset.def;
      tip.style.display="block";
      const r=el.getBoundingClientRect();
      const w=Math.min(330,window.innerWidth-24);
      tip.style.width=w+"px";
      let left=r.left+window.scrollX;
      if(left+w>window.innerWidth-12)left=window.innerWidth-w-12;
      tip.style.left=Math.max(12,left)+"px";
      tip.style.top=(r.bottom+window.scrollY+7)+"px";
      open=el;
    };
    el.addEventListener("click",e=>{e.stopPropagation();open===el?hide():show();});
    el.addEventListener("mouseenter",show);
    el.addEventListener("mouseleave",()=>{if(open===el)hide();});
    el.addEventListener("focus",show);
    el.addEventListener("blur",hide);
    el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();show();}});
  });
  document.addEventListener("click",hide);
  document.addEventListener("keydown",e=>{if(e.key==="Escape")hide();});
  window.addEventListener("scroll",()=>{if(open)hide();},{passive:true});
})();


/* ══════════════════════════════════════════════
   teaching layer — presets, checks, score
   ══════════════════════════════════════════════ */
document.querySelectorAll("[data-preset],[data-click]").forEach(b=>{
  b.addEventListener("click",()=>{
    if(b.dataset.set&&window.setC0)window.setC0(JSON.parse(b.dataset.set));
    if(b.dataset.preset)preset(b.dataset.preset,JSON.parse(b.dataset.patch||"{}"),b.dataset.focus);
    if(b.dataset.click){const t=document.getElementById(b.dataset.click);if(t)t.click();}
    if(b.dataset.then){const t=document.getElementById(b.dataset.then);if(t)t.click();}
  });
});

const QUIZ={answered:0,correct:0,total:document.querySelectorAll('.check[data-quiz] ').length};
document.querySelectorAll(".check").forEach(box=>{
  const isQuiz=box.hasAttribute("data-quiz");
  const opts=[...box.querySelectorAll(".opts button")];
  opts.forEach(btn=>{
    btn.addEventListener("click",()=>{
      if(box.classList.contains("done"))return;
      const ok=btn.hasAttribute("data-ok");
      btn.classList.add(ok?"right":"wrong");
      if(!ok)opts.find(o=>o.hasAttribute("data-ok")).classList.add("right");
      opts.forEach(o=>o.disabled=true);
      box.classList.add("done");
      if(isQuiz){QUIZ.answered++;if(ok)QUIZ.correct++;score();}
    });
  });
});
function score(){
  const n=document.querySelectorAll(".check[data-quiz]").length;
  const num=document.getElementById("scoreNum"), t=document.getElementById("scoreTxt");
  if(!num||!t) return;               // page has checks but no scoreboard
  num.textContent=QUIZ.correct+" / "+n;
  if(QUIZ.answered<n){
    t.textContent=`${QUIZ.answered} of ${n} answered. Keep going.`;
  }else{
    const c=QUIZ.correct;
    t.textContent = c===n ? "Every one. You can read the derivations now and they'll land differently."
      : c>=6 ? "Solid. Reread the chapters behind the ones you missed — the explanations name them."
      : c>=4 ? "Half there. The misses are worth chasing; each explanation points at the chapter to revisit."
      : "Worth another pass. Work the try-this boxes rather than rereading — the figures teach faster than the prose.";
  }
}


/* ══════════════════════════════════════════════
   scroll chrome
   ══════════════════════════════════════════════ */
(function(){
  const bar=document.getElementById("prog");
  const links=[...document.querySelectorAll(".chapnav a")];
  const secs=links.map(a=>document.querySelector(a.getAttribute("href")));
  function upd(){
    const d=document.documentElement;
    bar.style.width=(d.scrollTop/(d.scrollHeight-d.clientHeight)*100)+"%";
    let cur=-1;
    secs.forEach((s,i)=>{if(s&&s.getBoundingClientRect().top<window.innerHeight*.42)cur=i;});
    links.forEach((a,i)=>a.classList.toggle("on",i===cur));
  }
  window.addEventListener("scroll",upd,{passive:true});upd();
})();


/* ═══════════ wide tables get a scroll container on small screens ═══════════ */
function wrapTables(){
  document.querySelectorAll("table.rot,table.wtab,table.blot,table.idtab,table.ntab")
    .forEach(t=>{
      if(t.parentElement && t.parentElement.classList.contains("tblwrap")) return;
      const w=document.createElement("div"); w.className="tblwrap";
      t.parentNode.insertBefore(w,t); w.appendChild(t);
    });
}

/* ═══════════ boot ═══════════ */
const LAB = {
  boot(drawAll){
    wrapTables();
    const safe = () => { try { drawAll(); } catch(e){ console.error("draw failed:", e); } };
    safe();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(safe);
    let t;
    window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(safe, 150); });
    window.addEventListener("orientationchange", () => setTimeout(safe, 260));
    // re-wrap after any dynamic table render (the blotter rebuilds itself)
    const mo = new MutationObserver(() => wrapTables());
    mo.observe(document.body, {childList:true, subtree:true});
  }
};
