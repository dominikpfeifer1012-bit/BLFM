// Akademie, Scouting, Entwicklungsrisiko, Bindung, Jugendwettbewerbe, KI-Akademien.
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
  win.eval(code+"\nwindow.K={FACILITIES,ACADEMY_LEVELS,SCOUT_MAX,SCOUT_REGIONS,TRIAL_MATCHDAYS,TRIAL_MAX,YOUTH_TEAM_MAX_AGE,DEV_RISK_MAX_AGE,ACADEMY_EST_EXACT_AGE,YOUTH_INTAKE_MAX_PICK,ACADEMY_SQUAD_BASE};");
  win.__errors=errors;
  win.document.getElementById("clubSelect").value=verein;
  win.startCareer();
  win.gameState.liveMatches=false; win.gameState.pressConferences=false;
  return win;
}

let fails=0;
function check(l,fn){ try{ const r=fn(); const ok=r===true||r===undefined;
  console.log(`${ok?"OK  ":"FAIL"}  ${l}${ok?"":" -> "+r}`); if(!ok)fails++;
} catch(e){ console.log(`FAIL  ${l} -> ${e.message}`);
  console.log(e.stack.split("\n").slice(1,4).map(x=>"      "+x.trim()).join("\n")); fails++; } }
const schnitt=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;

const w=neueWelt("FC Bayern München"); const gs=w.gameState; const K=w.K; const $=id=>w.document.getElementById(id);

// ---------- 4. Akademie in drei Teilen ----------
console.log("--- Akademie ---");
check("Bayern startet mit Akademie und Scouts", () => {
  const a=gs.academy;
  return a.infra>=3 && a.coaches>=2 && a.reputation>=50 && a.scouts.length>=1 ? true : JSON.stringify({infra:a.infra,coaches:a.coaches,rep:a.reputation,scouts:a.scouts.length});
});
check("Ein Drittligist beginnt fast bei null", () => {
  const v=neueWelt("SC Verl"); const a=v.gameState.academy;
  return a.infra<=1 && a.coaches<=1 && a.scouts.length===0 && a.reputation<a.repBase+1 ? true : JSON.stringify({infra:a.infra,coaches:a.coaches,scouts:a.scouts.length});
});
check("Jugendarbeit und Scouting sind keine Investitionen mehr", () =>
  !K.FACILITIES.youth && !K.FACILITIES.scouting && !/Jugendarbeit|Scouting/.test($("facilitiesPanel").textContent) ? true : "noch vorhanden");
check("Ausbau der Infrastruktur: mehr Plätze und Vorschläge, kostet Geld", () => {
  gs.budget=50e6; gs.academy.infra=1;
  const platz=w.getYouthSquadCapacity(gs), vorschlag=w.getYouthIntakeCount(gs), geld=gs.budget;
  const r=w.upgradeAcademy(gs,"infra"); w.upgradeAcademy(gs,"infra");
  return r.success && gs.academy.infra===3 && w.getYouthSquadCapacity(gs)>platz && w.getYouthIntakeCount(gs)>vorschlag && gs.budget<geld
    ? true : `${platz}→${w.getYouthSquadCapacity(gs)}, ${vorschlag}→${w.getYouthIntakeCount(gs)}`;
});
check("Jugendtrainer verbessern Entwicklung und Einschätzung", () => {
  gs.academy.coaches=0; const devOhne=w.getAcademyDevFactor(gs);
  const p=w.genYouthPlayer(80,"ZM"); gs.youthSquad.push(p);
  const e0=w.getPotentialEstimate(gs,p);
  gs.academy.coaches=5; const e5=w.getPotentialEstimate(gs,p);
  gs.youthSquad.pop();
  return w.getAcademyDevFactor(gs)>devOhne && (e5.hi-e5.lo)<(e0.hi-e0.lo) ? true : `${e0.hi-e0.lo} / ${e5.hi-e5.lo}`;
});
check("Akademie, Jugendtrainer und Scouts kosten laufend", () => {
  const vorher=w.getAcademyUpkeep(gs); gs.academy.infra=5;
  return vorher>0 && w.getAcademyUpkeep(gs)>vorher ? true : `${vorher}`;
});
check("Ruf bringt bessere Jahrgänge", () => {
  gs.academy.reputation=10; const wenig=w.getYouthQualityBonus(gs);
  gs.academy.reputation=95; const viel=w.getYouthQualityBonus(gs);
  return viel.strength>wenig.strength && viel.potential>wenig.potential ? true : JSON.stringify([wenig,viel]);
});
check("Altstand: Jugendarbeit und Scouting werden übernommen", () => {
  const alt=JSON.parse(JSON.stringify(gs)); delete alt.academy; alt.facilities.youth=5; alt.facilities.scouting=3;
  w.gameState=alt; w.ensureAcademy(alt); const a=alt.academy; w.gameState=gs;
  return a.infra===5 && a.scouts.some(s=>s.quality===4) && alt.facilities.youth===undefined && alt.facilities.scouting===undefined
    ? true : JSON.stringify({infra:a.infra, scouts:a.scouts.map(s=>s.quality)});
});

