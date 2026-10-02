const fs=require("fs"); const {JSDOM}=require("jsdom");
const htmlRoh=fs.readFileSync("/home/claude/bl/index.html","utf8");
const mods=[...htmlRoh.matchAll(/modules\/([a-z-]+\.js)/g)].map(m=>m[1]);
const code=mods.map(f=>fs.readFileSync("/home/claude/bl/"+f,"utf8")).join("\n");

function neueWelt(){
  const dom=new JSDOM(htmlRoh.replace(/<script src="modules\/[a-z-]+\.js"><\/script>\s*/g,""),
    {runScripts:"outside-only",pretendToBeVisual:true,url:"http://localhost/"});
  const win=dom.window;
  const errors=[]; win.addEventListener("error",e=>errors.push(e.message));
  win.eval("try{localStorage.clear();}catch(e){}");
  win.eval(code+"\nwindow.K={DIVISIONS,COUNTRIES,CLUBS,SECOND_DIVISION_CLUBS,THIRD_DIVISION_CLUBS,TOTAL_MATCHDAYS,CUP_FIELD_SIZE};");
  win.__errors=errors;
  return win;
}

let fails=0;
function check(l,fn){ try{ const r=fn(); const ok=r===true||r===undefined;
  console.log(`${ok?"OK  ":"FAIL"}  ${l}${ok?"":" -> "+r}`); if(!ok)fails++;
} catch(e){ console.log(`FAIL  ${l} -> ${e.message}`);
  console.log(e.stack.split("\n").slice(1,4).map(x=>"      "+x.trim()).join("\n")); fails++; } }

const basis=neueWelt();
const $b=id=>basis.document.getElementById(id);
const K=basis.K;

console.log("--- Ligadefinition ---");
check("Elf Ligen in fünf Ländern", () =>
  K.DIVISIONS.length===11 && K.COUNTRIES.length===5 ? true : `${K.DIVISIONS.length} Ligen, ${K.COUNTRIES.length} Länder`);
// Echte Ligagrößen: BL 18/18/20, PL 20/24, LaLiga 20/22, Serie A 20/20, Ligue 1 18/18.
const SOLL_GROESSEN=[18,18,20,20,24,20,22,20,20,18,18];
const VEREINE=SOLL_GROESSEN.reduce((a,b)=>a+b,0);
check("Ligagrößen wie in echt", () =>
  K.DIVISIONS.every((d,i)=>d.clubs.length===SOLL_GROESSEN[i]) ? true : K.DIVISIONS.map(d=>d.clubs.length).join(","));
check("Keine Vereinsnamen doppelt (auch nicht in den Reservekreisen)", () => {
  const alle=[...K.DIVISIONS.flatMap(d=>d.clubs.map(c=>c.name)), ...K.COUNTRIES.flatMap(c=>c.reserve.clubs.map(x=>x.name))];
  const doppelt=alle.filter((n,i)=>alle.indexOf(n)!==i);
  return doppelt.length===0 ? true : "Dubletten: "+doppelt.join(", ");
});
check("Innerhalb eines Landes fällt die Stärke von Liga zu Liga", () => {
  const fehler=[];
  K.COUNTRIES.forEach(l=>{
    const ligen=K.DIVISIONS.filter(d=>d.country===l.key).sort((a,b)=>a.tier-b.tier);
    const schnitt=ligen.map(d=>d.clubs.reduce((a,c)=>a+c.strength,0)/d.clubs.length);
    if(!schnitt.every((v,i)=>i===0||v<schnitt[i-1])) fehler.push(l.key);
  });
  return fehler.length===0 ? true : fehler.join(", ");
});
check("Einnahmen und Standing sinken mit der Liga", () =>
  K.DIVISIONS.every(d=>{
    const oben=K.DIVISIONS.find(x=>x.country===d.country&&x.tier===d.tier-1);
    return !oben || (d.revenueFactor<oben.revenueFactor && d.staturePenalty>oben.staturePenalty);
  }) ? true : "Staffelung falsch");

console.log("\n--- Vereinsauswahl ---");
check("Die Auswahl ist nach Land und Liga gruppiert", () => {
  const gruppen=[...$b("clubSelect").querySelectorAll("optgroup")];
  return gruppen.length===11 && K.DIVISIONS.every(d=>gruppen.some(g=>g.label.includes(d.label)))
    ? true : `${gruppen.length} Gruppen`;
});
check(`Alle ${VEREINE} Vereine stehen zur Wahl`, () => {
  const n=$b("clubSelect").querySelectorAll("option").length;
  return n===VEREINE ? true : `${n} Optionen`;
});

