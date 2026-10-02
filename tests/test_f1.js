const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync("/home/claude/bl/index.html","utf8")
  .replace(/<script src="modules\/[a-z-]+\.js"><\/script>\s*/g,"");
const dom=new JSDOM(html,{runScripts:"outside-only",pretendToBeVisual:true,url:"http://localhost/"});
const win=dom.window;
const errors=[]; win.addEventListener("error",e=>errors.push(e.message));
// Modulliste aus dem HTML lesen, damit sie nie veraltet.
const mods = [...fs.readFileSync("/home/claude/bl/index.html","utf8")
  .matchAll(/modules\/([a-z-]+\.js)/g)].map(m => m[1]);
win.eval("try{localStorage.clear();}catch(e){}");
win.eval(mods.map(f=>fs.readFileSync("/home/claude/bl/"+f,"utf8")).join("\n")
  +"\nwindow.K={TRAINING_FOCUS,DEFAULT_TRAINING,ATTRIBUTES,TOTAL_MATCHDAYS,INJURY_CHANCE_STARTER};");
let fails=0;
function check(l,fn){ try{ const r=fn(); const ok=r===true||r===undefined;
  console.log(`${ok?"OK  ":"FAIL"}  ${l}${ok?"":" -> "+r}`); if(!ok)fails++;
} catch(e){ console.log(`FAIL  ${l} -> ${e.message}`);
  console.log(e.stack.split("\n").slice(1,4).map(x=>"      "+x.trim()).join("\n")); fails++; } }
const $=id=>win.document.getElementById(id);
const K=win.K;

$("clubSelect").value="VfB Stuttgart"; win.startCareer();
const gs=win.gameState; gs.liveMatches=false;

console.log("--- F1: Trainingsfokus ---");
check("Ein Fokus ist gesetzt", () => gs.training===K.DEFAULT_TRAINING);

check("Alle fünf Schwerpunkte sind wählbar", () => {
  const n=Object.keys(K.TRAINING_FOCUS).length;
  return n===5 ? true : `${n} Schwerpunkte`;
});

check("Umschalten wirkt", () => {
  win.handleTrainingChange("offense");
  return gs.training==="offense" ? true : gs.training;
});

check("Unbekannte Werte werden abgewiesen", () => {
  win.handleTrainingChange("quatsch");
  return gs.training==="offense" ? true : "ungültiger Wert übernommen";
});

check("Offensive fördert Abschluss und bremst Abwehr", () => {
  win.handleTrainingChange("offense");
  return win.getTrainingAttributeFactor("sho")>1.2 && win.getTrainingAttributeFactor("def")<1
    ? true : "Faktoren stimmen nicht";
});

check("Defensive dreht das um", () => {
  win.handleTrainingChange("defense");
  return win.getTrainingAttributeFactor("def")>1.2 && win.getTrainingAttributeFactor("sho")<1
    ? true : "Faktoren stimmen nicht";
});

// Vergleiche IMMER auf identischen Kopien durchführen. Frisch erzeugte
// Spieler unterscheiden sich in Stärke und Potenzial — dann misst man
// Zufall statt Wirkung.
function klone(v){
  return Object.assign({}, v, { attributes: {...v.attributes}, maxAttributes: {...v.maxAttributes} });
}
function wachstum(vorlage, fokus){
  win.handleTrainingChange(fokus);
  const p = klone(vorlage);
  const vor = win.getOverallRating(p);
  for(let i = 0; i < K.TOTAL_MATCHDAYS; i++){
    win.applyAttributeChange(p, win.getDevelopmentRate(p.age, "starter"));
  }
  return win.getOverallRating(p) - vor;
}
// Reichlich Luft nach oben, damit die Potenzialgrenze nichts deckelt.
function vorlageMit(pos){
  const p = win.genPlayer(60, pos, [19, 19], false);
  K.ATTRIBUTES.forEach(a => { p.maxAttributes[a] = 99; });
  p.maxStrength = 99;
  return p;
}

