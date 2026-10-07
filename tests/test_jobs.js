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
  win.eval(code+"\nwindow.K={JOB_VACANCY_SHARE};");
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
$("clubSelect").value="FC Bayern München"; w.startCareer();
const gs=w.gameState; gs.liveMatches=false; gs.pressConferences=false;
const schliessen=()=>{ w.closeLiveMatch(); w.document.querySelectorAll(".modalOverlay.show").forEach(e=>e.classList.remove("show")); };

console.log("--- Stellenmarkt ---");
check("Tab Jobs ist da und zeigt den Stellenmarkt", () => {
  w.switchTab("jobs");
  const tab=[...w.document.querySelectorAll(".tabBtn")].some(b=>b.textContent.includes("Jobs"));
  return tab && $("jobMarket").innerHTML.includes("Trainer-Ruf") ? true : "Tab oder Inhalt fehlt";
});
check("Freie Stellen in allen Ländern, eigener Verein nicht dabei", () => {
  const l=w.getJobList(gs), offen=l.filter(c=>c.open);
  const laender=new Set(offen.map(c=>c.country));
  if(l.some(c=>c.name===gs.clubName)) return "eigener Verein gelistet";
  return offen.length>20 && laender.size>=4 ? true : `${offen.length} offen, ${laender.size} Länder`;
});
check("Neu im Amt zählt nur der Ruf", () => {
  gs.board.patience=80;
  const real=w.getJobList(gs).find(c=>c.name==="Real Madrid");
  return real.chance===0 ? true : `Chance ${real.chance}`;
});
// Eine abgeschlossene Saison beim aktuellen Verein (nur für die Prüfung).
gs.seasonHistory.push({ season: gs.season-1, club: gs.clubName, test: true });
check("Erfolgreicher Bayern-Trainer hat Chancen bei Real Madrid", () => {
  gs.board.patience=80;
  const real=w.getJobList(gs).find(c=>c.name==="Real Madrid");
  return real && real.chance>=0.4 ? true : `Chance ${real&&real.chance}`;
});
check("Ohne Ruf und Erfolg ist ein Topverein chancenlos", () => {
  const sicher={rep:gs.reputation, stat:gs.clubStature, p:gs.board.patience};
  gs.reputation=30; gs.clubStature=60; gs.board.patience=40;
  const real=w.getJobList(gs).find(c=>c.name==="Real Madrid");
  gs.reputation=sicher.rep; gs.clubStature=sicher.stat; gs.board.patience=sicher.p;
  return real.chance===0 ? true : `Chance ${real.chance}`;
});
check("Bewerbung: Zusage wird gespeichert, keine zweite Bewerbung", () => {
  const jm=w.ensureJobMarket(gs);
  if(!jm.vacancies.includes("Real Madrid")) jm.vacancies.push("Real Madrid");
  const rnd=w.Math.random; w.Math.random=()=>0.01;
  const r=w.applyForJob(gs,"Real Madrid");
  w.Math.random=rnd;
  if(!r.accepted) return r.message;
  return !w.applyForJob(gs,"Real Madrid").success ? true : "doppelt beworben";
});
gs.seasonHistory=gs.seasonHistory.filter(h=>!h.test);
check("Besetzte Stelle: keine Bewerbung möglich", () => {
  const besetzt=w.getJobList(gs).find(c=>!c.open);
  return !w.applyForJob(gs,besetzt.name).success ? true : "Bewerbung bei besetzter Stelle";
});

console.log("\n--- Saisonende und Wechsel ---");
gs.board.patience=95;
let n=0;
while(n++<200 && !gs.seasonEnded){ w.runNextEvent(); schliessen(); gs.board.patience=Math.max(gs.board.patience,60); }
check("Zusage steht am Saisonende bei den Angeboten", () =>
  (gs.successOffers||[]).some(o=>o.name==="Real Madrid") ? true : JSON.stringify((gs.successOffers||[]).map(o=>o.name)));
check("Wechsel zu Real Madrid in die LaLiga", () => {
  w.acceptJobOffer("Real Madrid");
  if(gs.clubName!=="Real Madrid") return gs.clubName;
  return w.getDivisionCountry(gs.division)==="es" ? true : "falsches Land";
});
check("Neue Saison: neuer Stellenmarkt ohne alte Bewerbungen", () => {
  const jm=w.ensureJobMarket(gs);
  return jm.season===gs.season && Object.keys(jm.applications).length===0 && !jm.vacancies.includes("Real Madrid") ? true : "alter Stand";
});

check("Keine Laufzeitfehler", () => w.__errors.length===0 ? true : w.__errors.join(" | "));
console.log(fails===0?"\nAlle Tests bestanden.":`\n${fails} Test(s) fehlgeschlagen.`);
process.exit(fails===0?0:1);