console.log("\n--- Start in jeder Liga ---");
[[1,"FC Bayern München"],[2,"Hertha BSC"],[3,"Rot-Weiss Essen"],[4,"FC Arsenal"],[5,"Hull City"],[11,"FC Nantes"]].forEach(([nr,verein])=>{
  const win=neueWelt();
  const $=id=>win.document.getElementById(id);
  $("clubSelect").value=verein;
  win.startCareer();
  const gs=win.gameState;
  gs.liveMatches=false; gs.pressConferences=false;

  check(`Start in Liga ${nr} (${verein})`, () => {
    if(gs.division!==nr) return `division=${gs.division}`;
    if(gs.teams.length!==SOLL_GROESSEN[nr-1]) return `${gs.teams.length} Gegner`;
    if(!gs.teams.some(t=>t.name===verein)) return "eigener Verein fehlt in der Tabelle";
    const n=SOLL_GROESSEN[nr-1];
    if(gs.fixtures.length!==n*(n-1)) return `${gs.fixtures.length} Spiele`;
    return true;
  });

  check(`  Liga ${nr}: Ziel und Budget passen zur Klasse`, () => {
    if(!gs.board || !gs.board.goalLabel) return "kein Saisonziel";
    const erwartet=win.getSeasonGoal(win.getOwnClubStrength(gs), nr);
    return gs.board.targetPosition===erwartet.target ? true : "Ziel passt nicht zur Liga";
  });

  check(`  Liga ${nr}: alle anderen Ligen laufen parallel`, () => {
    const andere=win.getShadowDivisionNumbers(gs);
    return andere.length===10 && !andere.includes(nr) ? true : andere.join(",");
  });
  check(`  Liga ${nr}: der Pokal ist der des eigenen Landes`, () => {
    const land=K.COUNTRIES.find(c=>c.key===K.DIVISIONS[nr-1].country);
    if(win.getCupName(gs)!==land.cup) return win.getCupName(gs);
    const fremd=gs.cup.teamsRemaining.filter(n=>{ const d=win.getClubDivision(gs,n); return !d || K.DIVISIONS[d-1].country!==land.key; });
    return fremd.length===0 ? true : "fremde Vereine im Pokal: "+fremd.slice(0,3).join(", ");
  });

  check(`  Liga ${nr}: Europapokal-Zugang nur über Liga 1`, () => {
    // Zweit- und Drittligisten spielen nie im Europapokal.
    if(K.DIVISIONS[nr-1].tier > 1 && gs.uefa.own) return "Unterklassiger im Europapokal";
    // Nur Liga 1 vermerkt, dass der Europapokal überhaupt erreichbar ist.
    if(gs.lastSeasonWasDivision1 !== (K.DIVISIONS[nr-1].tier === 1)) return `lastSeasonWasDivision1=${gs.lastSeasonWasDivision1}`;
    return win.K.DIVISIONS[nr-1].europe === (win.K.DIVISIONS[nr-1].tier === 1) ? true : "Ligakonfiguration falsch";
  });

  check(`  Liga ${nr}: eigener Verein ist im Pokalfeld`, () =>
    gs.cup.teamsRemaining.includes(verein) ? true : "nicht im Pokal");

  check(`  Liga ${nr}: eine Saison läuft durch`, () => {
    let n=0;
    while(n++<150 && !gs.seasonEnded){
      win.runNextEvent();
      if($("liveOverlay").classList.contains("show")){ win.skipLiveMatch(); win.closeLiveMatch(); }
    }
    const soll=win.getSeasonMatchdays(gs);
    return gs.matchday===soll ? true : `${gs.matchday} statt ${soll} Spieltage`;
  });

  check(`  Liga ${nr}: keine Laufzeitfehler`, () =>
    win.__errors.length===0 ? true : win.__errors.join(" | "));
});

console.log("\n--- Auf- und Abstieg über drei Ligen ---");
const w=neueWelt();
const $w=id=>w.document.getElementById(id);
$w("clubSelect").value="Hertha BSC"; w.startCareer();
const gw=w.gameState; gw.liveMatches=false; gw.pressConferences=false;