// ---------- 1. Scouts als Personal ----------
console.log("--- Scouts ---");
check("Scouts einstellen bis zur Grenze, Gehalt nach Sternen", () => {
  gs.academy.scouts=[];
  const markt=w.ensureScoutMarket(gs);
  const ids=markt.map(s=>s.id);
  ids.slice(0,K.SCOUT_MAX).forEach(id=>w.hireScout(gs,id));
  const zuviel=w.ensureScoutMarket(gs).length ? w.hireScout(gs, w.ensureScoutMarket(gs)[0].id) : {success:false};
  const s1=w.createScout(gs,1), s5=w.createScout(gs,5);
  return gs.academy.scouts.length===K.SCOUT_MAX && !zuviel.success && w.getScoutSalary(gs,s5)>w.getScoutSalary(gs,s1)
    ? true : `${gs.academy.scouts.length} Scouts`;
});
check("Auftrag: Region, Fokus und Position", () => {
  const s=gs.academy.scouts[0];
  const ok=[w.assignScout(gs,s.id,"region","suedamerika"), w.assignScout(gs,s.id,"focus","talente"), w.assignScout(gs,s.id,"line","STU")].every(r=>r.success);
  const falsch=w.assignScout(gs,s.id,"region","mond");
  return ok && !falsch.success && s.region==="suedamerika" ? true : "Auftrag nicht gesetzt";
});
check("Entlassen kostet eine Abfindung", () => {
  const s=gs.academy.scouts[2]; const geld=gs.budget;
  const r=w.fireScout(gs,s.id);
  return r.success && gs.academy.scouts.length===K.SCOUT_MAX-1 && gs.budget<geld ? true : r.message;
});

