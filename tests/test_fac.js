const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync("/home/claude/bl/index.html","utf8")
  .replace(/<script src="modules\/[a-z-]+\.js"><\/script>\s*/g,"");
const dom=new JSDOM(html,{runScripts:"outside-only",pretendToBeVisual:true,url:"http://localhost/"});
const win=dom.window;
const errors=[]; win.addEventListener("error",e=>errors.push(e.message));
const mods=[...fs.readFileSync("/home/claude/bl/index.html","utf8")
  .matchAll(/modules\/([a-z-]+\.js)/g)].map(m=>m[1]);
win.eval("try{localStorage.clear();}catch(e){}");
win.eval(mods.map(f=>fs.readFileSync("/home/claude/bl/"+f,"utf8")).join("\n")
  +"\nwindow.K={FACILITIES,FACILITY_COSTS,FACILITY_LEVELS,TOTAL_MATCHDAYS,ATTRIBUTES};");
let fails=0;
function check(l,fn){ try{ const r=fn(); const ok=r===true||r===undefined;
  console.log(`${ok?"OK  ":"FAIL"}  ${l}${ok?"":" -> "+r}`); if(!ok)fails++;
} catch(e){ console.log(`FAIL  ${l} -> ${e.message}`);
  console.log(e.stack.split("\n").slice(1,4).map(x=>"      "+x.trim()).join("\n")); fails++; } }
const $=id=>win.document.getElementById(id);
const K=win.K;

$("clubSelect").value="VfB Stuttgart"; win.startCareer();
const gs=win.gameState; gs.liveMatches=false; gs.pressConferences=false;

console.log("--- Grundlagen ---");
check("Alle Bereiche starten auf Stufe 0", () =>
  Object.keys(K.FACILITIES).every(k=>win.getFacilityLevel(gs,k)===0) ? true : "nicht bei null");

check("Die erste Stufe kostet den günstigsten Satz", () =>
  win.getFacilityCost(gs,"stadium")===K.FACILITY_COSTS[0] ? true : win.getFacilityCost(gs,"stadium"));

check("Ausbauen bucht ab und hebt die Stufe", () => {
  gs.budget=60000000;
  const vorher=gs.budget, kosten=win.getFacilityCost(gs,"stadium");
  const r=win.upgradeFacility(gs,"stadium");
  return r.success && win.getFacilityLevel(gs,"stadium")===1 && gs.budget===vorher-kosten
    ? true : "Ausbau fehlgeschlagen";
});

check("Die Kosten steigen mit jeder Stufe", () => {
  const k=[];
  for(let i=1;i<K.FACILITY_LEVELS;i++){ k.push(win.getFacilityCost(gs,"stadium")); win.upgradeFacility(gs,"stadium"); }
  return k.every((v,i)=>i===0||v>k[i-1]) ? true : k.join(", ");
});

check("Über die Höchststufe hinaus geht nichts", () => {
  const r=win.upgradeFacility(gs,"stadium");
  return !r.success && win.getFacilityCost(gs,"stadium")===null ? true : "Ausbau über Maximum";
});

check("Ohne Budget kein Ausbau", () => {
  gs.budget=1000;
  const r=win.upgradeFacility(gs,"coaching");
  return !r.success && win.getFacilityLevel(gs,"coaching")===0 && gs.budget===1000
    ? true : "trotz leerem Konto ausgebaut";
});

check("Unbekannte Bereiche werden abgewiesen", () =>
  win.upgradeFacility(gs,"quatsch").success===false ? true : "unbekannter Bereich akzeptiert");

check("Die Investitionssumme stimmt", () => {
  const erwartet=K.FACILITY_COSTS.reduce((a,b)=>a+b,0);
  return win.getTotalInvested(gs)===erwartet ? true : `${win.getTotalInvested(gs)} statt ${erwartet}`;
});

console.log("\n--- Wirkungen ---");
check("Stadion erhöht die Einnahmen", () => {
  const faktor=win.getStadiumRevenueBonus(gs);
  return faktor>1.25 && faktor<1.35 ? true : faktor;
});

check("Trainerstab beschleunigt die Entwicklung", () => {
  gs.budget=60000000;
  gs.facilities.coaching=0;
  const ohne=win.getCoachingDevBonus(gs);
  gs.facilities.coaching=K.FACILITY_LEVELS;
  const mit=win.getCoachingDevBonus(gs);
  return ohne===1 && mit>1.2 ? true : `${ohne} / ${mit}`;
});

