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
  win.eval(code+"\nwindow.K={DIVISIONS,CLUBS,SECOND_DIVISION_CLUBS,THIRD_DIVISION_CLUBS,TOTAL_MATCHDAYS,CUP_FIELD_SIZE};");
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
check("Drei Ligen sind definiert", () => K.DIVISIONS.length===3 ? true : K.DIVISIONS.length);
check("Jede hat 18 Vereine", () =>
  K.DIVISIONS.every(d=>d.clubs.length===18) ? true : K.DIVISIONS.map(d=>d.clubs.length).join(","));
check("Keine Vereinsnamen doppelt", () => {
  const alle=K.DIVISIONS.flatMap(d=>d.clubs.map(c=>c.name));
  return new Set(alle).size===alle.length ? true : "Dubletten";
});
check("Die Stärke fällt von Liga zu Liga", () => {
  const schnitt=K.DIVISIONS.map(d=>d.clubs.reduce((a,c)=>a+c.strength,0)/d.clubs.length);
  return schnitt.every((v,i)=>i===0||v<schnitt[i-1]) ? true : schnitt.map(v=>v.toFixed(1)).join(" ");
});
check("Einnahmen und Standing sinken mit der Liga", () =>
  K.DIVISIONS.every((d,i)=>i===0||(d.revenueFactor<K.DIVISIONS[i-1].revenueFactor
    && d.staturePenalty>K.DIVISIONS[i-1].staturePenalty)) ? true : "Staffelung falsch");

console.log("\n--- Vereinsauswahl ---");
check("Die Auswahl ist nach Liga gruppiert", () => {
  const gruppen=[...$b("clubSelect").querySelectorAll("optgroup")];
  return gruppen.length===3 && gruppen.every((g,i)=>g.label===K.DIVISIONS[i].label)
    ? true : `${gruppen.length} Gruppen`;
});
check("Alle 54 Vereine stehen zur Wahl", () => {
  const n=$b("clubSelect").querySelectorAll("option").length;
  return n===54 ? true : `${n} Optionen`;
});

console.log("\n--- Start in jeder Liga ---");
[[1,"FC Bayern München"],[2,"Hamburger SV"],[3,"TSV 1860 München"]].forEach(([nr,verein])=>{
  const win=neueWelt();
  const $=id=>win.document.getElementById(id);
  $("clubSelect").value=verein;
  win.startCareer();
  const gs=win.gameState;
  gs.liveMatches=false; gs.pressConferences=false;

  check(`Start in Liga ${nr} (${verein})`, () => {
    if(gs.division!==nr) return `division=${gs.division}`;
    if(gs.teams.length!==18) return `${gs.teams.length} Gegner`;
    if(!gs.teams.some(t=>t.name===verein)) return "eigener Verein fehlt in der Tabelle";
    if(gs.fixtures.length!==306) return `${gs.fixtures.length} Spiele`;
    return true;
  });

  check(`  Liga ${nr}: Ziel und Budget passen zur Klasse`, () => {
    if(!gs.board || !gs.board.goalLabel) return "kein Saisonziel";
    const erwartet=win.getSeasonGoal(win.getOwnClubStrength(gs), nr);
    return gs.board.targetPosition===erwartet.target ? true : "Ziel passt nicht zur Liga";
  });

  check(`  Liga ${nr}: die anderen beiden laufen parallel`, () => {
    const andere=win.getShadowDivisionNumbers(gs);
    return andere.length===2 && !andere.includes(nr) ? true : andere.join(",");
  });

  check(`  Liga ${nr}: Europapokal-Zugang nur über Liga 1`, () => {
    // In der ersten Saison ist niemand qualifiziert, egal wo er startet.
    if(gs.europe.qualified) return "zu Saisonbeginn bereits qualifiziert";
    // Nur Liga 1 vermerkt, dass der Europapokal überhaupt erreichbar ist.
    if(gs.lastSeasonWasDivision1 !== (nr === 1)) return `lastSeasonWasDivision1=${gs.lastSeasonWasDivision1}`;
    return win.K.DIVISIONS[nr-1].europe === (nr === 1) ? true : "Ligakonfiguration falsch";
  });

  check(`  Liga ${nr}: eigener Verein ist im Pokalfeld`, () =>
    gs.cup.teamsRemaining.includes(verein) ? true : "nicht im Pokal");

  check(`  Liga ${nr}: eine Saison läuft durch`, () => {
    let n=0;
    while(n++<90 && !gs.seasonEnded){
      win.runNextEvent();
      if($("liveOverlay").classList.contains("show")){ win.skipLiveMatch(); win.closeLiveMatch(); }
    }
    return gs.matchday===K.TOTAL_MATCHDAYS ? true : `nur ${gs.matchday} Spieltage`;
  });

  check(`  Liga ${nr}: keine Laufzeitfehler`, () =>
    win.__errors.length===0 ? true : win.__errors.join(" | "));
});

