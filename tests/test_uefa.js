const fs=require("fs"); const {JSDOM,VirtualConsole}=require("jsdom");
const htmlRoh=fs.readFileSync("/home/claude/bl/index.html","utf8");
const mods=[...htmlRoh.matchAll(/modules\/([a-z-]+\.js)/g)].map(m=>m[1]);
const code=mods.map(f=>fs.readFileSync("/home/claude/bl/"+f,"utf8")).join("\n");

function neueWelt(){
  const vc=new VirtualConsole(); vc.on("jsdomError",()=>{});
  const dom=new JSDOM(htmlRoh.replace(/<script src="modules\/[a-z-]+\.js"><\/script>\s*/g,""),
    {runScripts:"outside-only",pretendToBeVisual:true,url:"http://localhost/",virtualConsole:vc});
  const win=dom.window;
  const errors=[]; win.addEventListener("error",e=>errors.push(e.message));
  win.eval("try{localStorage.clear();}catch(e){}");
  win.eval(code+"\nwindow.K={UEFA_COMPS,UEFA_FIELD_SIZE,UEFA_DATES,EURO_CLUBS};");
  win.__errors=errors;
  return win;
}

let fails=0;
function check(l,fn){ try{ const r=fn(); const ok=r===true||r===undefined;
  console.log(`${ok?"OK  ":"FAIL"}  ${l}${ok?"":" -> "+r}`); if(!ok)fails++;
} catch(e){ console.log(`FAIL  ${l} -> ${e.message}`);
  console.log(e.stack.split("\n").slice(1,4).map(x=>"      "+x.trim()).join("\n")); fails++; } }

const w=neueWelt();
const $=id=>w.document.getElementById(id);
$("clubSelect").value="FC Bayern München"; w.startCareer();
const gs=w.gameState; gs.liveMatches=false; gs.pressConferences=false;
const K=w.K;
const schliessen=()=>{ w.closeLiveMatch(); w.document.querySelectorAll(".modalOverlay.show").forEach(e=>e.classList.remove("show")); };

console.log("--- Teilnehmer und Auslosung ---");
check("Drei Wettbewerbe mit je 36 Teams", () => {
  const n=["cl","el","ecl"].map(k=>gs.uefa.comps[k].teams.length);
  return n.every(x=>x===36) ? true : n.join(",");
});
check("Kein Verein spielt in zwei Wettbewerben", () => {
  const alle=["cl","el","ecl"].flatMap(k=>gs.uefa.comps[k].teams.map(t=>t.name));
  return new Set(alle).size===alle.length ? true : "doppelt";
});
check("Bayern startet in der Champions League", () => gs.uefa.own==="cl" ? true : gs.uefa.own);
check("CL/EL: 8 Spiele je Team, 4 daheim, 4 auswärts; ECL: 6 (3/3)", () => {
  for(const k of ["cl","el","ecl"]){
    const c=gs.uefa.comps[k], soll=K.UEFA_COMPS[k].rounds;
    if(c.fixtures.length!==36*soll/2) return `${k}: ${c.fixtures.length} Spiele`;
    for(const t of c.teams){
      const heim=c.fixtures.filter(f=>f.home===t.name).length, ausw=c.fixtures.filter(f=>f.away===t.name).length;
      if(heim!==soll/2||ausw!==soll/2) return `${k}: ${t.name} ${heim}/${ausw}`;
    }
  }
  return true;
});
check("Jedes Team spielt an jedem Ligaphasen-Spieltag genau einmal", () => {
  for(const k of ["cl","el","ecl"]){
    const c=gs.uefa.comps[k];
    for(let r=0;r<K.UEFA_COMPS[k].rounds;r++){
      const namen=c.fixtures.filter(f=>f.round===r).flatMap(f=>[f.home,f.away]);
      if(namen.length!==36||new Set(namen).size!==36) return `${k} Runde ${r+1}`;
    }
  }
  return true;
});
check("CL: je zwei Gegner aus jedem Topf", () => {
  const c=gs.uefa.comps.cl;
  const topf=new Map(c.teams.map(t=>[t.name,t.pot]));
  for(const t of c.teams){
    const gegner=c.fixtures.filter(f=>f.home===t.name||f.away===t.name).map(f=>f.home===t.name?f.away:f.home);
    for(let p=1;p<=4;p++) if(gegner.filter(g=>topf.get(g)===p).length!==2) return `${t.name}: Topf ${p}`;
  }
  return true;
});
check("Ein Vorstandsziel für den Europapokal steht", () => gs.uefa.goal && gs.uefa.goal.label ? true : "kein Ziel");
check("Supercups der anderen Länder sind gespielt", () => {
  const fremd=gs.supercups.list.filter(s=>s.a!==gs.clubName&&s.b!==gs.clubName);
  return fremd.length>=4 && fremd.every(s=>s.played&&s.winner) ? true : `${fremd.length} Supercups`;
});

