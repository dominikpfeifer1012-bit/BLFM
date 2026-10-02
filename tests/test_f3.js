const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync("/home/claude/bl/index.html","utf8")
  .replace(/<script src="modules\/[a-z-]+\.js"><\/script>\s*/g,"");
const dom=new JSDOM(html,{runScripts:"outside-only",pretendToBeVisual:true,url:"http://localhost/"});
const win=dom.window;
const errors=[]; win.addEventListener("error",e=>errors.push(e.message));
// Modulliste aus dem HTML lesen, damit sie nie veraltet.
const mods = [...fs.readFileSync("/home/claude/bl/index.html","utf8")
  .matchAll(/modules\/([a-z-]+\.js)/g)].map(m => m[1]);
win.eval("try{localStorage.clear();}catch(e){}");
win.eval(mods.map(f=>fs.readFileSync("/home/claude/bl/"+f,"utf8")).join("\n")
  +"\nwindow.K={TACTIC_COUNTER,TACTICS,TOTAL_MATCHDAYS,AI_TACTIC_UNDERDOG_GAP,AI_TACTIC_FAVOURITE_GAP};");
let fails=0;
function check(l,fn){ try{ const r=fn(); const ok=r===true||r===undefined;
  console.log(`${ok?"OK  ":"FAIL"}  ${l}${ok?"":" -> "+r}`); if(!ok)fails++;
} catch(e){ console.log(`FAIL  ${l} -> ${e.message}`);
  console.log(e.stack.split("\n").slice(1,4).map(x=>"      "+x.trim()).join("\n")); fails++; } }
const $=id=>win.document.getElementById(id);
const K=win.K;

$("clubSelect").value="VfB Stuttgart"; win.startCareer();
const gs=win.gameState; gs.liveMatches=false;

console.log("--- F3: Taktische Konter ---");

check("Die Matrix ist spiegelbildlich", () => {
  const keys=Object.keys(K.TACTIC_COUNTER);
  for(const a of keys) for(const b of keys){
    const x=K.TACTIC_COUNTER[a][b], y=K.TACTIC_COUNTER[b][a];
    if(Math.abs(x.own-y.opp)>1e-9||Math.abs(x.opp-y.own)>1e-9) return `${a}/${b} bricht`;
  }
  return true;
});

check("Defensiv kontert Offensiv", () => {
  const d=win.getTacticMatchup("defensive","offensive");
  const o=win.getTacticMatchup("offensive","defensive");
  return d.own>0 && d.opp<0 && o.own<0 ? true : "Konter greift nicht";
});

check("Zwei offensive Teams erzeugen ein offenes Spiel", () => {
  const v=win.getTacticMatchup("offensive","offensive");
  return v.own>0 && v.opp>0 ? true : "kein offenes Spiel";
});

check("Zwei defensive Teams neutralisieren sich", () => {
  const v=win.getTacticMatchup("defensive","defensive");
  return v.own<0 && v.opp<0 ? true : "keine Neutralisierung";
});

check("Ausgeglichen bleibt gegen sich selbst neutral", () => {
  const v=win.getTacticMatchup("balanced","balanced");
  return v.own===0 && v.opp===0 ? true : "nicht neutral";
});

check("Unbekannte Ausrichtungen ergeben keine Verschiebung", () => {
  const v=win.getTacticMatchup("quatsch","unsinn");
  return v.own===0 && v.opp===0 ? true : "unbekannte Werte wirken";
});

console.log("\n--- Ausrichtung der KI ---");
check("Ein klarer Außenseiter stellt sich tief", () =>
  win.getAiTactic(60, 60+K.AI_TACTIC_UNDERDOG_GAP+5, 1, "A", "B")==="defensive" ? true : "nicht defensiv");

check("Ein klarer Favorit spielt nach vorn", () =>
  win.getAiTactic(90, 90-K.AI_TACTIC_FAVOURITE_GAP-5, 1, "A", "B")==="offensive" ? true : "nicht offensiv");

check("Die Wahl ist reproduzierbar", () => {
  const a=win.getAiTactic(75,75,5,"Team A","Team B");
  const b=win.getAiTactic(75,75,5,"Team A","Team B");
  return a===b ? true : `${a} dann ${b}`;
});

check("Bei ausgeglichenen Paarungen kommt Abwechslung", () => {
  const gesehen=new Set();
  for(let md=1;md<=20;md++) gesehen.add(win.getAiTactic(75,75,md,"Team A","Team B"));
  return gesehen.size>=2 ? true : `immer nur ${[...gesehen].join(",")}`;
});

