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
  +"\nwindow.K={YOUTH_SQUAD_MAX_SIZE,YOUTH_SQUAD_MAX_AGE,YOUTH_INTAKE_CANDIDATES,YOUTH_INTAKE_MAX_PICK,YOUTH_TEAM_SIZE,MIN_SQUAD_SIZE,TOTAL_MATCHDAYS};");
let fails=0;
function check(l,fn){ try{ const r=fn(); const ok=r===true||r===undefined;
  console.log(`${ok?"OK  ":"FAIL"}  ${l}${ok?"":" -> "+r}`); if(!ok)fails++;
} catch(e){ console.log(`FAIL  ${l} -> ${e.message}`);
  console.log(e.stack.split("\n").slice(1,4).map(x=>"      "+x.trim()).join("\n")); fails++; } }
const $=id=>win.document.getElementById(id);
const K=win.K;

$("clubSelect").value="VfB Stuttgart"; win.startCareer();
const gs=win.gameState; gs.liveMatches=false; gs.pressConferences=false;

function saisonSpielen(){
  let n=0;
  while(n++<90 && !gs.seasonEnded){
    win.runNextEvent();
    if($("liveOverlay").classList.contains("show")){ win.skipLiveMatch(); win.closeLiveMatch(); }
  }
}

console.log("--- Eigener Jugendkader ---");
check("Zu Beginn ist er leer", () => Array.isArray(gs.youthSquad) && gs.youthSquad.length===0);

check("Am Saisonende kommen Vorschläge", () => {
  saisonSpielen();
  const k=gs.pendingYouthCandidates;
  return k && k.length===K.YOUTH_INTAKE_CANDIDATES ? true : `${k?k.length:0} Vorschläge`;
});

check("Die Vorschläge sind jung und ausgestattet", () => {
  return gs.pendingYouthCandidates.every(p =>
    p.age>=16 && p.age<=18 && p.attributes && p.maxStrength>p.strength)
    ? true : "Vorschläge unvollständig";
});

check("Das Auswahlfenster öffnet sich", () => {
  win.showYouthIntakeModal();
  const offen=$("youthIntakeOverlay").classList.contains("show");
  const optionen=$("youthIntakeContent").querySelectorAll(".lineupOption").length;
  return offen && optionen===K.YOUTH_INTAKE_CANDIDATES ? true : `offen=${offen}, ${optionen} Optionen`;
});

check("Talente lassen sich aufnehmen", () => {
  win.handlePickYouthCandidate(0);
  win.handlePickYouthCandidate(1);
  return gs.youthSquad.length===2 ? true : `${gs.youthSquad.length} im Jugendkader`;
});

check("Mehr als das Maximum geht nicht", () => {
  for(let i=2;i<K.YOUTH_INTAKE_CANDIDATES;i++) win.handlePickYouthCandidate(i);
  return gs.youthSquad.length===K.YOUTH_INTAKE_MAX_PICK
    ? true : `${gs.youthSquad.length} statt ${K.YOUTH_INTAKE_MAX_PICK}`;
});

check("Derselbe Spieler nicht zweimal", () => {
  const vorher=gs.youthSquad.length;
  win.handlePickYouthCandidate(0);
  return gs.youthSquad.length===vorher ? true : "doppelt aufgenommen";
});

check("Abschließen räumt auf", () => {
  win.finishYouthIntake();
  return gs.pendingYouthCandidates===null
    && !$("youthIntakeOverlay").classList.contains("show") ? true : "nicht aufgeräumt";
});

console.log("\n--- Trennung von Profikader und Jugend ---");
check("Jugendspieler stehen nicht im Profikader", () =>
  gs.youthSquad.every(j => !gs.squad.some(p => p.id===j.id)) ? true : "Überschneidung");

check("Sie zählen nicht zur Kadergröße", () => {
  const angezeigt=parseInt($("squadCount").textContent);
  return angezeigt===gs.squad.length ? true : `${angezeigt} statt ${gs.squad.length}`;
});

