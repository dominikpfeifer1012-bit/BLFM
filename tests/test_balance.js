// Balance: Fahrstuhl zwischen den Ligen, Vereinslose, Jugendjahrgaenge.
const fs=require("fs"); const {JSDOM,VirtualConsole}=require("jsdom");
const htmlRoh=fs.readFileSync("/home/claude/bl/index.html","utf8");
const mods=[...htmlRoh.matchAll(/modules\/([a-z-]+\.js)/g)].map(m=>m[1]);
const code=mods.map(f=>fs.readFileSync("/home/claude/bl/"+f,"utf8")).join("\n");

function neueWelt(verein){
  const vc=new VirtualConsole(); vc.on("jsdomError",()=>{});
  const dom=new JSDOM(htmlRoh.replace(/<script src="modules\/[a-z-]+\.js"><\/script>\s*/g,""),
    {runScripts:"outside-only",pretendToBeVisual:true,url:"http://localhost/",virtualConsole:vc});
  const win=dom.window;
  const errors=[]; win.addEventListener("error",e=>errors.push(e.message));
  win.eval("try{localStorage.clear();}catch(e){}");
  win.eval(code+"\nwindow.K={FREE_AGENT_TOP_LIMIT,FREE_AGENT_ELITE_STRENGTH,FREE_AGENT_ELITE_MAX,FREE_AGENT_YOUNG_MAX_AGE,FREE_AGENT_YOUNG_STAR,POOL_FREE_AGENT_MAX};");
  win.__errors=errors;
  win.document.getElementById("clubSelect").value=verein;
  win.startCareer();
  return win;
}

let fails=0;
function check(l,fn){ try{ const r=fn(); const ok=r===true||r===undefined;
  console.log(`${ok?"OK  ":"FAIL"}  ${l}${ok?"":" -> "+r}`); if(!ok)fails++;
} catch(e){ console.log(`FAIL  ${l} -> ${e.message}`);
  console.log(e.stack.split("\n").slice(1,4).map(x=>"      "+x.trim()).join("\n")); fails++; } }
const schnitt=a=>a.reduce((x,y)=>x+y,0)/a.length;

// ---------- Fahrstuhl ----------
console.log("--- Auf- und Abstieg über 15 Jahre ---");
{
  const w=neueWelt("Paris FC"); const gs=w.gameState;
  // Nur Tabellen und Vereinsentwicklung, ohne volle Saisons.
  w.getDivisionStandings=(g,nr)=>w.simulateShadowSeason(w.getLeaguePool(g,nr));
  const ersteLigen=[1,4,6,8,10];
  let vorher=null, auf=0, aufZurueck=0, ab=0, abZurueck=0; const spitzen=[];
  const alterStart=schnitt(gs.pool.players.map(p=>p.age)), groesseStart=gs.pool.players.length;
  for(let j=0;j<15;j++){
    const r=w.processPromotionRelegation(gs);
    const jetzt={auf:new Set(),ab:new Set()};
    (r.movements||[]).forEach(m=>{ m.promotedNames.forEach(n=>jetzt.auf.add(n)); m.relegatedNames.forEach(n=>jetzt.ab.add(n)); });
    if(vorher){
      vorher.auf.forEach(n=>{ auf++; if(jetzt.ab.has(n)) aufZurueck++; });
      vorher.ab.forEach(n=>{ ab++; if(jetzt.auf.has(n)) abZurueck++; });
    }
    vorher=jetzt; gs.season++;
    w.advancePool(gs);
    ersteLigen.forEach(nr=>{ if(gs.leaguePools[nr-1]) spitzen.push(Math.max(...gs.leaguePools[nr-1].map(c=>c.strength))); });
  }
  check("Aufsteiger steigen nicht in der Regel sofort wieder ab", () =>
    aufZurueck/auf < 0.5 ? true : `${Math.round(aufZurueck/auf*100)} %`);
  check("Absteiger kehren nicht in der Regel sofort zurück", () =>
    abZurueck/ab < 0.5 ? true : `${Math.round(abZurueck/ab*100)} %`);
  check("Jede erste Liga behält eine Spitzenmannschaft (Ø ≥ 85)", () =>
    schnitt(spitzen) >= 85 ? true : `Ø ${schnitt(spitzen).toFixed(1)}`);
  check("Erste Ligen bleiben gestaffelt (Spitze – Schlusslicht ≥ 12)", () => {
    const flach=ersteLigen.filter(nr=>gs.leaguePools[nr-1]).map(nr=>{
      const s=gs.leaguePools[nr-1].map(c=>c.strength); return Math.max(...s)-Math.min(...s); }).filter(d=>d<12);
    return flach.length===0 ? true : `Spannweite ${flach.join(", ")}`;
  });
  check("Spielerbestand wird nicht jünger (Kader der Absteiger gehen an Aufsteiger)", () => {
    const alter=schnitt(gs.pool.players.map(p=>p.age));
    return alter>=alterStart-0.6 ? true : `Alter ${alterStart.toFixed(1)} → ${alter.toFixed(1)}`;
  });
  check("Spielerbestand bleibt gleich groß", () =>
    Math.abs(gs.pool.players.length-groesseStart)<=100 ? true : `${groesseStart} → ${gs.pool.players.length}`);
  check("Profile je Liga sind gespeichert", () =>
    gs.divisionProfiles && gs.divisionProfiles[1] && gs.divisionProfiles[1].length>=16 ? true : "fehlen");
  check("Keine Laufzeitfehler (Fahrstuhl)", () => w.__errors.length===0 ? true : w.__errors.join(" | "));
}

