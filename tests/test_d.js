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
  +"\nwindow.K={TOTAL_MATCHDAYS,NATIONALITY_BY_CODE,LOG_PAGE_SIZE,LOG_MAX_ENTRIES,POSITION_ORDER,DIVISION_COUNT:DIVISIONS.length};");
let fails=0;
function check(l,fn){ try{ const r=fn(); const ok=r===true||r===undefined;
  console.log(`${ok?"OK  ":"FAIL"}  ${l}${ok?"":" -> "+r}`); if(!ok)fails++;
} catch(e){ console.log(`FAIL  ${l} -> ${e.message}`);
  console.log(e.stack.split("\n").slice(1,4).map(x=>"      "+x.trim()).join("\n")); fails++; } }
const $=id=>win.document.getElementById(id);

$("clubSelect").value="VfB Stuttgart"; win.startCareer();
const gs=win.gameState; gs.liveMatches=false;

console.log("--- D2: Flaggen mit Rückfallebene ---");
check("Die Unterstützung wird erkannt", () => typeof win.browserSupportsFlags()==="boolean");
check("Die Erkennung lässt sich überstimmen", () => {
  win.setFlagSupport(true);
  const mit = win.getFlag({nat:"DE"});
  win.setFlagSupport(false);
  const ohne = win.getFlag({nat:"DE"});
  return mit !== ohne ? true : "Umschalten wirkt nicht";
});

check("Ohne Flaggen-Unterstützung kommt ein Länderkürzel", () => {
  win.setFlagSupport(false);
  const p={nat:"BR"};
  const f=win.getFlag(p);
  return /natCode/.test(f) && /BR/.test(f) ? true : f;
});

check("Mit Unterstützung kommt die Flagge", () => {
  win.setFlagSupport(true);
  const f=win.getFlag({nat:"BR"});
  return f==="🇧🇷" ? true : f;
});

check("Unbekannte Herkunft liefert nichts", () => {
  win.setFlagSupport(false);
  return win.getFlag({nat:"ZZ"})==="" && win.getFlag({})==="";
});

check("Textvariante liefert nie HTML", () => {
  win.setFlagSupport(false);
  const t=win.getFlagText({nat:"DE"});
  return t==="DE" && !/</.test(t) ? true : t;
});

check("Der Kader zeigt die Kürzel lesbar an", () => {
  win.setFlagSupport(false);
  win.renderSquad(gs);
  const h=$("squadTable").innerHTML;
  return /natCode/.test(h) ? true : "keine Kürzel im Kader";
});

console.log("\n--- D4: Tabellen der anderen Ligen ---");

const andereLigen = () => win.getShadowDivisionNumbers(gs);

check("Für jede fremde Liga läuft eine Parallelsaison", () => {
  const nummern = andereLigen();
  const erwartet = win.K.DIVISION_COUNT - 1;
  if(nummern.length !== erwartet) return `${nummern.length} statt ${erwartet}`;
  return nummern.every(nr => {
    const s = gs.shadowLeagues[nr];
    return s && s.teams.length === 18 && s.fixtures.length === 306;
  }) ? true : "unvollständig angelegt";
});

check("Die eigene Liga läuft nicht doppelt", () =>
  andereLigen().includes(gs.division) ? "eigene Liga doppelt" : true);

check("Sie enthalten die richtigen Vereine", () =>
  andereLigen().every(nr => {
    const namen = new Set(gs.shadowLeagues[nr].teams.map(t => t.name));
    return win.getLeaguePool(gs, nr).every(c => namen.has(c.name));
  }) ? true : "Vereine stimmen nicht");

let n=0;
while(n++<40 && gs.matchday<12){ win.runNextEvent();
  if($("liveOverlay").classList.contains("show")){ win.skipLiveMatch(); win.closeLiveMatch(); } }

check("Alle spielen parallel mit", () =>
  andereLigen().every(nr => gs.shadowLeagues[nr].matchday === gs.matchday)
    ? true : "Spieltage laufen auseinander");

check("Jedes Team hat gleich viele Spiele", () =>
  andereLigen().every(nr => {
    const g = gs.shadowLeagues[nr].teams.map(t => t.played);
    return new Set(g).size === 1 && g[0] === gs.matchday;
  }) ? true : "Spielzahlen stimmen nicht");

