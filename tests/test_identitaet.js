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
  win.eval(code+"\nwindow.K={CLUB_PROFILES,PLAYER_TRAITS,PHILOSOPHIES,LEGEND_MIN_APPS,FOLLOW_FEE_DISCOUNT};");
  win.__errors=errors;
  return win;
}

let fails=0;
const K_APPS=w=>w.K.LEGEND_MIN_APPS+10;
function check(l,fn){ try{ const r=fn(); const ok=r===true||r===undefined;
  console.log(`${ok?"OK  ":"FAIL"}  ${l}${ok?"":" -> "+r}`); if(!ok)fails++;
} catch(e){ console.log(`FAIL  ${l} -> ${e.message}`);
  console.log(e.stack.split("\n").slice(1,4).map(x=>"      "+x.trim()).join("\n")); fails++; } }

const zu=w=>w.document.querySelectorAll(".modalOverlay.show").forEach(e=>e.classList.remove("show"));
function karriere(club, phil){
  const w=neueWelt(); const $=id=>w.document.getElementById(id);
  $("clubSelect").value=club; if(phil) $("philosophySelect").value=phil; w.startCareer();
  const gs=w.gameState; gs.liveMatches=false; gs.pressConferences=false;
  return { w, gs, $ };
}

console.log("--- Vereinsidentität ---");
{
  const proben={ "FC Bayern München":"gross", "RB Leipzig":"investor", "SC Freiburg":"ausbildung", "Hamburger SV":"tradition", "FC St. Pauli":"kult", "FC Augsburg":"solide" };
  const { w, gs, $ } = karriere("SC Freiburg");
  check("Profile sind zugeordnet", () => {
    const falsch=Object.entries(proben).filter(([n,k])=>w.getClubProfileKey(gs,n)!==k);
    return falsch.length ? JSON.stringify(falsch) : true;
  });
  check("Alle Vereine aller Ligen haben ein Profil und ein System", () => {
    const ohne=w.getAllLeagueClubs(gs).filter(c=>!c.profile||!c.formation);
    return ohne.length ? `${ohne.length} ohne` : true;
  });
  check("Startbildschirm zeigt das Profil", () => { $("clubSelect").value="FC St. Pauli"; w.updateClubProfileInfo(); return /Kultklub/.test($("clubProfileInfo").textContent) ? true : $("clubProfileInfo").textContent; });
  check("Budget folgt dem Profil (Investor > Kultklub bei ähnlicher Stärke)", () => {
    const inv=w.getClubStartBudget(gs,"RB Leipzig",70), kult=w.getClubStartBudget(gs,"FC St. Pauli",70);
    return inv>kult*1.5 ? true : `${inv} / ${kult}`;
  });
  check("Ausbildungsverein: bessere Talente, höhere Verkaufserlöse", () => {
    const yb=w.getYouthQualityBonus(gs); const p=gs.squad[0];
    return yb.strength>=2 && yb.potential>=3 && w.getSellPrice(p) > w.calculateSellValue(p.value) ? true : JSON.stringify(yb);
  });
  check("Zwei Nebenziele, im Vorstand sichtbar", () => {
    w.switchTab("uebersicht");
    return gs.board.sideGoals.length===2 && /Nebenziele/.test($("boardPanel").textContent) ? true : JSON.stringify(gs.board.sideGoals);
  });
  check("Nebenziele werden am Saisonende ausgewertet", () => {
    gs.seasonTransferIn=5e6; gs.seasonTransferOut=1e6;
    gs.board.sideGoals=[{key:"transferplus",label:"Transferüberschuss erzielen"},{key:"heim",label:"Höchstens 3 Heimniederlagen"}];
    const vorher=gs.budget, geduld=gs.board.patience;
    const r=w.evaluateSideGoals(gs);
    return r.length===2 && r[0].met && gs.budget>vorher && gs.board.patience>=geduld ? true : JSON.stringify(r);
  });
  check("Investor-Ereignis macht einen Verein zum Investorenklub", () => {
    const rnd=w.Math.random; w.Math.random=()=>0.001;
    const hsv=w.findClubEverywhere(gs,"Hamburger SV"); hsv.titleStreak=0;
    const r=w.applyClubStrengthDrift([hsv], new Map([[hsv.name,{position:5,total:18,division:w.getClubDivision(gs,hsv.name)}]]), new Map(), {});
    w.Math.random=rnd;
    return hsv.profile==="investor" && r.events.some(e=>e.type==="investor"&&e.profile) ? true : JSON.stringify(r.events)+hsv.profile;
  });
}