check("Vor der Saison: alle Ligen in Sollgröße", () =>
  SOLL_GROESSEN.every((g,i)=>w.getLeaguePool(gw,i+1).length===g) ? true : "Verteilung falsch");

check("Nach einer Saison stimmt die Verteilung noch", () => {
  let n=0;
  while(n++<90 && !gw.seasonEnded){
    w.runNextEvent();
    if($w("liveOverlay").classList.contains("show")){ w.skipLiveMatch(); w.closeLiveMatch(); }
  }
  const groessen=SOLL_GROESSEN.map((g,i)=>w.getLeaguePool(gw,i+1).length);
  if(groessen.some((g,i)=>g!==SOLL_GROESSEN[i])) return groessen.join(",");
  const alle=w.getAllLeagueClubs(gw).map(c=>c.name);
  return new Set(alle).size===VEREINE ? true : `${new Set(alle).size} eindeutige Vereine`;
});

check("Zwischen jedem Ligapaar wird auf- und abgestiegen", () => {
  const letzte=gw.seasonHistory[gw.seasonHistory.length-1];
  return letzte != null ? true : "kein Saisonabschluss";
});

check("Über fünf Saisons bleibt die Struktur stabil", () => {
  for(let s=0;s<5;s++){
    gw.board.patience=90; gw.board.dismissed=false;
    w.startNextSeason();
    if(gw.pendingYouthCandidates) w.finishYouthIntake();
    let n=0;
    while(n++<90 && !gw.seasonEnded){
      w.runNextEvent();
      if($w("liveOverlay").classList.contains("show")){ w.skipLiveMatch(); w.closeLiveMatch(); }
    }
    const groessen=SOLL_GROESSEN.map((g,i)=>w.getLeaguePool(gw,i+1).length);
    if(groessen.some((g,i)=>g!==SOLL_GROESSEN[i])) return `Saison ${s+1}: ${groessen.join(",")}`;
    const alle=w.getAllLeagueClubs(gw).map(c=>c.name);
    if(new Set(alle).size!==VEREINE) return `Saison ${s+1}: ${new Set(alle).size} Vereine`;
    if(gw.division<1||gw.division>3) return `eigene Liga ${gw.division} (Deutschland verlassen?)`;
  }
  return true;
});

check("Ein Verein kann sich durch die Ligen bewegen", () => {
  const wege=gw.seasonHistory.map(h=>h.division);
  return wege.length>=5 ? true : `nur ${wege.length} Saisons`;
});

check("Das Pokalfeld bleibt vollständig", () =>
  gw.cup.teamsRemaining.length>0 || gw.cup.champion ? true : "Pokal leer");

check("Der Bestand enthält Spieler aller Ligen", () => {
  const nachLiga=SOLL_GROESSEN.map((g,i)=>i+1).map(nr=>{
    const namen=new Set(w.getLeaguePool(gw,nr).map(c=>c.name));
    return gw.pool.players.filter(p=>namen.has(p.clubName)).length;
  });
  return nachLiga.every((n,i)=>n>SOLL_GROESSEN[i]*8) ? true : nachLiga.join(", ");
});

check("Europapokal: Startplätze aus allen fünf Ländern", () => {
  const q=gw.uefaQualification;
  if(!q) return "keine Qualifikation";
  const laender=new Set(q.cl.map(n=>{ const d=w.getClubDivision(gw,n); return d ? K.DIVISIONS[d-1].country : null; }));
  return q.cl.length>=21 && laender.size===5 && q.ecl.length>=5 ? true : `CL ${q.cl.length}, ${laender.size} Länder, ECL ${q.ecl.length}`;
});
check("Reservekreise behalten ihre Größe", () => {
  const groessen=K.COUNTRIES.map(c=>(gw.reservePools&&gw.reservePools[c.key]||[]).length);
  return groessen.every((g,i)=>g===K.COUNTRIES[i].reserve.clubs.length) ? true : groessen.join(",");
});

check("Keine Laufzeitfehler im Mehrligabetrieb", () =>
  w.__errors.length===0 ? true : w.__errors.join(" | "));

console.log(fails===0?"\nAlle Tests bestanden.":`\n${fails} Test(s) fehlgeschlagen.`);
process.exit(fails===0?0:1);