check("Die Tabellen sind rechnerisch stimmig", () =>
  andereLigen().every(nr => gs.shadowLeagues[nr].teams.every(t =>
    t.points === t.won*3 + t.drawn && t.played === t.won + t.drawn + t.lost))
    ? true : "Tabelle inkonsistent");

check("Tore werden auch dort zugeordnet", () => {
  const fremd = new Set(andereLigen().flatMap(nr => win.getLeaguePool(gs, nr).map(c => c.name)));
  const treffer = gs.pool.players.filter(p => fremd.has(p.clubName) && (p.goalsSeason||0) > 0);
  return treffer.length > 10 ? true : `nur ${treffer.length} Torschützen`;
});

check("Die Anzeige zeigt alle fremden Tabellen", () => {
  win.switchTab("wettbewerbe");
  const t = $("shadowTable").textContent;
  return andereLigen().every(nr => t.includes(win.getDivisionConfig(nr).label))
    ? true : "nicht alle Ligen angezeigt";
});

check("Auf- und Abstieg läuft über alle Ligen", () => {
  let m=0;
  while(m++<90 && !gs.seasonEnded){ win.runNextEvent();
    if($("liveOverlay").classList.contains("show")){ win.skipLiveMatch(); win.closeLiveMatch(); } }
  return gs.seasonHistory.length > 0 ? true : "kein Saisonabschluss";
});

check("Zur neuen Saison werden sie zurückgesetzt", () => {
  win.startNextSeason();
  return andereLigen().every(nr =>
    gs.shadowLeagues[nr].matchday === 0 && gs.shadowLeagues[nr].teams.every(t => t.played === 0))
    ? true : "nicht zurückgesetzt";
});

check("Über mehrere Saisons stabil", () => {
  for(let s=0;s<2;s++){
    let m=0;
    while(m++<90 && !gs.seasonEnded){ win.runNextEvent();
      if($("liveOverlay").classList.contains("show")){ win.skipLiveMatch(); win.closeLiveMatch(); } }
    gs.board.patience=90;
    win.startNextSeason();
    const alle = win.getAllLeagueClubs(gs);
    if(alle.length !== 18 * win.K.DIVISION_COUNT) return `${alle.length} Vereine`;
    if(new Set(alle.map(c=>c.name)).size !== alle.length) return "Verein doppelt zugeordnet";
  }
  return true;
});

console.log("\n--- D5: Spielstände ---");

check("Drei Plätze werden gemeldet", () => {
  const p=win.listSaveSlots();
  return p.length===3 && p.every(x=>x.slot>=1&&x.slot<=3) ? true : `${p.length} Plätze`;
});

check("Zu Beginn sind alle Plätze leer", () => {
  win.clearSavedGame();
  return win.listSaveSlots().every(p=>!p.belegt) ? true : "Platz belegt";
});

check("Speichern belegt genau einen Platz", () => {
  win.saveGame(2);
  const p=win.listSaveSlots();
  return p[1].belegt && !p[0].belegt && !p[2].belegt ? true : "falscher Platz";
});

check("Der Platz trägt eine Beschriftung", () => {
  const p=win.listSaveSlots()[1];
  return p.label && /Saison/.test(p.label) && p.matchday != null ? true : p.label;
});

check("Der Stand trägt eine Versionsnummer", () => {
  const p=win.listSaveSlots()[1];
  return p.version===2 ? true : `Version ${p.version}`;
});

check("Laden stellt den Verein wieder her", () => {
  const verein=gs.clubName, saison=gs.season;
  win.handleLoadFromSlot(2);
  return win.gameState.clubName===verein && win.gameState.season===saison
    ? true : "Zustand weicht ab";
});

check("Ein leerer Platz lässt sich nicht laden", () => {
  const vorher=win.gameState.clubName;
  win.handleLoadFromSlot(3);
  return win.gameState.clubName===vorher ? true : "leerer Platz geladen";
});

check("Plätze sind unabhängig voneinander", () => {
  win.saveGame(1);
  win.handleDeleteSlot(1);
  const p=win.listSaveSlots();
  return !p[0].belegt && p[1].belegt ? true : "Löschen traf den falschen Platz";
});

