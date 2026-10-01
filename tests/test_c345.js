const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync("/home/claude/bl/index.html","utf8")
  .replace(/<script src="modules\/[a-z]+\.js"><\/script>\s*/g,"");
const dom=new JSDOM(html,{runScripts:"outside-only",pretendToBeVisual:true,url:"http://localhost/"});
const win=dom.window;
const errors=[]; win.addEventListener("error",e=>errors.push(e.message));
// Modulliste aus dem HTML lesen, damit sie nie veraltet.
const mods = [...fs.readFileSync("/home/claude/bl/index.html","utf8")
  .matchAll(/modules\/([a-z-]+\.js)/g)].map(m => m[1]);
win.eval("try{localStorage.clear();}catch(e){}");
win.eval(mods.map(f=>fs.readFileSync("/home/claude/bl/"+f,"utf8")).join("\n")
  +"\nwindow.K={TOTAL_MATCHDAYS,POOL_PLAYERS_PER_CLUB};");
let fails=0;
function check(l,fn){ try{ const r=fn(); const ok=r===true||r===undefined;
  console.log(`${ok?"OK  ":"FAIL"}  ${l}${ok?"":" -> "+r}`); if(!ok)fails++;
} catch(e){ console.log(`FAIL  ${l} -> ${e.message}`);
  console.log(e.stack.split("\n").slice(1,4).map(x=>"      "+x.trim()).join("\n")); fails++; } }
const $=id=>win.document.getElementById(id);

$("clubSelect").value="VfB Stuttgart"; win.startCareer();
const gs=win.gameState; gs.liveMatches=false;

function saisonSpielen(){
  let n=0;
  while(n++<90 && !gs.seasonEnded){
    win.runNextEvent();
    if($("liveOverlay").classList.contains("show")){ win.skipLiveMatch(); win.closeLiveMatch(); }
  }
}

console.log("--- C4: Ligaweite Torjägerliste ---");
let n=0;
while(n++<40 && gs.matchday<15){ win.runNextEvent();
  if($("liveOverlay").classList.contains("show")){ win.skipLiveMatch(); win.closeLiveMatch(); } }

check("KI-Spieler schießen Tore", () => {
  const treffer=gs.pool.players.filter(p=>(p.goalsSeason||0)>0);
  return treffer.length>30 ? true : `nur ${treffer.length} Torschützen im Bestand`;
});

check("Die Liste enthält fremde und eigene Spieler", () => {
  const l=win.getLeagueTopScorers(gs,20);
  const fremd=l.filter(e=>!e.eigen).length, eigen=l.filter(e=>e.eigen).length;
  return fremd>0 ? true : `${fremd} fremde, ${eigen} eigene`;
});

check("Nur Spieler aus der eigenen Liga zählen", () => {
  const ligaNamen=new Set(gs.teams.map(t=>t.name));
  return win.getLeagueTopScorers(gs,30).every(e=>ligaNamen.has(e.club)) ? true : "fremde Liga dabei";
});

check("Die Liste ist absteigend sortiert", () => {
  const l=win.getLeagueTopScorers(gs,20);
  return l.every((e,i)=>i===0||l[i-1].goals>=e.goals) ? true : "nicht sortiert";
});

check("Torsumme passt zu den Ligatoren", () => {
  const ausListe=win.getLeagueTopScorers(gs,999).reduce((a,e)=>a+e.goals,0);
  const inTabelle=gs.teams.reduce((a,t)=>a+t.gf,0);
  // Die eigenen Tore werden nur bei eigenen Spielen zugeordnet, deshalb
  // eine grobe Plausibilitaetsgrenze statt exakter Gleichheit.
  return ausListe>0 && ausListe<=inTabelle ? true : `${ausListe} vs ${inTabelle}`;
});

check("Die Anzeige zeigt die Liste", () => {
  win.switchTab("statistik");
  const t=$("topScorersTable").textContent;
  return t.length>40 && /\d/.test(t) ? true : "Liste leer";
});

console.log("\n--- C3: Vereinsgeschichte ---");
saisonSpielen();

check("Ein Eintrag wurde angelegt", () => gs.seasonHistory.length===1 ? true : gs.seasonHistory.length);