check("Die Vorschau nennt die erwartete Ausrichtung", () => {
  const info=win.getNextOpponentInfo(gs);
  return info && K.TACTICS[info.opponentTactic] ? true : "keine Ausrichtung in der Vorschau";
});

check("Vorschau und Spiel stimmen überein", () => {
  for(let i=0;i<8;i++){
    const info=win.getNextOpponentInfo(gs);
    if(!info) break;
    const imSpiel=win.getTeamTactic(gs, info.opponentName, gs.clubName,
      info.opponentStrength, info.ownStrength);
    if(imSpiel!==info.opponentTactic) return `Vorschau ${info.opponentTactic}, Spiel ${imSpiel}`;
    win.runNextEvent();
    if($("liveOverlay").classList.contains("show")){ win.skipLiveMatch(); win.closeLiveMatch(); }
  }
  return true;
});

console.log("\n--- Wirkung und Balance ---");
check("Der Konter verändert die Ergebnisse messbar", () => {
  const messen=(taktik)=>{
    gs.tactic=taktik;
    let eigene=0, gegen=0;
    for(let i=0;i<4000;i++){
      const r=win.simulateMatch(gs, gs.clubName, "FC Bayern München");
      eigene+=r.homeGoals; gegen+=r.awayGoals;
    }
    return {eigene:eigene/4000, gegen:gegen/4000};
  };
  // Bayern ist klar staerker, spielt also offensiv -> defensiv muss kontern
  const def=messen("defensive"), off=messen("offensive");
  gs.tactic="balanced";
  return def.gegen < off.gegen ? true
    : `defensiv kassiert ${def.gegen.toFixed(2)}, offensiv ${off.gegen.toFixed(2)}`;
});

check("Der Torschnitt der Liga bleibt stabil", () => {
  let tore=0, spiele=0;
  const paare=[["FC Bayern München","SC Freiburg"],["VfB Stuttgart","Werder Bremen"],
    ["FC Augsburg","RB Leipzig"],["Holstein Kiel","FC St. Pauli"]];
  paare.forEach(([h,a])=>{
    for(let i=0;i<3000;i++){ const r=win.simulateMatch(gs,h,a); tore+=r.homeGoals+r.awayGoals; spiele++; }
  });
  const schnitt=tore/spiele;
  return schnitt>2.4 && schnitt<3.6 ? true : `Torschnitt ${schnitt.toFixed(2)}`;
});

// Die Karte zeigt bei einem Pokaltermin den Wettbewerb statt des
// Ligagegners. Fuer diese Pruefung also bis zu einem Ligaspiel vorruecken.
function bisZumLigaspiel(){
  let n=0;
  while(n++<12 && win.getNextEvent(gs).type!=="league" && !gs.seasonEnded){
    win.runNextEvent();
    if($("liveOverlay").classList.contains("show")){ win.skipLiveMatch(); win.closeLiveMatch(); }
  }
  win.switchTab("uebersicht");
  win.renderNextMatch(gs);
  return $("nextMatchCard").textContent;
}

check("Die Anzeige zeigt das taktische Duell", () => {
  const t=bisZumLigaspiel();
  return /Taktik:/.test(t) && /Chancen/.test(t) && /Gegentore/.test(t) ? true : t.replace(/\s+/g," ").slice(0,80);
});

check("Die Duell-Anzeige folgt der Kontermatrix", () => {
  bisZumLigaspiel();
  const info=win.getNextOpponentInfo(gs);
  if(!info) return "kein Ligaspiel";
  const w=win.getTacticMatchup(info.ownTactic, info.opponentTactic);
  const t=$("nextMatchCard").textContent;
  const erwartet = w.own > 0.02 ? /mehr Chancen/ : w.own < -0.02 ? /weniger Chancen/ : /Chancen gleich/;
  return erwartet.test(t) ? true : "Anzeige passt nicht";
});

check("Eine Saison läuft mit wechselnder Ausrichtung durch", () => {
  const taktiken=Object.keys(K.TACTICS);
  let n=0,i=0;
  while(n++<90 && !gs.seasonEnded){
    if(n%5===0) win.handleTacticChange(taktiken[i++ % taktiken.length]);
    win.runNextEvent();
    if($("liveOverlay").classList.contains("show")){ win.skipLiveMatch(); win.closeLiveMatch(); }
  }
  return gs.matchday===K.TOTAL_MATCHDAYS ? true : `nur ${gs.matchday} Spieltage`;
});

check("Keine Laufzeitfehler", () => errors.length===0 ? true : errors.join(" | "));

console.log(fails===0?"\nAlle Tests bestanden.":`\n${fails} Test(s) fehlgeschlagen.`);
process.exit(fails===0?0:1);