check("Export erzeugt gültiges JSON", () => {
  const nutzlast=win.buildSavePayload(win.gameState);
  const text=JSON.stringify(nutzlast);
  const zurueck=win.parseImportedSave(text);
  return zurueck.success && zurueck.state.clubName===win.gameState.clubName
    ? true : zurueck.message;
});

check("Unsinnige Dateien werden abgewiesen", () => {
  const a=win.parseImportedSave("kein json");
  const b=win.parseImportedSave('{"version":2,"state":{}}');
  return !a.success && !b.success ? true : "ungültige Datei akzeptiert";
});

check("Ein alter Einzelstand wird übernommen", () => {
  win.clearSavedGame();
  const alt={ state: JSON.parse(JSON.stringify(win.gameState)) };
  win.localStorage.setItem("bl_career", JSON.stringify(alt));
  const uebernommen=win.migrateLegacySave();
  const p=win.listSaveSlots();
  return uebernommen && p[0].belegt && win.localStorage.getItem("bl_career")===null
    ? true : "Übernahme fehlgeschlagen";
});

check("Der übernommene Stand lässt sich laden", () => {
  const g=win.loadGameState(1);
  return g.found && g.state.clubName ? true : "nicht ladbar";
});

check("Der Dialog zeigt die Plätze", () => {
  win.openSaveModal();
  const t=win.document.getElementById("saveSlotList").textContent;
  const offen=win.document.getElementById("saveOverlay").classList.contains("show");
  win.closeSaveModal();
  return offen && /Platz 1/.test(t) && /Platz 3/.test(t) ? true : "Dialog unvollständig";
});

check("Nach dem Laden lässt sich weiterspielen", () => {
  win.handleLoadFromSlot(1);
  const tag=win.gameState.matchday;
  let n=0;
  while(n++<20 && win.gameState.matchday<tag+3 && !win.gameState.seasonEnded){
    win.runNextEvent();
    if($("liveOverlay").classList.contains("show")){ win.skipLiveMatch(); win.closeLiveMatch(); }
  }
  return win.gameState.matchday>tag ? true : "kein Fortschritt";
});

check("Keine Laufzeitfehler nach allen Schritten", () => errors.length===0 ? true : errors.join(" | "));

console.log(fails===0?"\nAlle Tests bestanden.":`\n${fails} Test(s) fehlgeschlagen.`);

console.log("\n--- T1/T3: Aufteilung und Protokoll ---");

check("Alle Oberflächenfunktionen sind erreichbar", () => {
  const noetig=["renderAll","renderHeader","renderSquad","renderMarket","renderTable",
    "renderRecords","presentMatch","openSaveModal","showPlayerDetail","switchTab",
    "renderShadowTable","renderYouthPanel","renderBoardPanel","renderLog"];
  const fehlt=noetig.filter(f=>typeof win[f]!=="function");
  return fehlt.length===0 ? true : "fehlt: "+fehlt.join(", ");
});

check("Das Protokoll zeigt nur eine Seite", () => {
  const gs=win.gameState;
  const gesamt=gs.log.length;
  const gezeigt=$("log").querySelectorAll("div").length;
  return gesamt<=win.K.LOG_PAGE_SIZE || gezeigt<=win.K.LOG_PAGE_SIZE+2
    ? true : `${gezeigt} Einträge bei ${gesamt}`;
});

check("Bei vielen Einträgen erscheint das Blättern", () => {
  const gs=win.gameState;
  while(gs.log.length<100) win.addLogEntry(gs,"Testeintrag "+gs.log.length);
  win.renderLog(gs);
  return /Seite 1 von/.test($("log").textContent) ? true : "keine Seitenangabe";
});

check("Blättern wechselt die Seite", () => {
  const gs=win.gameState;
  const ersteSeite=$("log").textContent;
  win.logTurnPage(1);
  const zweiteSeite=$("log").textContent;
  return ersteSeite!==zweiteSeite && /Seite 2 von/.test(zweiteSeite)
    ? true : "Seite hat sich nicht geändert";
});

check("Ein neuer Eintrag springt auf Seite 1", () => {
  const gs=win.gameState;
  win.addLogEntry(gs,"Ganz neue Meldung");
  return /Seite 1 von/.test($("log").textContent)
    && /Ganz neue Meldung/.test($("log").textContent) ? true : "nicht zurückgesprungen";
});

