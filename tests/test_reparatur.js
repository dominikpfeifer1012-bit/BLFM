// Saisonende: Ein Fehler darf keinen halben Stand hinterlassen, und ein
// bereits beschaedigter Spielstand (mehrfach angelaufenes Saisonende) wird
// beim Laden repariert.
const fs=require("fs"); const {JSDOM,VirtualConsole}=require("jsdom");
const htmlRoh=fs.readFileSync("/home/claude/bl/index.html","utf8");
const mods=[...htmlRoh.matchAll(/modules\/([a-z-]+\.js)/g)].map(m=>m[1]);
const code=mods.map(f=>fs.readFileSync("/home/claude/bl/"+f,"utf8")).join("\n");

function neueWelt(verein){
  const vc=new VirtualConsole(); vc.on("jsdomError",()=>{});
  const dom=new JSDOM(htmlRoh.replace(/<script src="modules\/[^"]+"><\/script>\s*/g,""),
    {runScripts:"outside-only",pretendToBeVisual:true,url:"http://localhost/",virtualConsole:vc});
  const win=dom.window;
  const errors=[]; win.addEventListener("error",e=>errors.push(e.message));
  win.eval("try{localStorage.clear();}catch(e){}");
  win.eval(code);
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

// Bis kurz vor Saisonende spielen.
function bisSpieltag(w, ziel){
  const gs=w.gameState; let n=0;
  while(n++<300 && !gs.seasonEnded && gs.matchday<ziel){
    w.runNextEvent();
    if(w.document.getElementById("liveOverlay").classList.contains("show")){ w.skipLiveMatch(); w.closeLiveMatch(); }
    w.document.querySelectorAll(".modalOverlay.show").forEach(e=>e.classList.remove("show"));
  }
}
const kaderBild=gs=>gs.squad.map(p=>({id:p.id, age:p.age, c:p.contractYears}));

console.log("--- Fehler beim Saisonende ---");
{
  const w=neueWelt("VfB Stuttgart"); bisSpieltag(w, w.getSeasonMatchdays(w.gameState)-1);
  const vorher=kaderBild(w.gameState);
  // Ein Fehler mitten im Saisonende (nach Altern und Vertraegen).
  const original=w.createYouthCandidates;
  w.eval("var __crash=true; const __orig=createYouthCandidates; createYouthCandidates=function(g){ if(__crash) throw new Error('Testfehler'); return __orig(g); };");
  let gefangen=0;
  for(let i=0;i<3;i++){ try{ w.runNextEvent(); }catch(e){ gefangen++; } }
  const gs=w.gameState;
  check("Der Fehler kommt an, das Saisonende ist nicht halb gelaufen", () => {
    const nachher=kaderBild(gs);
    const gleich=vorher.length===nachher.length && vorher.every(v=>nachher.some(n=>n.id===v.id && n.age===v.age && n.c===v.c));
    return gefangen>=1 && !gs.seasonEnded && gleich ? true : `gefangen ${gefangen}, Kader ${vorher.length}→${nachher.length}, gleich ${gleich}`;
  });
  check("Nach Behebung läuft das Saisonende genau einmal", () => {
    w.eval("__crash=false;");
    w.runNextEvent();
    const g=w.gameState; const nachher=kaderBild(g);
    const gealtert=vorher.filter(v=>nachher.some(n=>n.id===v.id)).every(v=>nachher.find(n=>n.id===v.id).age===v.age+1);
    return g.seasonEnded && gealtert ? true : `beendet ${g.seasonEnded}, gealtert ${gealtert}`;
  });
}

console.log("--- Beschädigter Spielstand ---");
{
  const w=neueWelt("VfB Stuttgart"); bisSpieltag(w, w.getSeasonMatchdays(w.gameState)-1);
  // Drei Jugendspieler, die nicht zu alt werden duerfen.
  const gs0=w.gameState; gs0.youthSquad=[];
  [17,18,19].forEach(a=>{ const j=w.genYouthPlayer(75,"ZM"); j.age=a; w.addToYouthSquad(gs0,j); });
  const vorher=kaderBild(gs0), jugendVorher=gs0.youthSquad.map(p=>({id:p.id, age:p.age}));
  // Alter Fehler nachstellen: Saisonende bricht ab, ohne Schutz, viermal hintereinander.
  w.eval("var __crash=true; const __orig2=createYouthCandidates; createYouthCandidates=function(g){ if(__crash) throw new Error('Testfehler'); return __orig2(g); }; finishSeasonSafely=function(){ finishSeason(); };");
  for(let i=0;i<4;i++){ try{ w.runNextEvent(); }catch(e){} }
  w.eval("__crash=false;");
  const kaputt=JSON.parse(JSON.stringify(w.gameState));
  check("Nachgestellt: Kader beschädigt (gealtert, Spieler weg)", () => {
    const nachher=kaderBild(kaputt);
    const gealtert=nachher.filter(n=>vorher.some(v=>v.id===n.id && n.age>v.age)).length;
    return gealtert>0 && !kaputt.seasonEnded ? true : `${gealtert} gealtert`;
  });
  const bericht=w.repairInterruptedSeasonEnd(kaputt);
  check("Reparatur erkennt vier Anläufe", () => bericht && bericht.anlaeufe===4 ? true : JSON.stringify(bericht));
  check("Stammspieler zurück, Alter und Vertrag wie vorher", () => {
    const nachher=kaderBild(kaputt);
    const zurueck=vorher.filter(v=>nachher.some(n=>n.id===v.id));
    const falsch=zurueck.filter(v=>{ const n=nachher.find(x=>x.id===v.id); return n.age!==v.age || n.c!==v.c; });
    const fremd=nachher.filter(n=>!vorher.some(v=>v.id===n.id));
    // Fehlen duerfen nur Spieler mit Karriereende (aus dem Spiel genommen).
    const fehlen=vorher.filter(v=>!nachher.some(n=>n.id===v.id));
    const imBestand=fehlen.filter(f=>kaputt.pool.players.some(p=>p.id===f.id));
    return !falsch.length && !fremd.length && !imBestand.length && zurueck.length>=vorher.length-4
      ? true : `${zurueck.length}/${vorher.length} zurück, ${falsch.length} falsch, ${fremd.length} fremd, ${imBestand.length} noch im Bestand`;
  });
  check("Jugend wieder so alt wie vorher", () => {
    const ok=jugendVorher.every(v=>kaputt.youthSquad.some(p=>p.id===v.id && p.age===v.age));
    return ok ? true : JSON.stringify(kaputt.youthSquad.map(p=>p.age));
  });
  check("Ein normaler Spielstand bleibt unberührt", () => {
    const v=neueWelt("SC Freiburg"); bisSpieltag(v, 10);
    const bild=JSON.stringify(kaderBild(v.gameState));
    const r=v.repairInterruptedSeasonEnd(v.gameState);
    return r===null && JSON.stringify(kaderBild(v.gameState))===bild ? true : "verändert";
  });
  check("Reparierter Stand: Saisonende und neue Saison laufen", () => {
    w.applyLoadedState(kaputt);
    const g=w.gameState;
    w.runNextEvent();
    if(!g.seasonEnded) return "Saison nicht beendet";
    if(g.pendingYouthCandidates){ w.handlePickYouthCandidate(0); w.finishYouthIntake(); }
    w.startNextSeason();
    return g.matchday===0 && !g.seasonEnded && g.squad.length>=16 ? true : `Spieltag ${g.matchday}, Kader ${g.squad.length}`;
  });
  check("Keine Laufzeitfehler", () => w.__errors.length===0 ? true : w.__errors.join(" | "));
}

console.log(fails===0?"\nAlle Prüfungen bestanden.":`\n${fails} Prüfung(en) fehlgeschlagen.`);
process.exit(fails?1:0);