check("Ein Stürmer profitiert von Offensive, ein Verteidiger von Defensive", () => {
  const st = vorlageMit("ST"), iv = vorlageMit("IV");
  const stOff = wachstum(st, "offense"), stDef = wachstum(st, "defense");
  const ivOff = wachstum(iv, "offense"), ivDef = wachstum(iv, "defense");
  if(stOff <= stDef) return `Stürmer: ${stOff.toFixed(2)} offensiv vs ${stDef.toFixed(2)} defensiv`;
  if(ivDef <= ivOff) return `Verteidiger: ${ivDef.toFixed(2)} defensiv vs ${ivOff.toFixed(2)} offensiv`;
  return true;
});

check("Regeneration bremst die Entwicklung deutlich", () => {
  const p = vorlageMit("ZM");
  const normal = wachstum(p, "balanced"), rege = wachstum(p, "regeneration");
  return rege < normal * 0.7 ? true : `${rege.toFixed(2)} statt deutlich unter ${normal.toFixed(2)}`;
});

check("Der Fokus wirkt nicht auf den Abbau", () => {
  win.handleTrainingChange("regeneration");
  const alt=win.genPlayer(80,"ST",[34,34],false);
  const vor=win.getOverallRating(alt);
  for(let i=0;i<34;i++) win.applyAttributeChange(alt, win.getDevelopmentRate(34,"bench"));
  const abbau=vor-win.getOverallRating(alt);
  return abbau>0.5 ? true : `Abbau nur ${abbau.toFixed(2)}`;
});

check("Athletik erhöht das Verletzungsrisiko", () => {
  win.handleTrainingChange("athletics");
  const hoch=K.TRAINING_FOCUS.athletics.injury;
  win.handleTrainingChange("regeneration");
  const niedrig=K.TRAINING_FOCUS.regeneration.injury;
  return hoch>1.2 && niedrig<0.8 ? true : `${hoch} / ${niedrig}`;
});

check("Regeneration senkt die Ermüdung messbar", () => {
  const p={consecutiveStarts:20};
  win.handleTrainingChange("balanced");
  const normal=win.getFatiguePenalty(p);
  win.handleTrainingChange("regeneration");
  const geschont=win.getFatiguePenalty(p);
  win.handleTrainingChange("balanced");
  return geschont<normal ? true : `${geschont} statt unter ${normal}`;
});

check("Regeneration hebt die Stimmung", () => {
  const messen=(fokus)=>{
    win.handleTrainingChange(fokus);
    gs.squad.forEach(p=>win.setMorale(p,60));
    win.updateSquadMorale(gs,{result:"draw",youthAppearances:new Set()});
    return win.getSquadMoraleAverage(gs.squad);
  };
  const normal=messen("balanced"), rege=messen("regeneration");
  win.handleTrainingChange("balanced");
  return rege>normal ? true : `${rege.toFixed(2)} statt über ${normal.toFixed(2)}`;
});

check("Die Auswahl erscheint in der Oberfläche", () => {
  win.switchTab("kader");
  const h=$("lineupControls").innerHTML;
  return /handleTrainingChange/.test(h) && /Training/.test(h) ? true : "Auswahl fehlt";
});

check("Die Beschreibung wird angezeigt", () => {
  win.handleTrainingChange("athletics");
  const t=$("lineupControls").textContent;
  win.handleTrainingChange("balanced");
  return /Athletik/.test(t) && /Verletzungsrisiko/.test(t) ? true : "Beschreibung fehlt";
});

check("Eine Saison läuft mit wechselndem Fokus durch", () => {
  const foki=Object.keys(K.TRAINING_FOCUS);
  let n=0, i=0;
  while(n++<90 && !gs.seasonEnded){
    if(n%7===0) win.handleTrainingChange(foki[i++ % foki.length]);
    win.runNextEvent();
    if($("liveOverlay").classList.contains("show")){ win.skipLiveMatch(); win.closeLiveMatch(); }
  }
  return gs.matchday===K.TOTAL_MATCHDAYS ? true : `nur ${gs.matchday} Spieltage`;
});

check("Der Fokus überlebt den Saisonwechsel", () => {
  win.handleTrainingChange("defense");
  gs.board.patience=90; gs.board.dismissed=false;
  win.startNextSeason();
  return gs.training==="defense" ? true : gs.training;
});

check("Keine Laufzeitfehler", () => errors.length===0 ? true : errors.join(" | "));

console.log(fails===0?"\nAlle Tests bestanden.":`\n${fails} Test(s) fehlgeschlagen.`);
process.exit(fails===0?0:1);