// ---------- Vereinslose ----------
console.log("--- Vereinslose Spieler ---");
{
  const w=neueWelt("VfB Stuttgart"); const gs=w.gameState; const K=w.K;
  const pruefen=(wann)=>{
    const frei=gs.pool.players.filter(p=>!p.clubName);
    if(frei.length>K.POOL_FREE_AGENT_MAX) return `${wann}: ${frei.length} Vereinslose`;
    const top=frei.filter(p=>p.strength>=K.FREE_AGENT_TOP_LIMIT);
    if(top.length) return `${wann}: ${top.length} ab ${K.FREE_AGENT_TOP_LIMIT}`;
    const elite=frei.filter(p=>p.strength>=K.FREE_AGENT_ELITE_STRENGTH);
    if(elite.length>K.FREE_AGENT_ELITE_MAX) return `${wann}: ${elite.length} ab ${K.FREE_AGENT_ELITE_STRENGTH}`;
    const jung=frei.filter(p=>p.age<=K.FREE_AGENT_YOUNG_MAX_AGE && p.strength>=K.FREE_AGENT_YOUNG_STAR);
    if(jung.length) return `${wann}: junger Star ${jung[0].strength} mit ${jung[0].age}`;
    return true;
  };
  check("Start: wenige Vereinslose, keine Stars", () => pruefen("Start"));
  check("Start: ein paar erfahrene Spieler um 70", () => {
    const frei=gs.pool.players.filter(p=>!p.clubName && p.strength>=68);
    return frei.length>=2 ? true : `nur ${frei.length}`;
  });
  let ergebnis=true; const nachSommer=[];
  for(let s=0;s<3 && ergebnis===true;s++){
    gs.season++; w.advancePool(gs);
    ergebnis=pruefen(`Sommer ${s+1}`);
    nachSommer.push(...gs.pool.players.filter(p=>!p.clubName));
  }
  check("Drei Sommer: Regeln für Vereinslose halten", () => ergebnis);
  check("Sommer: brauchbare Vereinslose (≥ 65) gibt es weiterhin", () =>
    nachSommer.filter(p=>p.strength>=65).length>=3 ? true : "kaum brauchbare");
  check("Keine Laufzeitfehler (Vereinslose)", () => w.__errors.length===0 ? true : w.__errors.join(" | "));
}

// ---------- Jugend ----------
console.log("--- Jugendjahrgänge ---");
{
  const jahrgaenge=(verein, stufe)=>{
    const w=neueWelt(verein); const gs=w.gameState; gs.facilities.youth=stufe;
    const alle=[]; for(let i=0;i<40;i++) alle.push(...w.createYouthCandidates(gs));
    return { st: schnitt(alle.map(p=>p.strength)), pot: schnitt(alle.map(p=>p.maxStrength)),
      top: alle.filter(p=>p.maxStrength>=85).length/alle.length, ueber80: alle.filter(p=>p.strength>=80).length };
  };
  const bay0=jahrgaenge("FC Bayern München",0), bay5=jahrgaenge("FC Bayern München",5), verl=jahrgaenge("SC Verl",0);
  check("Talente kommen nicht fertig: niemand startet mit 80", () =>
    bay5.ueber80===0 ? true : `${bay5.ueber80} Talente ab 80`);
  check("Bayern ohne Ausbau: Talente um 58, Potenzial um 70", () =>
    bay0.st>=54 && bay0.st<=62 && bay0.pot>=66 && bay0.pot<=76 ? true : `${bay0.st.toFixed(1)}/${bay0.pot.toFixed(1)}`);
  check("Ausgebaute Jugend hilft spürbar, aber Weltklasse bleibt selten", () =>
    bay5.pot>=bay0.pot+3 && bay5.top<0.12 ? true : `Pot ${bay0.pot.toFixed(1)} → ${bay5.pot.toFixed(1)}, ≥85: ${(bay5.top*100).toFixed(0)} %`);
  check("Kleiner Verein hat schwächere Talente", () =>
    verl.st<bay0.st-6 && verl.pot<bay0.pot-5 ? true : `${verl.st.toFixed(1)}/${verl.pot.toFixed(1)}`);
}

console.log(fails===0?"\nAlle Prüfungen bestanden.":`\n${fails} Prüfung(en) fehlgeschlagen.`);
process.exit(fails?1:0);