// ---------- 2. Berichte statt exakter Zahlen ----------
console.log("--- Berichte ---");
const scout=gs.academy.scouts[0]; scout.quality=4;
const funde=[]; for(let i=0;i<40;i++) funde.push(w.createProspect(gs, scout));
check("Talente kommen aus der Region des Scouts, 15 bis 17 Jahre", () => {
  const nats=K.SCOUT_REGIONS.suedamerika.nats;
  return funde.every(pr=>nats.includes(pr.player.nat) && pr.player.age>=15 && pr.player.age<=17 && ["OM","ST"].includes(pr.player.pos))
    ? true : "falsche Herkunft, Alter oder Position";
});
check("Potenzial nur als Spanne", () => {
  const e=funde.map(pr=>w.getPotentialEstimate(gs, pr.player));
  return e.every(x=>!x.exact && x.hi>x.lo) ? true : "exakte Werte sichtbar";
});
check("Spanne wird mit Beobachtung enger", () => {
  const pr=gs.academy.prospects[0]; const r=w.findReportFor(gs, pr.id);
  r.watched=0; const vorher=w.getReportWidth(r); r.watched=20; const nachher=w.getReportWidth(r);
  return nachher<vorher ? true : `${vorher} → ${nachher}`;
});
check("Gute Scouts irren seltener als schlechte", () => {
  const raus=q=>{ const s=w.createScout(gs,q); s.region="afrika"; s.home=null; let n=0;
    for(let i=0;i<300;i++){ const pr=w.createProspect(gs,s); const e=w.getPotentialEstimate(gs,pr.player);
      if(pr.player.maxStrength<e.lo-0.5||pr.player.maxStrength>e.hi+0.5) n++; }
    return n; };
  const schlecht=raus(1), gut=raus(5);
  return schlecht>gut && schlecht>10 ? true : `1★ ${schlecht}, 5★ ${gut} daneben`;
});
check("Regionskenntnis macht Markteinschätzungen enger", () => {
  const p=gs.pool.players.find(x=>x.nat==="BR" && x.clubName && x.age<=23);
  const merken=gs.academy.scouts; gs.academy.scouts=[];
  const ohne=w.getPotentialEstimate(gs,p);
  const s=w.createScout(gs,5); s.region="suedamerika"; gs.academy.scouts=[s];
  const mit=w.getPotentialEstimate(gs,p); gs.academy.scouts=merken;
  return (mit.hi-mit.lo)<(ohne.hi-ohne.lo) ? true : `${ohne.hi-ohne.lo} / ${mit.hi-mit.lo}`;
});
check("Marktberichte zu Spielern aus der Region", () => {
  const s=gs.academy.scouts[1]; s.region="iberia"; s.focus="jung"; s.line="alle";
  const r=[]; for(let i=0;i<5;i++){ const x=w.createMarketReport(gs,s); if(x) r.push(x); }
  const ok=r.every(x=>{ const p=w.getPoolPlayer(gs.pool,x.playerId); return p && ["ES","PT"].includes(p.nat) && p.age<=23; });
  return r.length>=3 && ok ? true : `${r.length} Berichte`;
});
check("Scouts arbeiten jeden Spieltag", () => {
  gs.academy.prospects=[]; gs.academy.reports=[];
  for(let i=0;i<34;i++) w.runScoutingMatchday(gs);
  return gs.academy.reports.length>0 ? true : "keine Funde in einer Saison";
});
check("Mehr Scouts: mehr unterschätzte Spieler am Markt", () => {
  const mit=w.getScoutingChanceBonus(gs); const merken=gs.academy.scouts; gs.academy.scouts=[];
  const ohne=w.getScoutingChanceBonus(gs); gs.academy.scouts=merken;
  return mit>ohne ? true : `${ohne} / ${mit}`;
});

