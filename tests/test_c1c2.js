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
  +"\nwindow.K={BOARD_REWARD_MIN_RANKS,BOARD_REWARD_MAX,JOB_OFFER_COUNT,MIN_SQUAD_SIZE,DEFAULT_FORMATION};");
let fails=0;
function check(l,fn){ try{ const r=fn(); const ok=r===true||r===undefined;
  console.log(`${ok?"OK  ":"FAIL"}  ${l}${ok?"":" -> "+r}`); if(!ok)fails++;
} catch(e){ console.log(`FAIL  ${l} -> ${e.message}`);
  console.log(e.stack.split("\n").slice(1,4).map(x=>"      "+x.trim()).join("\n")); fails++; } }
const $=id=>win.document.getElementById(id);
const K=win.K;

$("clubSelect").value="VfB Stuttgart"; win.startCareer();
const gs=win.gameState; gs.liveMatches=false;

function setzePlatz(platz){
  const andere=gs.teams.filter(t=>t.name!==gs.clubName);
  const eigen=gs.teams.find(t=>t.name===gs.clubName);
  andere.forEach((t,i)=>{ t.points=100-(i<platz-1?i:i+1); t.gf=0; t.ga=0; });
  eigen.points=100-(platz-1); eigen.gf=0; eigen.ga=0;
}

console.log("--- C2: Belohnung für Übererfüllung ---");
check("Deutliche Übererfüllung bringt Geld", () => {
  setzePlatz(2);
  gs.board=win.createFreshBoard(78,1); gs.board.targetPosition=10;
  const budget=gs.budget;
  const r=win.evaluateBoard(gs);
  return r.reward>0 && gs.budget===budget+r.reward ? true : `Bonus ${r.reward}`;
});

check("Zielerfüllung allein bringt nichts", () => {
  setzePlatz(10);
  gs.board=win.createFreshBoard(78,1); gs.board.targetPosition=10;
  return win.evaluateBoard(gs).reward===0 ? true : "Bonus ohne Übererfüllung";
});

check("Zielverfehlung bringt nichts", () => {
  setzePlatz(15);
  gs.board=win.createFreshBoard(78,1); gs.board.targetPosition=6;
  return win.evaluateBoard(gs).reward===0 ? true : "Bonus trotz Verfehlung";
});

check("Knappe Übererfüllung reicht nicht", () => {
  setzePlatz(9);
  gs.board=win.createFreshBoard(78,1); gs.board.targetPosition=10;
  return win.evaluateBoard(gs).reward===0 ? true : "Bonus schon bei einem Platz";
});

check("Der Bonus ist gedeckelt", () => {
  setzePlatz(1);
  gs.board=win.createFreshBoard(78,1); gs.board.targetPosition=18;
  return win.evaluateBoard(gs).reward<=K.BOARD_REWARD_MAX ? true : "über dem Deckel";
});

check("Der Bonus wächst mit dem Standing", () => {
  const messen=(standing)=>{
    gs.clubStature=standing;
    setzePlatz(2);
    gs.board=win.createFreshBoard(78,1); gs.board.targetPosition=10;
    return win.evaluateBoard(gs).reward;
  };
  const klein=messen(58), gross=messen(88);
  gs.clubStature=78;
  return gross>klein ? true : `${klein} vs ${gross}`;
});

console.log("\n--- C1: Vereinswechsel nach Entlassung ---");
check("Angebote werden erzeugt", () => {
  const a=win.generateJobOffers(gs);
  return a.length===K.JOB_OFFER_COUNT ? true : `${a.length} Angebote`;
});

check("Angebote sind schwächer als der bisherige Verein", () => {
  gs.clubStature=78;
  const a=win.generateJobOffers(gs);
  return a.every(x=>x.strength<78) ? true : a.map(x=>x.name+" "+x.strength).join(", ");
});

check("Der eigene Verein ist nicht dabei", () =>
  win.generateJobOffers(gs).every(a=>a.name!==gs.clubName) ? true : "eigener Verein im Angebot");

check("Jedes Angebot nennt Ziel und Budget", () =>
  win.generateJobOffers(gs).every(a=>a.goal && a.goal.label && a.budget>0) ? true : "unvollständig");

check("Entlassungsdialog zeigt die Angebote", () => {
  setzePlatz(18);
  gs.board=win.createFreshBoard(78,1); gs.board.targetPosition=1; gs.board.patience=2;
  const r=win.evaluateBoard(gs);
  if(!r.dismissed) return "keine Entlassung";
  win.showDismissalModal(r);
  const t=$("dismissalContent").textContent;
  return /Angebote/.test(t) && $("dismissalOverlay").classList.contains("show")
    ? true : "Angebote fehlen im Dialog";
});

check("Ein Angebot lässt sich annehmen", () => {
  const angebote=win.generateJobOffers(gs);
  const ziel=angebote[0];
  const trainer=gs.manager;
  const erfolge=(gs.achievements||[]).length;
  const historie=(gs.seasonHistory||[]).length;

  win.acceptJobOffer(ziel.name);

  if(gs.clubName!==ziel.name) return "Verein nicht gewechselt";
  if(gs.manager!==trainer) return "Trainername verloren";
  if((gs.achievements||[]).length!==erfolge) return "Erfolge verloren";
  if((gs.seasonHistory||[]).length!==historie) return "Vereinsgeschichte verloren";
  return true;
});

check("Nach dem Wechsel ist alles Vereinsgebundene neu", () => {
  if(gs.board.dismissed) return "Vorstand noch entlassen";
  if(gs.seasonEnded) return "Saison noch beendet";
  if(gs.matchday!==0) return "Spieltag nicht zurückgesetzt";
  if(gs.squad.length<K.MIN_SQUAD_SIZE) return "Kader zu klein";
  if(gs.youth.played!==0) return "Jugendbilanz nicht zurückgesetzt";
  if(Object.keys(gs.lineup).length!==0) return "alte Aufstellung übernommen";
  if(gs.formation!==K.DEFAULT_FORMATION) return "Formation nicht zurückgesetzt";
  return true;
});

check("Der neue Kader ist vollständig ausgestattet", () =>
  gs.squad.every(p=>p.attributes && typeof p.morale==="number" && p.contractYears>0)
    ? true : "Kader unvollständig");

check("Der neue Verein spielt in der richtigen Liga", () => {
  return win.getClubDivision(gs,gs.clubName)===gs.division ? true : `Liga ${gs.division} passt nicht`;
});

check("Spielplan und Wettbewerbe sind neu aufgesetzt", () => {
  const n=gs.teams.length;
  if(gs.fixtures.length!==n*(n-1)) return `${gs.fixtures.length} Spiele bei ${n} Vereinen`;
  if(gs.fixtures.some(f=>f.played)) return "Spielplan nicht frisch";
  if(gs.cup.round!==0) return "Pokal nicht zurückgesetzt";
  return true;
});

check("Der Dialog ist geschlossen", () => !$("dismissalOverlay").classList.contains("show"));

check("Beim neuen Verein lässt sich weiterspielen", () => {
  let n=0;
  while(n++<30 && gs.matchday<8 && !gs.seasonEnded){
    win.runNextEvent();
    if($("liveOverlay").classList.contains("show")){ win.skipLiveMatch(); win.closeLiveMatch(); }
  }
  return gs.matchday>=8 ? true : `nur ${gs.matchday} Spieltage`;
});

check("Keine Laufzeitfehler", () => errors.length===0 ? true : errors.join(" | "));

console.log(fails===0?"\nAlle Tests bestanden.":`\n${fails} Test(s) fehlgeschlagen.`);
process.exit(fails===0?0:1);