console.log("\n--- Saisonverlauf ---");
check("Der eigene Supercup ist der erste Termin", () => {
  const e=w.getNextEvent(gs);
  return e.type==="supercup" ? true : e.type;
});
const termine={};
let n=0;
while(n++<200 && !gs.seasonEnded){
  const e=w.getNextEvent(gs);
  termine[e.type]=(termine[e.type]||0)+1;
  w.runNextEvent(); schliessen();
}
check("Saison läuft mit Europapokal-Terminen durch", () => termine.europe>=8 && gs.seasonEnded ? true : JSON.stringify(termine));
check("Alle drei Wettbewerbe haben einen Sieger", () => {
  const s=["cl","el","ecl"].map(k=>gs.uefa.comps[k].winner);
  return s.every(Boolean) ? true : s.join(",");
});
check("K.o.-Runden: Gesamtergebnis passt zum Weiterkommen", () => {
  for(const k of ["cl","el","ecl"]){
    for(const r of gs.uefa.comps[k].koHistory){
      for(const t of r.ties){
        if(t.final) continue;
        if(t.legs.length!==2) return `${k}: ${t.legs.length} Spiele`;
        if(t.aggA!==t.aggB && (t.aggA>t.aggB?t.a:t.b)!==t.winner) return `${k}: falscher Sieger ${t.a}-${t.b}`;
        if(t.aggA===t.aggB && !t.legs[1].extraTime) return `${k}: Gleichstand ohne Verlängerung`;
      }
    }
  }
  return true;
});
check("Achtelfinale: 8 Direkte gegen 8 Play-off-Sieger", () => {
  const c=gs.uefa.comps.cl;
  const r16=c.koHistory.find(h=>h.stage===1);
  const top8=new Set(c.finalTable.slice(0,8));
  return r16 && r16.ties.length===8 && r16.ties.every(t=>top8.has(t.b)&&!top8.has(t.a)) ? true : "Paarungen falsch";
});
check("Ehrentafel: alle Meister, Pokale, Europapokale, Supercups", () => {
  const h=gs.honours.filter(x=>x.season===gs.season);
  const fehlt=["cl","el","ecl","league-1","league-4","cup-de","cup-en","super-de"].filter(k=>!h.some(x=>x.key===k));
  return fehlt.length===0 ? true : "fehlt: "+fehlt.join(",");
});
check("Wertung: Saison abgeschlossen, Startplätze vergeben", () => {
  const q=gs.uefaQualification;
  if(!gs.uefa.coeffClosed) return "Wertung offen";
  if(!q || q.eps.length!==2) return "kein zusätzlicher CL-Platz";
  return q.cl.length>=21 && q.el.length>=10 && q.ecl.length>=5 ? true : `${q.cl.length}/${q.el.length}/${q.ecl.length}`;
});
check("Saisonverlauf vermerkt den Europapokal", () => {
  const h=gs.seasonHistory[gs.seasonHistory.length-1];
  return h.europeResult && h.europeResult.startsWith("CL") ? true : h.europeResult;
});