// ---------- 3. Sichtung, Probetraining, Vertrag ----------
console.log("--- Probetraining und Vertrag ---");
gs.academy.prospects=[]; gs.academy.reports=[];
const talente=[]; for(let i=0;i<5;i++) talente.push(w.createProspect(gs, scout));
check("Probetraining kostet, begrenzt gleichzeitig", () => {
  gs.budget=20e6; const geld=gs.budget;
  const r=talente.slice(0,K.TRIAL_MAX).map(pr=>w.startTrial(gs,pr.id));
  const zuviel=w.startTrial(gs,talente[K.TRIAL_MAX].id);
  return r.every(x=>x.success) && !zuviel.success && gs.budget<geld ? true : zuviel.message;
});
check("Nach dem Probetraining ist die Spanne deutlich enger, der Charakter bekannt", () => {
  const pr=talente[0]; const vorher=w.getPotentialEstimate(gs,pr.player);
  const breiteVorher=vorher.hi-vorher.lo;
  gs.matchday=pr.trial.until; w.finishTrial(gs,pr);
  const nachher=w.getPotentialEstimate(gs,pr.player);
  return pr.trial.done && (nachher.hi-nachher.lo)<breiteVorher && pr.impression && nachher.lo<=pr.player.maxStrength+0.5 && nachher.hi>=pr.player.maxStrength-0.5
    ? true : `${breiteVorher} → ${nachher.hi-nachher.lo}`;
});
check("Probetraining macht eine Zusage wahrscheinlicher", () => {
  const pr=talente[1]; pr.interest=0; const vorher=w.getProspectAcceptChance(gs,pr);
  pr.trial.done=true; const nachher=w.getProspectAcceptChance(gs,pr);
  return nachher>vorher ? true : `${vorher} → ${nachher}`;
});
check("Jugendvertrag: Talent kommt in den Jugendkader, Entschädigung wird bezahlt", () => {
  let angenommen=null;
  for(let i=0;i<30 && !angenommen;i++){
    const pr=w.createProspect(gs, scout); pr.interest=95; pr.club="Testverein";
    const geld=gs.budget; const r=w.offerYouthContract(gs,pr.id);
    if(r.accepted) angenommen={p:r.player, geld, fee:w.getProspectFee(gs,pr)};
  }
  if(!angenommen) return "nie angenommen";
  const p=angenommen.p;
  return gs.youthSquad.some(x=>x.id===p.id) && p.isYouthProduct && p.academySince===gs.season && gs.budget<angenommen.geld
    ? true : "nicht korrekt übernommen";
});
check("Ferne Regionen: Eingewöhnung", () => {
  const p=gs.youthSquad.find(x=>x.scoutedFrom==="suedamerika");
  return p && p.adaptSeason===gs.season && w.getPersonalDevFactor(gs,p)<(p.devSpeed||1)+0.001 ? true : "keine Eingewöhnung";
});
check("Voller Jugendkader: kein Vertrag", () => {
  const merken=gs.youthSquad.slice();
  while(gs.youthSquad.length<w.getYouthSquadCapacity(gs)) gs.youthSquad.push(w.genYouthPlayer(70,"IV"));
  const pr=w.createProspect(gs,scout); const r=w.offerYouthContract(gs,pr.id);
  gs.youthSquad=merken;
  return !r.success && /voll/.test(r.message) ? true : r.message;
});
check("Konkurrenz: Toptalente werden weggeschnappt", () => {
  gs.academy.prospects=[]; gs.academy.reports=[];
  for(let i=0;i<10;i++){ const pr=w.createProspect(gs,scout); w.shiftPlayerPotential(pr.player, 95-pr.player.maxStrength); }
  gs.academy.scouts.forEach(s=>s.region=null);
  for(let i=0;i<12;i++) w.runScoutingMatchday(gs);
  return gs.academy.prospects.length<10 ? true : "niemand weggeschnappt";
});

// ---------- 5. Entwicklung mit Risiko ----------
console.log("--- Entwicklung mit Risiko ---");
check("Talente haben ein persönliches Entwicklungstempo", () => {
  const t=[]; for(let i=0;i<50;i++) t.push(w.genYouthPlayer(75,"ZM").devSpeed);
  return t.every(x=>x>=0.8&&x<=1.2) && Math.max(...t)-Math.min(...t)>0.2 ? true : "kein Tempo";
});
check("Durchbruch und Stagnation kommen vor, das Potenzial bleibt über dem Istwert", () => {
  const merken=gs.youthSquad; gs.youthSquad=[];
  for(let i=0;i<200;i++){ const p=w.genYouthPlayer(75,"ZM"); p.age=18; gs.youthSquad.push(p); }
  const e=w.rollDevelopmentEvents(gs);
  const hoch=e.filter(x=>x.type==="durchbruch").length, runter=e.filter(x=>x.type==="stagnation").length;
  const ok=gs.youthSquad.every(p=>p.maxStrength>=p.strength);
  gs.youthSquad=merken;
  return hoch>3 && runter>5 && ok ? true : `${hoch} Durchbrüche, ${runter} Stagnationen`;
});
check("Spielpraxis macht einen Durchbruch wahrscheinlicher", () => {
  const p=w.genYouthPlayer(75,"ZM"); p.age=18; gs.youthSquad.push(p);
  p.gradeCount=0; p.youthApps=0; const wenig=w.getDevEventChances(gs,p);
  p.gradeCount=25; const viel=w.getDevEventChances(gs,p);
  gs.youthSquad.pop();
  return viel.durchbruch>wenig.durchbruch && viel.stagnation<wenig.stagnation ? true : JSON.stringify([wenig,viel]);
});
check("Mentor: nur erfahren, stärker, gleicher Mannschaftsteil", () => {
  const talent=w.genYouthPlayer(75,"IV"); talent.age=18; gs.youthSquad.push(talent);
  const jung=gs.squad.find(p=>p.age<25 && p.strength>talent.strength+5);
  const sturm=gs.squad.find(p=>["ST","OM"].includes(p.pos) && p.age>=27);
  const passend=gs.squad.find(p=>["IV","LV","RV"].includes(p.pos) && p.age>=27 && p.strength>=talent.strength+5);
  const a=w.assignMentor(gs,talent.id,jung?jung.id:"x"), b=w.assignMentor(gs,talent.id,sturm?sturm.id:"x");
  const c=passend ? w.assignMentor(gs,talent.id,passend.id) : {success:false,message:"kein Kandidat"};
  return !a.success && !b.success && c.success && w.getMentorDevFactor(gs,talent)>1 ? true : [a.message,b.message,c.message].join(" | ");
});
check("Mentor erhöht die Chance auf einen Durchbruch", () => {
  const talent=gs.youthSquad[gs.youthSquad.length-1];
  const mit=w.getDevEventChances(gs,talent).durchbruch;
  w.assignMentor(gs,talent.id,null);
  const ohne=w.getDevEventChances(gs,talent).durchbruch;
  return mit>ohne ? true : `${ohne} / ${mit}`;
});