check("Das Protokoll bleibt begrenzt", () => {
  const gs=win.gameState;
  for(let i=0;i<400;i++) win.addLogEntry(gs,"Fülleintrag "+i);
  return gs.log.length<=win.K.LOG_MAX_ENTRIES ? true : gs.log.length;
});

check("Keine Laufzeitfehler nach der Aufteilung", () => errors.length===0 ? true : errors.join(" | "));

console.log(fails===0?"\nAlle Tests bestanden.":`\n${fails} Test(s) fehlgeschlagen.`);

console.log("\n--- Bestand: Groesse, Alterspyramide, Vielfalt ---");

check("Der Bestand ist deutlich größer", () => {
  const st=win.getPoolStats(gs.pool);
  return st.gesamt>900 ? true : `${st.gesamt} Spieler`;
});

check("Die Transferliste bietet mehr Auswahl", () => {
  const st=win.getPoolStats(gs.pool);
  return st.gelistet>250 ? true : `${st.gelistet} gelistet`;
});

check("Talente sind im Angebot", () => {
  const jung=win.filterPool(gs.pool,{maxAge:21});
  return jung.length>50 ? true : `nur ${jung.length} unter 22`;
});

check("Jede Position ist besetzt", () => {
  const duenn=win.K.POSITION_ORDER
    .map(pos=>[pos, win.filterPool(gs.pool,{pos}).length])
    .filter(([,n])=>n<8);
  return duenn.length===0 ? true : "zu wenig: "+duenn.map(x=>x.join("=")).join(", ");
});

check("Die Alterspyramide bleibt über 20 Saisons stehen", () => {
  const start=gs.pool.players.length;
  const messwerte=[];
  for(let s=0;s<20;s++){
    gs.season+=1;
    win.advancePool(gs);
    const jung=gs.pool.players.filter(p=>p.age<=20).length;
    const alt=gs.pool.players.filter(p=>p.age>=32).length;
    messwerte.push({gesamt:gs.pool.players.length, jung, alt,
      schnitt:gs.pool.players.reduce((a,p)=>a+p.age,0)/gs.pool.players.length});
  }
  const letzte=messwerte[messwerte.length-1];
  // Die Zielgroesse haengt an der Zahl der Ligen, deshalb relativ pruefen.
  if(Math.abs(letzte.gesamt - start) > start * 0.08) return `Bestand von ${start} auf ${letzte.gesamt}`;
  if(letzte.jung<100) return `nur noch ${letzte.jung} Talente`;
  if(letzte.alt<60) return `nur noch ${letzte.alt} Routiniers`;
  if(letzte.schnitt<23||letzte.schnitt>29) return `Altersschnitt ${letzte.schnitt.toFixed(1)}`;
  return true;
});

check("Auch nach 20 Saisons sind Talente im Angebot", () => {
  const jung=win.filterPool(gs.pool,{maxAge:21});
  return jung.length>40 ? true : `nur ${jung.length} unter 22`;
});

check("Über fünf Saisons sieht man hunderte verschiedene Spieler", () => {
  const ids=new Set();
  for(let s=0;s<5;s++){
    gs.pool.players.filter(p=>p.transferListed).forEach(p=>ids.add(p.id));
    gs.season+=1;
    win.advancePool(gs);
  }
  return ids.size>600 ? true : `nur ${ids.size} verschiedene`;
});

check("Zugänge kommen als Jugendliche herein", () => {
  const vorher=new Set(gs.pool.players.map(p=>p.id));
  gs.season+=1;
  win.advancePool(gs);
  const neue=gs.pool.players.filter(p=>!vorher.has(p.id));
  if(neue.length<30) return `nur ${neue.length} Zugänge`;
  const zuAlt=neue.filter(p=>p.age>22).length;
  return zuAlt<=neue.length*0.2 ? true : `${zuAlt} von ${neue.length} Zugängen sind über 22`;
});

check("Namen bleiben eindeutig", () => {
  const namen=gs.pool.players.map(p=>p.name);
  return new Set(namen).size===namen.length ? true : "Dubletten im Bestand";
});

check("Keine Laufzeitfehler nach den Bestandsänderungen", () => errors.length===0 ? true : errors.join(" | "));

console.log(fails===0?"\nAlle Tests bestanden.":`\n${fails} Test(s) fehlgeschlagen.`);
process.exit(fails===0?0:1);