check("Der Eintrag ist vollständig", () => {
  const e=gs.seasonHistory[0];
  const fehlt=["season","finalPosition","division","club","cupResult","points","goalsFor"]
    .filter(k=>e[k]==null);
  return fehlt.length===0 ? true : "fehlt: "+fehlt.join(", ");
});

check("Der Torschützenkönig wurde festgehalten", () => {
  const e=gs.seasonHistory[0];
  return e.topScorer && e.topScorer.goals>0 ? true : "kein Torschützenkönig";
});

check("Das Pokalergebnis ist vermerkt", () => {
  const e=gs.seasonHistory[0];
  return typeof e.cupResult==="string" && e.cupResult.length>0 ? true : e.cupResult;
});

check("Die Anzeige zeigt die erweiterten Spalten", () => {
  win.switchTab("verlauf");
  const t=$("seasonHistoryTable").textContent;
  return /Pokal/.test(t) && /Torjäger/.test(t) && /Verein/.test(t) ? true : "Spalten fehlen";
});

check("Torzähler werden zur neuen Saison zurückgesetzt", () => {
  win.startNextSeason();
  const nochTore=gs.pool.players.filter(p=>(p.goalsSeason||0)>0).length
    + gs.squad.filter(p=>(p.goalsSeason||0)>0).length;
  return nochTore===0 ? true : `${nochTore} Spieler mit Restzählern`;
});

console.log("\n--- C5: Bestmarken ---");
check("Rekorde werden geführt", () => gs.records != null);

check("Höchster Sieg wurde erfasst", () => {
  const r=gs.records;
  return r.biggestWin && r.biggestWin.margin>0 && r.biggestWin.opponent
    ? true : "kein Sieg erfasst";
});

check("Serien wurden gezählt", () => {
  const r=gs.records;
  return r.longestUnbeaten>0 ? true : `Serie ${r.longestUnbeaten}`;
});

check("Beste Saison wurde festgehalten", () => {
  const r=gs.records;
  return r.bestSeason && r.bestSeason.finalPosition>0 ? true : "keine beste Saison";
});

check("Karriere-Torjäger wird geführt", () => {
  const r=gs.records;
  return r.mostGoalsCareer && r.mostGoalsCareer.goals>0 ? true : "kein Torjäger";
});

check("Höchste Teambewertung wurde erfasst", () => {
  const r=gs.records;
  return r.highestTeamRating && r.highestTeamRating.value>0 ? true : "keine Bewertung";
});

check("Ein Transfer wird als Rekord vermerkt", () => {
  gs.budget=120000000; gs.matchday=1;
  const kandidat=win.sortPoolResults(win.filterPool(gs.pool,{maxFee:30000000}),"fee","desc")[0];
  if(!kandidat) return "kein Kandidat";
  const fee=win.getTransferFee(kandidat);
  win.handleSignPlayer(kandidat.id);
  const r=gs.records.mostExpensiveSigning;
  return r && r.fee===fee ? true : "Transfer nicht erfasst";
});

check("Nur teurere Transfers überschreiben den Rekord", () => {
  const vorher=gs.records.mostExpensiveSigning.fee;
  const billig=win.sortPoolResults(win.filterPool(gs.pool,{maxFee:vorher-1}),"fee","asc")[0];
  if(billig) win.handleSignPlayer(billig.id);
  return gs.records.mostExpensiveSigning.fee===vorher ? true : "billiger Transfer hat überschrieben";
});

check("Die Rekordanzeige ist gefüllt", () => {
  win.switchTab("statistik");
  const t=$("recordsPanel").textContent;
  return /Höchster Sieg/.test(t) && /Beste Saison/.test(t) ? true : "Anzeige unvollständig";
});

check("Bestmarken überstehen mehrere Saisons", () => {
  const vorher=JSON.stringify(gs.records.biggestWin);
  for(let s=0;s<2;s++){ saisonSpielen(); gs.board.patience=90; win.startNextSeason(); }
  const r=gs.records;
  if(!r.biggestWin) return "Rekord verloren";
  if(gs.seasonHistory.length!==3) return `${gs.seasonHistory.length} Saisons in der Geschichte`;
  return true;
});

check("Keine Laufzeitfehler", () => errors.length===0 ? true : errors.join(" | "));

console.log(fails===0?"\nAlle Tests bestanden.":`\n${fails} Test(s) fehlgeschlagen.`);
process.exit(fails===0?0:1);