// ---------- 6. Bindung und Abwerbung ----------
console.log("--- Bindung und Abwerbung ---");
check("Gerade erst aufgenommen: noch keine Forderung", () => {
  const p=w.genYouthPlayer(80,"ST"); p.age=19; w.shiftPlayerPotential(p, 95-p.maxStrength); w.addToYouthSquad(gs,p);
  const ok=!w.getPerspectiveCandidates(gs).some(x=>x.id===p.id);
  gs.youthSquad=gs.youthSquad.filter(x=>x.id!==p.id);
  return ok ? true : "fordert sofort";
});
check("Talente ohne Profivertrag fordern eine Perspektive", () => {
  const p=w.genYouthPlayer(80,"ST"); p.age=19; w.shiftPlayerPotential(p, 95-p.maxStrength); w.addToYouthSquad(gs,p);
  p.academySince=gs.season-1;
  gs.matchday=Math.round(w.getSeasonMatchdays(gs)*0.65);
  w.checkPerspectiveWarnings(gs);
  return p.wantsPerspective===gs.season ? true : "keine Warnung";
});
check("Ohne Profivertrag kann er gehen, der Verein bekommt eine Entschädigung", () => {
  const p=gs.youthSquad.find(x=>x.wantsPerspective===gs.season);
  let weg=false; const geld=gs.budget;
  for(let i=0;i<20 && !weg;i++){ const r=w.resolvePerspectives(gs); weg=r.some(g=>g.player.id===p.id); if(!weg) p.wantsPerspective=gs.season; }
  return weg && gs.budget>geld && !gs.youthSquad.some(x=>x.id===p.id) ? true : "blieb immer";
});
check("Mit Profivertrag bleibt er", () => {
  const p=w.genYouthPlayer(80,"ST"); p.age=19; w.shiftPlayerPotential(p, 95-p.maxStrength); w.addToYouthSquad(gs,p);
  p.academySince=gs.season-1; p.wantsPerspective=gs.season; w.promoteYouthPlayer(gs,p.id);
  return p.wantsPerspective===undefined && gs.squad.some(x=>x.id===p.id) ? true : "Warnung bleibt";
});
check("Großvereine versuchen, Toptalente abzuwerben", () => {
  const v=neueWelt("SC Freiburg"); const g=v.gameState;
  const p=v.genYouthPlayer(80,"OM"); v.shiftPlayerPotential(p, 92-p.maxStrength); v.addToYouthSquad(g,p);
  let o=null; for(let i=0;i<60 && !o;i++){ g.incomingOffers=[]; o=v.tryPoachOffer(g,1); }
  if(!o) return "kein Abwerbeversuch";
  const geld=g.budget; const r=v.acceptIncomingOffer(g,o.id);
  return o.poach && r.success && g.budget>geld && !g.youthSquad.some(x=>x.id===p.id) ? true : r.message;
});