check("Sie verändern die Teambewertung nicht", () => {
  const vorher=win.teamRating(gs.squad, gs.matchday+1);
  const stark=win.genYouthPlayer(78,"ST");
  win.addToYouthSquad(gs, stark);
  const nachher=win.teamRating(gs.squad, gs.matchday+1);
  gs.youthSquad=gs.youthSquad.filter(p=>p.id!==stark.id);
  return vorher===nachher ? true : `${vorher} -> ${nachher}`;
});

check("Sie kosten aber Gehalt", () => {
  const ohne=win.getMatchdaySalaryCost(gs.squad, []);
  const mit=win.getMatchdaySalaryCost(gs.squad, gs.youthSquad);
  return mit>ohne ? true : "Jugend kostet nichts";
});

check("Der Kader kann voll sein und trotzdem kommt Nachwuchs", () => {
  while(gs.squad.length<28) gs.squad.push(win.genPlayer(70,"ZM",[24,26],false));
  const vorher=gs.youthSquad.length;
  const kandidat=win.createYouthCandidates(gs)[0];
  const r=win.addToYouthSquad(gs, kandidat);
  return r.success && gs.youthSquad.length===vorher+1
    ? true : "Nachwuchs trotz vollem Kader blockiert";
});

console.log("\n--- Jugendmannschaft und Entwicklung ---");
check("Die Jugendmannschaft nutzt beide Gruppen", () => {
  win.startNextSeason();
  const lineup=win.getYouthLineup(gs, gs.matchday+1);
  const ausJugend=lineup.filter(p=>gs.youthSquad.some(j=>j.id===p.id)).length;
  const ausKader=lineup.filter(p=>gs.squad.some(s=>s.id===p.id)).length;
  return lineup.length===K.YOUTH_TEAM_SIZE && ausJugend>0 && ausKader>0
    ? true : `${ausJugend} Jugend, ${ausKader} Reserve, ${lineup.length} gesamt`;
});

check("Jugendspieler haben Vorrang", () => {
  const lineup=win.getYouthLineup(gs, gs.matchday+1);
  const ersteAusJugend=lineup.slice(0, gs.youthSquad.length)
    .every(p=>gs.youthSquad.some(j=>j.id===p.id));
  return ersteAusJugend ? true : "Jugendkader nicht zuerst";
});

check("Sie entwickeln sich durch Einsätze", () => {
  const p=gs.youthSquad[0];
  const vorher=win.getOverallRating(p);
  for(let i=0;i<10;i++) win.developYouthSquad(gs, gs.matchday+1, new Set([p.id]));
  return win.getOverallRating(p)>vorher ? true : "keine Entwicklung";
});

check("Ohne Einsatz entwickeln sie sich langsamer", () => {
  const a=gs.youthSquad[0], b=gs.youthSquad[1];
  if(!b) return true;
  const va=win.getOverallRating(a), vb=win.getOverallRating(b);
  for(let i=0;i<20;i++) win.developYouthSquad(gs, gs.matchday+1, new Set([a.id]));
  return (win.getOverallRating(a)-va) > (win.getOverallRating(b)-vb)
    ? true : "kein Unterschied";
});

console.log("\n--- Auf- und Abstieg zwischen den Kadern ---");
check("Hochziehen funktioniert", () => {
  const p=gs.youthSquad[0];
  const kader=gs.squad.length, jugend=gs.youthSquad.length;
  const r=win.promoteYouthPlayer(gs, p.id);
  return r.success && gs.squad.length===kader+1 && gs.youthSquad.length===jugend-1
    && gs.squad.some(x=>x.id===p.id) ? true : "Wechsel fehlgeschlagen";
});

check("Hochgezogene behalten die Eigengewächs-Marke", () => {
  const p=gs.squad.find(x=>x.isYouthProduct);
  return p && !p.isYouthSquad ? true : "Marke verloren";
});