console.log("\n--- Startkader und Umschulung ---");
{
  const systeme=new Set(), groessen=[];
  for(let i=0;i<4;i++){ const { w, gs } = karriere("VfB Stuttgart"); systeme.add(gs.formation); groessen.push(gs.squad.length);
    if(Math.abs(w.teamRating(gs.squad,1)-80)>1.5){ check("Kader kalibriert", () => `Rating ${w.teamRating(gs.squad,1)}`); }
  }
  check("Startkader variieren (System, Größe)", () => systeme.size>=2 || new Set(groessen).size>=2 ? true : `${[...systeme]} ${groessen}`);
  const { w, gs } = karriere("VfB Stuttgart");
  check("Kaderbesetzung folgt dem System", () => {
    const needs=w.getActiveFormation().needs; const zaehl={}; gs.squad.forEach(p=>zaehl[p.pos]=(zaehl[p.pos]||0)+1);
    const fehlt=Object.keys(needs).filter(p=>!zaehl[p]);
    return !fehlt.length ? true : `fehlt: ${fehlt}`;
  });
  check("Umschulung: Fortschritt, Abschluss, besserer Wert auf neuer Position", () => {
    const p=gs.squad.find(x=>x.pos==="IV"&&!(x.altPos||[]).includes("DM"))||gs.squad.find(x=>x.pos!=="TW");
    const ziel=p.pos==="IV"?"DM":(p.pos==="ST"?"OM":"ZM");
    if(p.pos===ziel) return true;
    const vorher=w.getSlotRating(p,ziel);
    if(!w.startRetraining(p,ziel).success) return "nicht gestartet";
    let n=0; while(p.retrain && n++<80) w.advanceRetraining(p,true);
    return (p.altPos||[]).includes(ziel) && w.getSlotRating(p,ziel)>vorher ? true : `${vorher} -> ${w.getSlotRating(p,ziel)}`;
  });
  check("Torhüter lassen sich nicht umschulen", () => !w.startRetraining(gs.squad.find(x=>x.pos==="TW"),"IV").success ? true : "TW umgeschult");
}

console.log("\n--- Legenden und Beziehungen ---");
{
  const { w, gs } = karriere("SC Freiburg");
  const held=gs.squad[2], freund=gs.squad[6];
  held.clubApps=K_APPS(w); held.goalsSeason=3; freund.clubApps=60; freund.morale=75; held.morale=75; freund.age=25;
  w.updateLegendsAtSeasonEnd(gs);
  check("Legende entsteht ab genug Spielen", () => (gs.legends||[]).some(l=>l.id===held.id&&l.club==="SC Freiburg") ? true : JSON.stringify(gs.legends));
  check("Tore werden nur einmal gezählt", () => { const l=gs.legends.find(x=>x.id===held.id); w.noteDeparture(gs, held, "verkauft"); return gs.legends.find(x=>x.id===held.id).goals===l.goals ? true : "doppelt"; });
  gs.squad=gs.squad.filter(p=>p!==held);
  w.addHonour(gs,"cup-de","DFB-Pokal","SC Freiburg");
  w.acceptJobOffer("VfB Stuttgart");
  check("Vertraute folgen dem Trainer: wechselbereit, mit Nachlass", () => {
    const f=gs.pool.players.find(p=>p.id===freund.id);
    if(!f || !w.isFollower(gs,f)) return "kein Folger";
    return w.isWillingToJoin(gs,f) && f.transferListed && w.getTransferFee(f) < f.value*1.35 ? true : `${w.getTransferFee(f)} / ${f.value}`;
  });
  check("Ehemaliger Spieler wird später Trainer", () => {
    const alt=Object.assign({}, freund, { id:"ex1", name:"Ex Spieler", formerCoachApps:80, formerClub:"SC Freiburg" });
    w.rememberRetiredPlayer(gs, alt); gs.season+=3;
    const rnd=w.Math.random; w.Math.random=()=>0.01; const c=w.pickFormerPlayerAsCoach(gs,"FC Augsburg"); w.Math.random=rnd; gs.season-=3;
    return c && c.former && gs.retiredFormer.some(r=>r.name===c.name&&r.coach==="FC Augsburg") && gs.retiredFormer.some(r=>r.name==="Ex Spieler") ? true : JSON.stringify(c);
  });
  check("Rückkehr nach Titel: Vorstand freut sich", () => {
    gs.seasonEnded=true; const vorher=75; w.acceptJobOffer("SC Freiburg");
    return gs.board.patience>vorher ? true : `Geduld ${gs.board.patience}`;
  });
  check("Laufbahn zeigt Legenden", () => { w.switchTab("statistik"); return /Legenden/.test(w.document.getElementById("careerPanel").textContent) ? true : "fehlt"; });
}

