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
  +"\nwindow.K={PRESS_SITUATIONS,PRESS_MIN_GAP,TOTAL_MATCHDAYS,BOARD_MAX_PATIENCE};");
let fails=0;
function check(l,fn){ try{ const r=fn(); const ok=r===true||r===undefined;
  console.log(`${ok?"OK  ":"FAIL"}  ${l}${ok?"":" -> "+r}`); if(!ok)fails++;
} catch(e){ console.log(`FAIL  ${l} -> ${e.message}`);
  console.log(e.stack.split("\n").slice(1,4).map(x=>"      "+x.trim()).join("\n")); fails++; } }
const $=id=>win.document.getElementById(id);
const K=win.K;

$("clubSelect").value="VfB Stuttgart"; win.startCareer();
const gs=win.gameState; gs.liveMatches=false;

function saisonSpielen(){
  let n=0;
  while(n++<90 && !gs.seasonEnded){
    win.runNextEvent();
    if($("liveOverlay").classList.contains("show")){ win.skipLiveMatch(); win.closeLiveMatch(); }
    if($("pressOverlay").classList.contains("show")) win.answerPressConference(
      win.eval("(function(){return null})()") || lastSituation(), 1);
  }
}
function lastSituation(){
  const t=$("pressContent").innerHTML;
  const m=t.match(/answerPressConference\('([a-z]+)'/);
  return m ? m[1] : null;
}

console.log("--- F2: Pressekonferenzen ---");

check("Es gibt mehrere Situationen", () => K.PRESS_SITUATIONS.length>=5 ? true : K.PRESS_SITUATIONS.length);

check("Jede Situation hat drei Antworten mit Wirkung", () => {
  for(const s of K.PRESS_SITUATIONS){
    if(!s.key || !s.frage || !s.bedingung) return `${s.key}: unvollständig`;
    if(s.antworten.length!==3) return `${s.key}: ${s.antworten.length} Antworten`;
    if(!s.antworten.some(a=>a.morale||a.patience)) return `${s.key}: keine Wirkung`;
    for(const a of s.antworten) if(!a.text||!a.folge) return `${s.key}: Antwort unvollständig`;
  }
  return true;
});

check("Jede Situation bietet echte Abwägungen", () => {
  // Keine Antwort darf in allen drei Dimensionen mindestens so gut sein
  // wie jede andere — sonst gibt es nichts abzuwägen.
  // Ein härteres Saisonziel (target < 0) zählt als Nachteil.
  for(const s of K.PRESS_SITUATIONS){
    const dominant=s.antworten.filter(a=>
      s.antworten.every(b=>a===b || (
        (a.morale||0)>=(b.morale||0) &&
        (a.patience||0)>=(b.patience||0) &&
        (a.target||0)>=(b.target||0))));
    if(dominant.length>0) return `${s.key}: „${dominant[0].text}" ist immer die beste Wahl`;
  }
  return true;
});

check("Mutige Antworten verschärfen das Saisonziel", () => {
  gs.lastPressMatchday=-99;
  gs.board=win.createFreshBoard(78,1);
  const vorher=gs.board.targetPosition;
  win.applyPressAnswer(gs,"siegesserie",0);
  return gs.board.targetPosition<vorher ? true : "Ziel unverändert";
});

check("Das Ziel kann nicht unter Platz 1 fallen", () => {
  gs.board=win.createFreshBoard(92,1);
  gs.board.targetPosition=1;
  for(let i=0;i<5;i++){ gs.lastPressMatchday=-99; win.applyPressAnswer(gs,"siegesserie",0); }
  return gs.board.targetPosition===1 ? true : gs.board.targetPosition;
});

check("Ohne passende Lage meldet sich niemand", () => {
  gs.lastPressMatchday=gs.matchday;
  return win.pickPressSituation(gs)===null ? true : "Konferenz trotz Sperrfrist";
});

check("Der Mindestabstand wird eingehalten", () => {
  gs.currentWinStreak=5;
  gs.lastPressMatchday=gs.matchday-1;
  if(win.pickPressSituation(gs)!==null) return "zu früh";
  gs.lastPressMatchday=gs.matchday-K.PRESS_MIN_GAP;
  return win.pickPressSituation(gs)!==null ? true : "auch nach der Frist nichts";
});

check("Eine Antwort wirkt auf Stimmung und Vorstand", () => {
  gs.currentWinStreak=5; gs.lastPressMatchday=-99;
  gs.squad.forEach(p=>win.setMorale(p,60));
  gs.board.patience=50;
  const moralVorher=win.getSquadMoraleAverage(gs.squad);
  const antwort=win.applyPressAnswer(gs,"siegesserie",0);
  if(!antwort) return "keine Antwort verarbeitet";
  if(win.getSquadMoraleAverage(gs.squad)<=moralVorher) return "Stimmung unverändert";
  if(gs.board.patience<=50) return "Vorstand unverändert";
  return true;
});

check("Keine Stellungnahme kostet etwas", () => {
  gs.squad.forEach(p=>win.setMorale(p,60));
  gs.board.patience=50;
  gs.lastPressMatchday=-99;
  win.applyPressAnswer(gs,"siegesserie",null);
  return win.getSquadMoraleAverage(gs.squad)<60 && gs.board.patience<50
    ? true : "Schweigen bleibt folgenlos";
});

check("Die Geduld bleibt im gültigen Bereich", () => {
  gs.board.patience=K.BOARD_MAX_PATIENCE;
  gs.lastPressMatchday=-99;
  win.applyPressAnswer(gs,"siegesserie",0);
  if(gs.board.patience>K.BOARD_MAX_PATIENCE) return "über dem Maximum";
  gs.board.patience=1;
  gs.lastPressMatchday=-99;
  win.applyPressAnswer(gs,"niederlagenserie",2);
  return gs.board.patience>=0 ? true : "unter null";
});

check("Antworten werden protokolliert", () => {
  const n=gs.pressHistory.length;
  gs.lastPressMatchday=-99;
  win.applyPressAnswer(gs,"siegesserie",1);
  const letzte=gs.pressHistory[gs.pressHistory.length-1];
  return gs.pressHistory.length===n+1 && letzte.situation==="siegesserie"
    ? true : "nicht protokolliert";
});

check("Der Dialog zeigt Frage und Antworten", () => {
  gs.currentWinStreak=4; gs.lastPressMatchday=-99;
  const s=win.pickPressSituation(gs);
  if(!s) return "keine Situation gefunden";
  win.showPressConference(s);
  const t=$("pressContent").textContent;
  const offen=$("pressOverlay").classList.contains("show");
  const optionen=$("pressContent").querySelectorAll(".lineupOption").length;
  win.closePressModal();
  return offen && optionen===3 && /Kabine|Vorstand|ohne Wirkung/.test(t)
    ? true : `offen=${offen}, ${optionen} Optionen`;
});

check("Der Schalter deaktiviert die Presse", () => {
  win.togglePressConferences();
  gs.currentWinStreak=5; gs.lastPressMatchday=-99;
  const aus=win.pickPressSituation(gs)===null;
  win.togglePressConferences();
  return aus ? true : "Presse meldet sich trotz Abschaltung";
});

console.log("\n--- F4: Mehrsaison-Analyse ---");

check("Vor der ersten Saison gibt es einen Hinweis", () => {
  win.switchTab("statistik");
  return /Noch keine abgeschlossene Saison/.test($("trendPanel").textContent)
    ? true : "kein Hinweis";
});

check("Drei Saisons lassen sich durchspielen", () => {
  gs.pressConferences=false;
  for(let s=0;s<3;s++){
    saisonSpielen();
    gs.board.patience=90; gs.board.dismissed=false;
    win.startNextSeason();
  }
  return gs.seasonHistory.length===3 ? true : `${gs.seasonHistory.length} Saisons`;
});

check("Jeder Saisoneintrag trägt die Analysewerte", () => {
  const fehlt=["stature","teamRating","squadValue","salaryTotal","youthProducts","avgAge","morale","points"]
    .filter(k=>gs.seasonHistory.some(s=>s[k]==null));
  return fehlt.length===0 ? true : "fehlt: "+fehlt.join(", ");
});

check("Die Transferbilanz wird geführt", () => {
  gs.matchday=1; gs.budget=100000000;
  const kandidat=win.filterPool(gs.pool,{maxFee:8000000}).filter(p=>win.isWillingToJoin(gs,p))[0];
  const vorher=gs.seasonTransferOut||0;
  win.handleSignPlayer(kandidat.id);
  return (gs.seasonTransferOut||0)>vorher ? true : "Ablöse nicht gezählt";
});

check("Verkäufe zählen ebenfalls", () => {
  const vorher=gs.seasonTransferIn||0;
  win.handleSellPlayer(gs.squad.length-1);
  return (gs.seasonTransferIn||0)>vorher ? true : "Erlös nicht gezählt";
});

check("Die Trendkarten werden gezeichnet", () => {
  win.switchTab("statistik");
  const el=$("trendPanel");
  const karten=el.querySelectorAll(".stat").length;
  const kurven=el.querySelectorAll("svg polyline").length;
  return karten>=8 && kurven>=6 ? true : `${karten} Karten, ${kurven} Kurven`;
});

check("Die Platzierung wird invertiert dargestellt", () => {
  // Platz 1 muss oben liegen: bei besserer Platzierung sinkt der y-Wert.
  const a=win.buildTrendChart([10,2],["A","B"],"#fff",true);
  const punkte=a.match(/points="([^"]+)"/)[1].split(" ").map(p=>parseFloat(p.split(",")[1]));
  return punkte[1]<punkte[0] ? true : "Platz 1 liegt nicht oben";
});

check("Eine Zusammenfassung in Worten erscheint", () => {
  const t=$("trendPanel").textContent;
  return /Saisons|Standing|Transferbilanz|Meistertitel|Pokalsieg|Stationen/.test(t)
    ? true : "keine Zusammenfassung";
});

check("Zu wenig Daten erzeugen keinen Fehler", () => {
  const leer=win.buildTrendChart([null,null],["A","B"],"#fff",false);
  const eins=win.buildTrendChart([5],["A"],"#fff",false);
  return /zwei Saisons/.test(leer) && /zwei Saisons/.test(eins) ? true : "kein Hinweis";
});

check("Keine Laufzeitfehler", () => errors.length===0 ? true : errors.join(" | "));

console.log(fails===0?"\nAlle Tests bestanden.":`\n${fails} Test(s) fehlgeschlagen.`);
process.exit(fails===0?0:1);