console.log("\n--- Neue Saison ---");
gs.board.patience=90; gs.board.dismissed=false;
w.startNextSeason(); if(gs.pendingYouthCandidates) w.finishYouthIntake();
check("Neue Europapokal-Saison ist angelegt", () => gs.uefa.season===gs.season && gs.uefa.dateIdx>=0 ? true : "nicht angelegt");
check("UEFA Super Cup zwischen CL- und EL-Sieger", () => {
  const u=gs.supercups.list.find(s=>s.key==="uefa");
  const h=gs.lastUefaHolders;
  return u && u.a===h.cl && u.b===h.el ? true : "fehlt";
});
check("Titelverteidiger spielen in der CL", () => {
  const h=gs.lastUefaHolders, cl=gs.uefa.comps.cl.teams.map(t=>t.name);
  return cl.includes(h.cl) && cl.includes(h.el) ? true : "Titelverteidiger fehlt";
});

console.log("\n--- Rotation ---");
check("Rotation schont müde Stammspieler", () => {
  gs.autoRotate=false;
  const elf=w.getStartingXI(gs.squad,1);
  const stamm=elf.find(p=>p.pos!=="TW");
  const bank=gs.squad.find(p=>!elf.includes(p) && p.pos!=="TW" && !w.isUnavailable(p,1));
  if(!stamm||!bank) return "keine Testspieler";
  const sicher={pos:bank.pos, strength:bank.strength, attributes:bank.attributes, consecutiveStarts:bank.consecutiveStarts, morale:bank.morale};
  // Gleich stark, gleiche Position, gleiche Stimmung: der Ersatz ist kaum schwächer.
  Object.assign(bank,{pos:stamm.pos, strength:stamm.strength, attributes:JSON.parse(JSON.stringify(stamm.attributes)), consecutiveStarts:0, morale:stamm.morale});
  stamm.consecutiveStarts=6;
  gs.autoRotate=true;
  const mitRotation=w.getStartingXI(gs.squad,1);
  gs.autoRotate=false;
  const ohneRotation=w.getStartingXI(gs.squad,1);
  const imTeam=mitRotation.includes(bank);
  stamm.consecutiveStarts=0; Object.assign(bank,sicher);
  // Der gleich starke, ausgeruhte Ersatz muss spielen (der Müde kann auf
  // eine andere Position rücken, wenn dort der Ersatz noch schwächer wäre).
  if(!imTeam) return "ausgeruhter Ersatz spielt nicht";
  return ohneRotation.includes(stamm) ? true : "ohne Rotation fehlt der Stammspieler";
});

console.log("\n--- Alte Spielstände ---");
check("Ein Stand ohne neue Wettbewerbe wird umgestellt", () => {
  const w2=neueWelt(); const $2=id=>w2.document.getElementById(id);
  $2("clubSelect").value="Borussia Dortmund"; w2.startCareer();
  const g=w2.gameState; g.liveMatches=false;
  for(let i=0;i<8;i++){ w2.runNextEvent(); w2.closeLiveMatch(); }
  const alt=JSON.parse(JSON.stringify(g));
  delete alt.uefa; delete alt.supercups; delete alt.coefficients; delete alt.honours;
  alt.europe={ qualified:false, phase:"group" };
  w2.localStorage.setItem("bl_career_1", JSON.stringify({ version:2, state:alt, label:"alt" }));
  w2.handleLoadFromSlot(1);
  const n=w2.gameState;
  if(!n.uefa || !n.uefa.comps) return "keine Wettbewerbe";
  if(n.europe) return "alter Europapokal noch da";
  const tage=w2.getUefaDates(n);
  return tage[n.uefa.dateIdx]===undefined || tage[n.uefa.dateIdx] >= n.matchday+1 ? true : "Termine nicht nachgezogen";
});

check("Keine Laufzeitfehler", () => w.__errors.length===0 ? true : w.__errors.join(" | "));

console.log(fails===0?"\nAlle Tests bestanden.":`\n${fails} Test(s) fehlgeschlagen.`);
process.exit(fails===0?0:1);