console.log("\n--- Eigenschaften und Rollen ---");
{
  const { w, gs, $ } = karriere("Borussia Dortmund");
  check("Rund 55 % der Spieler haben Eigenschaften, unvereinbare nie zusammen", () => {
    const alle=gs.pool.players; const mit=alle.filter(p=>p.traits.length).length/alle.length;
    const konflikt=alle.filter(p=>(p.traits.includes("robust")&&p.traits.includes("anfaellig"))||(p.traits.includes("frueh")&&p.traits.includes("spaet")));
    return mit>0.45 && mit<0.65 && !konflikt.length ? true : `${mit} ${konflikt.length}`;
  });
  check("Torinstinkt erhöht das Torgewicht, Robust senkt Verletzungen", () => {
    const st={pos:"ST",traits:["torinstinkt"]}, r={traits:["robust"]}, a={traits:["anfaellig"]};
    return w.getScorerWeight(st)>w.getScorerWeight({pos:"ST",traits:[]}) && w.getTraitInjuryFactor(r)<1 && w.getTraitInjuryFactor(a)>1 ? true : "falsch";
  });
  check("Rollen: gesetzter Elfmeterschütze trifft, Tor-Art im Protokoll", () => {
    const xi=w.getStartingXI(gs.squad,1); const schuetze=xi.find(p=>p.pos==="IV")||xi[2];
    w.handleRoleChange("penalty", schuetze.id);
    const rnd=w.Math.random; w.Math.random=()=>0.05; const t=w.pickGoalScorerWithType(xi, gs.roles); w.Math.random=rnd;
    return t.player===schuetze && t.type==="Elfmeter" ? true : `${t.player&&t.player.name} ${t.type}`;
  });
  check("Rollenauswahl im Kader-Tab", () => { w.switchTab("kader"); const h=$("lineupControls").innerHTML; return /Elfmeter/.test(h)&&/Freistöße/.test(h) ? true : "fehlt"; });
  check("Ältere Spielstände bekommen Eigenschaften", () => { const p=gs.squad[0]; delete p.traits; w.ensurePlayerTraits([p]); return Array.isArray(p.traits) ? true : "keine"; });
}

console.log("\n--- Philosophie und Derbys ---");
{
  const { w, gs, $ } = karriere("Borussia Dortmund", "ballbesitz");
  check("Philosophie aus dem Startbildschirm, passt zum Großklub", () => gs.philosophy==="ballbesitz" && w.philosophyFitsClub(gs,gs.clubName) ? true : gs.philosophy);
  check("Ballbesitz: stärker als Favorit, schwächer als Außenseiter", () => {
    const own={attack:80,defence:80}, schwach={attack:70,defence:70}, stark={attack:90,defence:90};
    const a=w.applyPhilosophy(gs,own,schwach), b=w.applyPhilosophy(gs,own,stark);
    return a.attack>80 && b.attack<80 ? true : JSON.stringify({a,b});
  });
  check("Derbys erkannt, enger gerechnet", () => {
    const d=w.getDerby("FC Schalke 04","Borussia Dortmund"); const l=w.applyDerbyEqualizer("Borussia Dortmund","FC Schalke 04",2.2,0.9);
    return d && d.name==="Revierderby" && l.home<2.2 && l.away>0.9 && w.getOwnDerbyOpponents(gs).includes("FC Schalke 04") ? true : JSON.stringify({d,l});
  });
  check("Derbysieg hebt Stimmung und Vorstand", () => {
    const m=w.getMorale(gs.squad[0]), p=gs.board.patience;
    w.applyDerbyResult(gs,{home:"Borussia Dortmund",away:"FC Schalke 04",homeGoals:2,awayGoals:0,result:"win"});
    return w.getMorale(gs.squad[0])>m && gs.board.patience>p ? true : "keine Wirkung";
  });
  check("Philosophie nur zwischen den Saisons änderbar", () => {
    gs.matchday=5; w.handlePhilosophyChange("konter"); const blieb=gs.philosophy==="ballbesitz"; gs.matchday=0;
    return blieb ? true : gs.philosophy;
  });
  check("Eine ganze Saison läuft mit allen Neuerungen", () => {
    let n=0; while(n++<200 && !gs.seasonEnded){ w.runNextEvent(); w.closeLiveMatch(); zu(w); }
    return gs.seasonEnded && (gs.lastSeasonSummary.sideGoals||[]).length===2 ? true : "Saison nicht beendet";
  });
  check("Keine Laufzeitfehler", () => w.__errors.length===0 ? true : w.__errors.join(" | "));
}

console.log(fails===0?"\nAlle Tests bestanden.":`\n${fails} Test(s) fehlgeschlagen.`);
process.exit(fails===0?0:1);
