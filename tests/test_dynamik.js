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
  win.eval(code+"\nwindow.K={AI_STRENGTH_CEILING};");
  win.__errors=errors;
  return win;
}

const K=neueWelt().K;
let fails=0;
function check(l,fn){ try{ const r=fn(); const ok=r===true||r===undefined;
  console.log(`${ok?"OK  ":"FAIL"}  ${l}${ok?"":" -> "+r}`); if(!ok)fails++;
} catch(e){ console.log(`FAIL  ${l} -> ${e.message}`);
  console.log(e.stack.split("\n").slice(1,4).map(x=>"      "+x.trim()).join("\n")); fails++; } }

// Nur die Vereinsentwicklung, ohne volle Saisons: jede Liga einmal simulieren.
function saisonEntwicklung(w, gs){
  const standings=new Map(), move=new Map();
  gs.leaguePools.forEach((pool,i)=>{ const tab=w.simulateShadowSeason(pool);
    tab.forEach((t,k)=>{ standings.set(t.name,{position:k+1,total:tab.length,division:i+1}); move.set(t.name,"stayed"); }); });
  return w.applyClubStrengthDrift(w.getAllLeagueClubs(gs), standings, move, { ownClub: gs.clubName });
}
const mittel=a=>a.reduce((x,y)=>x+y,0)/a.length;
const streuung=a=>{ const m=mittel(a); return Math.sqrt(mittel(a.map(x=>(x-m)*(x-m)))); };

console.log("--- Vereinsentwicklung ---");
{
  const w=neueWelt(); const $=id=>w.document.getElementById(id);
  $("clubSelect").value="FC Bayern München"; w.startCareer(); const gs=w.gameState;
  const start=new Map(w.getAllLeagueClubs(gs).map(c=>[c.name,c.strength]));
  const deVorher=gs.leaguePools.slice(0,3).flat().map(c=>c.strength);
  for(let j=0;j<30;j++) saisonEntwicklung(w, gs);
  const alle=w.getAllLeagueClubs(gs).filter(c=>c.name!==gs.clubName);
  const abw=alle.map(c=>Math.abs(c.strength-start.get(c.name)));
  check("Nach 30 Jahren haben sich Vereine spürbar verändert", () =>
    mittel(abw)>2 && abw.some(d=>d>8) ? true : `mittlere Abweichung ${mittel(abw).toFixed(2)}, max ${Math.max(...abw).toFixed(1)}`);
  check("Keine Inflation: Niveau und Streuung je Land bleiben", () => {
    const de=gs.leaguePools.slice(0,3).flat().filter(c=>c.name!==gs.clubName).map(c=>c.strength);
    const dm=Math.abs(mittel(de)-mittel(deVorher)), ds=Math.abs(streuung(de)/streuung(deVorher)-1);
    return dm<2 && ds<0.15 ? true : `Mittel ${mittel(deVorher).toFixed(1)}→${mittel(de).toFixed(1)}, Streuung ${streuung(deVorher).toFixed(1)}→${streuung(de).toFixed(1)}`;
  });
  check("Eigener Verein wird von der Entwicklung nicht verändert", () =>
    w.findClubEverywhere(gs, gs.clubName).strength===start.get(gs.clubName) ? true : "verändert");
  check("Werte bleiben in den Grenzen", () => alle.every(c=>c.strength>=42&&c.strength<=K.AI_STRENGTH_CEILING) ? true : "außerhalb");
}
{
  const w=neueWelt(); const $=id=>w.document.getElementById(id);
  $("clubSelect").value="Paris Saint-Germain"; w.startCareer(); const gs=w.gameState;
  check("Bayern als Fünfter drei Jahre in Folge verliert an Stärke", () => {
    const rnd=w.Math.random; w.Math.random=()=>0.5;   // kein Rauschen, keine Ereignisse
    const bayern=w.findClubEverywhere(gs,"FC Bayern München"); const vorher=bayern.strength;
    for(let j=0;j<3;j++){
      const standings=new Map(), move=new Map();
      gs.leaguePools.forEach((pool,i)=>{ const tab=[...pool].sort((a,b)=>b.strength-a.strength);
        if(i===0){ const b=tab.indexOf(bayern); tab.splice(b,1); tab.splice(4,0,bayern); }
        tab.forEach((t,k)=>{ standings.set(t.name,{position:k+1,total:tab.length,division:i+1}); move.set(t.name,"stayed"); }); });
      w.applyClubStrengthDrift(w.getAllLeagueClubs(gs), standings, move, { ownClub: gs.clubName });
    }
    w.Math.random=rnd;
    return bayern.strength<vorher-2 ? true : `${vorher} → ${bayern.strength}`;
  });
  check("Serienmeister: Umbruch wird gemeldet", () => {
    const rnd=w.Math.random; w.Math.random=()=>0.01;
    const bayern=w.findClubEverywhere(gs,"FC Bayern München"); bayern.titleStreak=5;
    const standings=new Map([[bayern.name,{position:1,total:18,division:1}]]);
    const r=w.applyClubStrengthDrift([bayern], standings, new Map(), {});
    w.Math.random=rnd;
    return r.events.some(e=>e.type==="umbruch"&&e.name===bayern.name) ? true : JSON.stringify(r.events);
  });
}