check("Herunterschicken funktioniert für junge Profis", () => {
  const jung=gs.squad.find(p=>p.age<=K.YOUTH_SQUAD_MAX_AGE && !p.isYouthSquad);
  if(!jung) return true;
  const r=win.demoteToYouthSquad(gs, jung.id);
  return r.success && gs.youthSquad.some(x=>x.id===jung.id) ? true : r.message;
});

check("Ältere Profis dürfen nicht zurück", () => {
  const alt=gs.squad.find(p=>p.age>K.YOUTH_SQUAD_MAX_AGE);
  return win.demoteToYouthSquad(gs, alt.id).success===false ? true : "zu alter Spieler aufgenommen";
});

check("Der Profikader bleibt über dem Minimum", () => {
  const sicherung=gs.squad.slice();
  gs.squad=gs.squad.slice(0, K.MIN_SQUAD_SIZE);
  const jung=gs.squad.find(p=>p.age<=K.YOUTH_SQUAD_MAX_AGE);
  const r=jung ? win.demoteToYouthSquad(gs, jung.id) : {success:false};
  gs.squad=sicherung;
  return r.success===false ? true : "Kader unter das Minimum gefallen";
});

console.log("\n--- Altersgrenze ---");
check("Zu alte Jugendspieler werden hochgezogen oder verlassen den Verein", () => {
  gs.youthSquad.forEach(p=>{ p.age=K.YOUTH_SQUAD_MAX_AGE; });
  const anzahl=gs.youthSquad.length;
  const r=win.advanceYouthSquad(gs);
  const bewegt=r.hochgezogen.length+r.abgaenge.length;
  return gs.youthSquad.length===0 && bewegt===anzahl
    ? true : `${gs.youthSquad.length} blieben, ${bewegt} von ${anzahl} bewegt`;
});

check("Jüngere bleiben in der Jugend", () => {
  const p=win.genYouthPlayer(78,"ZM"); p.age=17;
  win.addToYouthSquad(gs,p);
  win.advanceYouthSquad(gs);
  return gs.youthSquad.some(x=>x.id===p.id) && p.age===18 ? true : "Jüngerer verloren";
});

console.log("\n--- Anzeige und Langzeit ---");
check("Die Jugendkarte wird gezeichnet", () => {
  win.switchTab("kader");
  const t=$("youthSquadPanel").textContent;
  return /Jugendkader/.test(t) ? true : "Karte leer";
});

check("Das Profil eines Jugendspielers öffnet", () => {
  if(gs.youthSquad.length===0) win.addToYouthSquad(gs, win.genYouthPlayer(78,"IV"));
  const p=gs.youthSquad[0];
  win.showPlayerDetail(p.id);
  const t=$("playerModalContent").textContent;
  win.closePlayerModal();
  return t.includes(p.name) && /Profikader/.test(t) ? true : "Profil unvollständig";
});

check("Fünf Saisons laufen mit Jugendkader durch", () => {
  for(let s=0;s<5;s++){
    saisonSpielen();
    if(gs.pendingYouthCandidates){
      win.handlePickYouthCandidate(0);
      win.handlePickYouthCandidate(1);
      win.finishYouthIntake();
    }
    gs.board.patience=90; gs.board.dismissed=false;
    win.startNextSeason();
    if(gs.youthSquad.length>K.YOUTH_SQUAD_MAX_SIZE) return "Jugendkader zu groß";
    if(gs.squad.length<K.MIN_SQUAD_SIZE) return `Profikader auf ${gs.squad.length}`;
  }
  return true;
});

check("Nach fünf Saisons gibt es Eigengewächse im Profikader", () => {
  const eigen=gs.squad.filter(p=>p.isYouthProduct).length;
  return eigen>0 ? true : "keine Eigengewächse hochgekommen";
});

check("Keine Laufzeitfehler", () => errors.length===0 ? true : errors.join(" | "));

console.log(fails===0?"\nAlle Tests bestanden.":`\n${fails} Test(s) fehlgeschlagen.`);
process.exit(fails===0?0:1);