check("Der Trainerstab wirkt messbar auf einen Spieler", () => {
  const klone=v=>Object.assign({},v,{attributes:{...v.attributes},maxAttributes:{...v.maxAttributes}});
  const vorlage=win.genPlayer(60,"ZM",[19,19],false);
  K.ATTRIBUTES.forEach(a=>{ vorlage.maxAttributes[a]=99; });
  const messen=stufe=>{
    gs.facilities.coaching=stufe;
    gs.squad=[klone(vorlage)];
    const p=gs.squad[0], vor=win.getOverallRating(p);
    for(let i=0;i<K.TOTAL_MATCHDAYS;i++) win.developSquad(gs.squad, 1, new Set());
    return win.getOverallRating(p)-vor;
  };
  const sicherung=gs.squad.slice();
  const ohne=messen(0), mit=messen(5);
  gs.squad=sicherung; gs.facilities.coaching=5;
  return mit>ohne*1.15 ? true : `${mit.toFixed(2)} statt deutlich über ${ohne.toFixed(2)}`;
});

check("Medizin senkt das Verletzungsrisiko", () => {
  gs.facilities.medical=0;
  const ohne=win.getMedicalInjuryFactor(gs);
  gs.facilities.medical=K.FACILITY_LEVELS;
  const mit=win.getMedicalInjuryFactor(gs);
  return ohne===1 && mit<0.7 ? true : `${ohne} / ${mit}`;
});

check("Scouting findet häufiger Talente", () => {
  const messen=stufe=>{
    gs.facilities.scouting=stufe;
    let funde=0;
    for(let i=0;i<3000;i++) if(win.genPlayer(70,"ST",[19,22],true).isScoutingFind) funde++;
    return funde;
  };
  const ohne=messen(0), mit=messen(5);
  return mit>ohne*1.5 ? true : `${ohne} ohne, ${mit} mit Ausbau`;
});

check("Jugendarbeit liefert bessere Talente", () => {
  const schnitt=stufe=>{
    gs.facilities.youth=stufe;
    const k=[]; for(let i=0;i<8;i++) k.push(...win.createYouthCandidates(gs));
    return { bew:k.reduce((a,p)=>a+p.strength,0)/k.length,
             pot:k.reduce((a,p)=>a+p.maxStrength,0)/k.length };
  };
  const ohne=schnitt(0), mit=schnitt(5);
  return mit.bew>ohne.bew && mit.pot>ohne.pot
    ? true : `Bewertung ${ohne.bew.toFixed(1)}→${mit.bew.toFixed(1)}, Potenzial ${ohne.pot.toFixed(1)}→${mit.pot.toFixed(1)}`;
});

check("Talente sprengen ihre Obergrenze nicht", () => {
  gs.facilities.youth=K.FACILITY_LEVELS;
  const k=win.createYouthCandidates(gs);
  return k.every(p=>p.maxStrength<=99.5 && p.strength<=p.maxStrength+0.2)
    ? true : "Grenze überschritten";
});

console.log("\n--- Anzeige und Ablauf ---");
check("Die Karte zeigt alle Bereiche", () => {
  win.switchTab("uebersicht");
  const t=$("facilitiesPanel").textContent;
  return Object.values(K.FACILITIES).every(f=>t.includes(f.label)) ? true : "Bereiche fehlen";
});

check("Ausgebaute Bereiche zeigen ihre Wirkung", () => {
  const t=$("facilitiesPanel").textContent;
  // Ausgebaut: die Wirkung steht ohne den Vorschau-Zusatz "Stufe 1:".
  const zeilen=[...$("facilitiesPanel").querySelectorAll("p.muted")].map(p=>p.textContent.trim());
  return zeilen.some(z=>/\+\d+%|−\d+%/.test(z) && !/^Stufe 1:/.test(z)) ? true : "keine Wirkung angezeigt";
});

check("Voll ausgebaut wird als solches markiert", () => {
  const knoepfe=[...$("facilitiesPanel").querySelectorAll("button")];
  return knoepfe.some(b=>/Ausgebaut/.test(b.textContent)) ? true : "keine Markierung";
});

check("Drei Saisons laufen mit Investitionen durch", () => {
  gs.budget=200000000;
  for(let s=0;s<3;s++){
    let n=0;
    while(n++<90 && !gs.seasonEnded){
      win.runNextEvent();
      if($("liveOverlay").classList.contains("show")){ win.skipLiveMatch(); win.closeLiveMatch(); }
    }
    if(gs.pendingYouthCandidates) win.finishYouthIntake();
    gs.board.patience=90; gs.board.dismissed=false;
    win.startNextSeason();
  }
  return gs.matchday===0 && gs.squad.length>=18 ? true : "Ablauf gestört";
});

check("Investitionen überleben den Saisonwechsel", () =>
  win.getFacilityLevel(gs,"stadium")===K.FACILITY_LEVELS ? true : "Stufe verloren");

check("Keine Laufzeitfehler", () => errors.length===0 ? true : errors.join(" | "));

console.log(fails===0?"\nAlle Tests bestanden.":`\n${fails} Test(s) fehlgeschlagen.`);
process.exit(fails===0?0:1);