console.log("\n--- Ex-Verein und Laufbahn ---");
const w=neueWelt(); const $=id=>w.document.getElementById(id);
$("clubSelect").value="AS Rom"; w.startCareer();
const gs=w.gameState; gs.liveMatches=false; gs.pressConferences=false;
const romVorher=w.findClubEverywhere(gs,"AS Rom").strength;
gs.squad.forEach(p=>{ if(p.maxAttributes) Object.keys(p.maxAttributes).forEach(k=>p.maxAttributes[k]=99); w.applyAttributeChange(p, 10); });
const kader=w.teamRating(gs.squad,1);
// Ein Titel mit Rom in dieser Saison.
w.addHonour(gs, "cup-it", "Coppa Italia", "AS Rom");
w.acceptJobOffer("SSC Neapel");
check("Ex-Verein behält die Stärke des hinterlassenen Kaders", () => {
  const rom=w.findClubEverywhere(gs,"AS Rom");
  return Math.abs(rom.strength-Math.min(K.AI_STRENGTH_CEILING,kader))<0.6 && rom.strength>romVorher+4 ? true : `vorher ${romVorher}, Kader ${kader}, jetzt ${rom.strength}`;
});
check("Ohne Ausreißer bleibt der Ex-Verein auf seinem Niveau", () => {
  const rnd=w.Math.random; w.Math.random=()=>0.5;
  const rom=w.findClubEverywhere(gs,"AS Rom"); const vorher=rom.strength;
  // Jede Liga endet genau nach Stärke: keine Über- oder Unterleistung.
  const standings=new Map(), move=new Map();
  gs.leaguePools.forEach((pool,i)=>{ [...pool].sort((a,b)=>b.strength-a.strength)
    .forEach((t,k)=>{ standings.set(t.name,{position:k+1,total:pool.length,division:i+1}); move.set(t.name,"stayed"); }); });
  w.applyClubStrengthDrift(w.getAllLeagueClubs(gs), standings, move, { ownClub: gs.clubName });
  w.Math.random=rnd;
  return Math.abs(rom.strength-vorher)<0.8 ? true : `${vorher} → ${rom.strength}`;
});
check("Laufbahn: zwei Stationen, Rom abgeschlossen", () => {
  const c=w.ensureCareer(gs);
  return c.length===2 && c[0].club==="AS Rom" && c[0].to!=null && c[1].club==="SSC Neapel" && c[1].to==null ? true : JSON.stringify(c);
});
check("Titel mit Rom bleibt meiner und lässt sich filtern", () => {
  const meine=w.getMyHonours(gs), rom=w.getMyHonours(gs,"AS Rom"), neapel=w.getMyHonours(gs,"SSC Neapel");
  return meine.length===1 && rom.length===1 && neapel.length===0 ? true : `${meine.length}/${rom.length}/${neapel.length}`;
});
check("Statistik zeigt Laufbahn und Ehrentafel-Filter je Verein", () => {
  w.switchTab("statistik");
  const karte=$("careerPanel").innerHTML, sel=$("honoursFilterSelect");
  if(!karte.includes("AS Rom")||!karte.includes("SSC Neapel")) return "Laufbahn fehlt";
  const opts=[...sel.options].map(o=>o.value);
  if(!opts.includes("club:AS Rom")) return opts.join(",");
  w.setHonoursFilter("club:SSC Neapel");
  const leer=$("honoursList").innerHTML.includes("Keine Titel");
  w.setHonoursFilter("club:AS Rom");
  return leer && $("honoursList").innerHTML.includes("Coppa Italia") ? true : "Filter falsch";
});
check("Altstand: Laufbahn aus dem Saisonverlauf, Titel zugeordnet", () => {
  const alt=JSON.parse(JSON.stringify(gs));
  delete alt.career; alt.honours.forEach(h=>delete h.mine);
  alt.seasonHistory=[{season:2024,club:"AS Rom",finalPosition:2,division:8},{season:2025,club:"AS Rom",finalPosition:1,division:8}];
  alt.honours.push({season:2025,key:"league-8",label:"Serie A",winner:"AS Rom"});
  alt.honours.push({season:2025,key:"league-1",label:"Bundesliga",winner:"FC Bayern München"});
  const c=w.ensureCareer(alt); w.ensureHonourAttribution(alt);
  const serieA=alt.honours.find(h=>h.key==="league-8"), bl=alt.honours.find(h=>h.key==="league-1");
  return c.length===2 && c[0].from===2024 && serieA.mine===true && bl.mine===false ? true : JSON.stringify({c, serieA, bl});
});
check("Altstand: zurückgesetzter Ex-Verein wird aus seinem Kader repariert", () => {
  const rom=w.findClubEverywhere(gs,"AS Rom"); rom.strength=rom.baseStrength=romVorher;
  gs.exClubsRepaired=false;
  const n=w.repairExClubStrengths(gs);
  return n===1 && rom.strength>romVorher+3 ? true : `${n} repariert, ${romVorher} → ${rom.strength}`;
});

check("Keine Laufzeitfehler", () => w.__errors.length===0 ? true : w.__errors.join(" | "));
console.log(fails===0?"\nAlle Tests bestanden.":`\n${fails} Test(s) fehlgeschlagen.`);
process.exit(fails===0?0:1);