// ---------- 7. Jugendwettbewerbe ----------
console.log("--- Jugendwettbewerbe ---");
check("Jugendliga mit eigener Tabelle", () => {
  const l=gs.youthLeague;
  return l && l.teams.length>=12 && l.teams.length%2===0 && l.teams.some(t=>t.name===gs.clubName) && /U19/.test(l.name) ? true : JSON.stringify(l&&l.teams.length);
});
check("Keine Profi-Reservisten in der Jugendelf", () => {
  const lineup=w.getYouthLineup(gs,gs.matchday+1);
  return lineup.every(p=>p.age<=K.YOUTH_TEAM_MAX_AGE) ? true : "zu alte Spieler";
});
check("Youth League nur mit Champions-League-Teilnahme", () => {
  const v=neueWelt("SC Verl");
  return !!gs.youthCup === (gs.uefa && gs.uefa.own==="cl") && !v.gameState.youthCup ? true : `${!!gs.youthCup} / ${gs.uefa&&gs.uefa.own}`;
});

// ---------- 8. KI-Akademien ----------
console.log("--- KI-Akademien ---");
check("Neue Spieler im Bestand stammen auch aus KI-Akademien", () => {
  gs.season++; w.advancePool(gs);
  const neu=gs.pool.players.filter(p=>p.homegrownAt);
  return neu.length>=20 && neu.every(p=>p.clubName) ? true : `${neu.length} Eigengewächse`;
});

// ---------- Saisonlauf und Oberfläche ----------
console.log("--- Saison und Oberfläche ---");
check("Eine Saison mit Akademie läuft durch", () => {
  const v=neueWelt("VfB Stuttgart"); const g=v.gameState;
  let n=0;
  while(n++<120 && !g.seasonEnded){ v.runNextEvent();
    if(v.document.getElementById("liveOverlay").classList.contains("show")){ v.skipLiveMatch(); v.closeLiveMatch(); }
    v.document.querySelectorAll(".modalOverlay.show").forEach(e=>e.classList.remove("show")); }
  const l=g.youthLeague; const gespielt=l.teams.every(t=>t.played===2*(l.teams.length-1));
  const meister=(g.news||[]).some(n=>/Meister der U19/.test(n.text)) && !(g.honours||[]).some(h=>/U19/.test(h.label));
  return g.seasonEnded && gespielt && meister && (g.pendingYouthCandidates||[]).length>=5 && v.__errors.length===0
    ? true : `beendet ${g.seasonEnded}, Liga ${gespielt}, Meister ${meister}, Fehler ${v.__errors.join("|")}`;
});
check("Akademie-Tab zeigt Akademie, Scouts, Talente und Berichte", () => {
  w.switchTab("akademie");
  const t=$("tab-akademie").textContent;
  return /Infrastruktur/.test(t) && /Jugendtrainer/.test(t) && /Ruf/.test(t) && $("scoutPanel").querySelectorAll("select").length>0
    ? true : t.slice(0,200);
});
check("Jahrgang zeigt Potenzial als Spanne", () => {
  gs.academy.coaches=0;
  gs.pendingYouthCandidates=w.createYouthCandidates(gs);
  w.showYouthIntakeModal();
  const t=$("youthIntakeContent").textContent;
  return /Potenzial \d+–\d+/.test(t) ? true : t.slice(0,200);
});
check("Spielerprofil: Schätzung und Mentor-Auswahl", () => {
  w.finishYouthIntake();
  const p=w.genYouthPlayer(75,"IV"); p.age=18; w.addToYouthSquad(gs,p);
  w.showPlayerDetail(p.id);
  const t=$("playerModalContent").innerHTML;
  return /Schätzung/.test(t) && /Mentor/.test(t) ? true : "fehlt";
});
check("Marktprofil zeigt den Scoutbericht", () => {
  const s=gs.academy.scouts[0]; s.region="iberia"; s.focus="jung";
  let r=null; for(let i=0;i<5 && !r;i++) r=w.createMarketReport(gs,s);
  w.showPoolPlayerDetail(r.playerId);
  return /Scoutbericht/.test($("playerModalContent").textContent) ? true : "kein Bericht";
});
check("Keine Laufzeitfehler", () => w.__errors.length===0 ? true : w.__errors.join(" | "));

console.log(fails===0?"\nAlle Prüfungen bestanden.":`\n${fails} Prüfung(en) fehlgeschlagen.`);
process.exit(fails?1:0);
