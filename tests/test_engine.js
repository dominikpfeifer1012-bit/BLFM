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
  win.eval(code);
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
$("clubSelect").value="Eintracht Frankfurt"; w.startCareer();
const gs=w.gameState; gs.liveMatches=false; gs.pressConferences=false;

console.log("--- Gemeinsame Torformel ---");
check("Gleich starke Teams: Heimteam erwartet mehr Tore", () => {
  const l=w.getBaseLambdas({attack:70,defence:70},{attack:70,defence:70});
  return l.home>l.away && Math.abs(l.home*l.away - 1.96) < 0.01 ? true : `${l.home.toFixed(2)} / ${l.away.toFixed(2)}`;
});
check("Neutraler Platz: beide Seiten gleich", () => {
  const l=w.getBaseLambdas({attack:70,defence:70},{attack:70,defence:70},true);
  return Math.abs(l.home-l.away)<1e-9 ? true : "ungleich";
});
check("Torschnitt bei rund 3 Toren, etwa ein Viertel Remis", () => {
  let tore=0, remis=0; const N=20000;
  for(let i=0;i<N;i++){ const r=w.simulateGenericMatch(70,70); tore+=r.goalsA+r.goalsB; if(r.goalsA===r.goalsB) remis++; }
  const t=tore/N, d=remis/N;
  return t>2.7 && t<3.2 && d>0.22 && d<0.32 ? true : `Tore ${t.toFixed(2)}, Remis ${(d*100).toFixed(0)} %`;
});
check("Der Favorit (Δ15) gewinnt meistens", () => {
  let s=0; const N=10000;
  for(let i=0;i<N;i++){ const r=w.simulateGenericMatch(80,65,true); if(r.goalsA>r.goalsB) s++; }
  return s/N>0.6 && s/N<0.85 ? true : `${(s/N*100).toFixed(0)} %`;
});
check("Erzeugter Kader passt zur Vereinsstärke", () => {
  const abw=[45,60,75,90].map(st=>w.teamRating(w.generateSquad(st),1)-st);
  return abw.every(a=>Math.abs(a)<=1.5) ? true : abw.join(", ");
});

console.log("\n--- Spielverlauf mit Ereignissen ---");
check("Rote Karte senkt die eigene Torerwartung danach", () => {
  const inc=[{type:"red",side:"own",minute:10}];
  const f=w.incidentFactors(inc,20), vorher=w.incidentFactors(inc,5);
  return f.own<1 && f.opp>1 && vorher.own===1 ? true : JSON.stringify(f);
});
check("Unterzahl ab Minute 1 kostet deutlich Tore", () => {
  let mit=0, ohne=0; const N=8000;
  for(let i=0;i<N;i++){
    mit+=w.playMatchSpan(1.5,1.2,true,0,90,[{type:"red",side:"own",minute:1}]).homeGoals;
    ohne+=w.playMatchSpan(1.5,1.2,true,0,90,[]).homeGoals;
  }
  return mit < ohne*0.85 ? true : `${(mit/N).toFixed(2)} vs ${(ohne/N).toFixed(2)}`;
});
check("Tore haben Minuten innerhalb des Abschnitts", () => {
  for(let i=0;i<300;i++){
    const r=w.playMatchSpan(2,2,true,45,90,[{type:"injury",side:"own",minute:60}]);
    if(r.goals.length!==r.homeGoals+r.awayGoals) return "Anzahl passt nicht";
    if(r.goals.some(g=>g.minute<=45||g.minute>90)) return "Minute außerhalb";
  }
  return true;
});
check("Eigenes Ligaspiel liefert Tore, Ereignisse und Torschützen", () => {
  const f=gs.fixtures.find(x=>x.home===gs.clubName||x.away===gs.clubName);
  const m=w.playOwnLeagueMatch(gs,f.home,f.away);
  return m.goals.length===m.homeGoals+m.awayGoals && Array.isArray(m.incidents) ? true : "unvollständig";
});

console.log("\n--- Elfmeterschießen ---");
check("Es gibt immer einen Sieger", () => {
  for(let i=0;i<2000;i++){ const e=w.penaltyShootout(70,70); if(e.home===e.away) return "Gleichstand"; }
  return true;
});
check("Abbruch, sobald entschieden", () => {
  for(let i=0;i<2000;i++){
    const e=w.penaltyShootout(70,70);
    if(e.seqHome.length<3 && e.seqHome.length===e.seqAway.length) return "zu früh beendet";
    if(e.seqHome.length>5 && e.seqHome.length!==e.seqAway.length) return "K.o.-Runde ungleich";
  }
  return true;
});
check("Pokal-Zeitachse mit Verlängerung und Elfmetern endet bei 120", () => {
  const pens=w.penaltyShootout(70,70);
  const tl=w.buildMatchTimeline({clubName:gs.clubName,home:gs.clubName,away:"SC Paderborn 07",homeGoals:2,awayGoals:2,
    scorers:[],cards:[],injuries:[],knockout:{extraTime:true,etHome:1,etAway:1,pens}});
  const ende=tl.find(e=>e.type==="end"), el=tl.find(e=>e.type==="pens");
  const tore=tl.filter(e=>e.type==="goal");
  return ende.minute===120 && el && tore.length===4 && tore.filter(e=>e.minute>90).length===2 ? true : `Ende ${ende.minute}, Tore ${tore.length}`;
});

console.log("\n--- Form und Noten ---");
check("Formbonus ist begrenzt", () => {
  const top=w.getFormBonus({form:[3,3,3,3,3]}), flop=w.getFormBonus({form:[0,0,0,0,0]});
  return top>0 && top<=2 && flop<0 && flop>=-2 ? true : `${top} / ${flop}`;
});

console.log("\n--- Saisonablauf ---");
check("Vorspulen bis zur Winterpause", () => {
  const ziel=Math.floor(w.getSeasonMatchdays(gs)/2);
  w.simulateUntil(ziel);
  return gs.matchday===ziel && !w.isBatchRunning() ? true : `Spieltag ${gs.matchday}`;
});
check("Noten werden vergeben (1 bis 6)", () => {
  const benotet=gs.squad.filter(p=>p.gradeCount>0);
  if(benotet.length<11) return `${benotet.length} Spieler benotet`;
  return benotet.every(p=>{ const n=w.getAverageGrade(p); return n>=1&&n<=6; }) ? true : "Note außerhalb";
});
check("Tabellenzeilen tragen die Form", () =>
  gs.teams.every(t=>Array.isArray(t.form)&&t.form.length===5) ? true : "Form fehlt");
check("Vorspulen bis Saisonende", () => {
  w.simulateUntil(w.getSeasonMatchdays(gs));
  return gs.seasonEnded ? true : `Spieltag ${gs.matchday}`;
});
check("Pokalrunden mit Remis haben Verlängerung", () => {
  const remis=(gs.cup.history||[]).flatMap(r=>r.matches).filter(m=>m.wasDraw);
  return remis.every(m=>m.extraTime && (m.pens || m.etHome!==m.etAway)) ? true : "ohne Entscheidung";
});
check("Keine Laufzeitfehler", () => w.__errors.length===0 ? true : w.__errors.join(" | "));

console.log(fails===0?"\nAlle Tests bestanden.":`\n${fails} Test(s) fehlgeschlagen.`);
process.exit(fails===0?0:1);