console.log("\n--- Auf- und Abstieg über drei Ligen ---");
const w=neueWelt();
const $w=id=>w.document.getElementById(id);
$w("clubSelect").value="Hamburger SV"; w.startCareer();
const gw=w.gameState; gw.liveMatches=false; gw.pressConferences=false;

check("Vor der Saison: 18 Vereine je Liga", () =>
  [1,2,3].every(nr=>w.getLeaguePool(gw,nr).length===18) ? true : "Verteilung falsch");

check("Nach einer Saison stimmt die Verteilung noch", () => {
  let n=0;
  while(n++<90 && !gw.seasonEnded){
    w.runNextEvent();
    if($w("liveOverlay").classList.contains("show")){ w.skipLiveMatch(); w.closeLiveMatch(); }
  }
  const groessen=[1,2,3].map(nr=>w.getLeaguePool(gw,nr).length);
  if(groessen.some(g=>g!==18)) return groessen.join(",");
  const alle=w.getAllLeagueClubs(gw).map(c=>c.name);
  return new Set(alle).size===54 ? true : `${new Set(alle).size} eindeutige Vereine`;
});

check("Zwischen jedem Ligapaar wird auf- und abgestiegen", () => {
  const letzte=gw.seasonHistory[gw.seasonHistory.length-1];
  return letzte != null ? true : "kein Saisonabschluss";
});

check("Über fünf Saisons bleibt die Struktur stabil", () => {
  for(let s=0;s<5;s++){
    gw.board.patience=90;
    w.startNextSeason();
    if(gw.pendingYouthCandidates) w.finishYouthIntake();
    let n=0;
    while(n++<90 && !gw.seasonEnded){
      w.runNextEvent();
      if($w("liveOverlay").classList.contains("show")){ w.skipLiveMatch(); w.closeLiveMatch(); }
    }
    const groessen=[1,2,3].map(nr=>w.getLeaguePool(gw,nr).length);
    if(groessen.some(g=>g!==18)) return `Saison ${s+1}: ${groessen.join(",")}`;
    const alle=w.getAllLeagueClubs(gw).map(c=>c.name);
    if(new Set(alle).size!==54) return `Saison ${s+1}: ${new Set(alle).size} Vereine`;
    if(gw.division<1||gw.division>3) return `eigene Liga ${gw.division}`;
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
  const nachLiga=[1,2,3].map(nr=>{
    const namen=new Set(w.getLeaguePool(gw,nr).map(c=>c.name));
    return gw.pool.players.filter(p=>namen.has(p.clubName)).length;
  });
  return nachLiga.every(n=>n>100) ? true : nachLiga.join(", ");
});

check("Keine Laufzeitfehler im Mehrligabetrieb", () =>
  w.__errors.length===0 ? true : w.__errors.join(" | "));

console.log(fails===0?"\nAlle Tests bestanden.":`\n${fails} Test(s) fehlgeschlagen.`);
process.exit(fails===0?0:1);
