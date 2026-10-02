// ============================================
// MATCH-EVENTS.JS - Spielverlauf mit Wirkung
// ============================================
// Rote Karten und Verletzungen stehen vor dem Anpfiff mit ihrer Minute fest
// und veraendern ab dieser Minute die Torerwartung. Dazu kommen Formkurve,
// Spielernoten und das Elfmeterschiessen in K.o.-Spielen.

// Anteil der Torerwartung zwischen Minute von (exklusiv) und bis (inklusiv).
// In der zweiten Halbzeit fallen mehr Tore.
function minuteShare(von, bis){
  const h1 = HALFTIME_FIRST_SHARE / 45, h2 = (1 - HALFTIME_FIRST_SHARE) / 45;
  const erste = Math.max(0, Math.min(45, bis) - Math.min(45, von));
  const zweite = Math.max(0, Math.max(45, bis) - Math.max(45, von));
  return erste * h1 + zweite * h2;
}

function getStarterInjuryChance(gameState, faktor){
  const training = typeof getActiveTraining === "function" ? getActiveTraining().injury : 1;
  const medizin = typeof getMedicalInjuryFactor === "function" ? getMedicalInjuryFactor(gameState) : 1;
  return INJURY_CHANCE_STARTER * (faktor != null ? faktor : 1) * training * medizin;
}

// Platzverweise beider Seiten und Verletzungen der eigenen Startelf.
function planMatchIncidents(gameState, xi, gegnerKader){
  const inc = [];
  const rot = xi.find(() => Math.random() < RED_CARD_CHANCE);
  if(rot) inc.push({ type: "red", side: "own", minute: randInt(12, 88), playerId: rot.id, player: rot.name });

  if(Math.random() < RED_CARD_CHANCE * 11){
    const feld = (gegnerKader || []).filter(p => p.pos !== "TW");
    const p = feld.length ? randChoice(feld) : null;
    inc.push({ type: "red", side: "opp", minute: randInt(12, 88), playerId: p ? p.id : null, player: p ? p.name : null });
  }

  const chance = getStarterInjuryChance(gameState);
  xi.forEach(p => {
    if(rot && rot.id === p.id) return;
    if(Math.random() < chance){
      inc.push({ type: "injury", side: "own", minute: randInt(3, 88), playerId: p.id, player: p.name,
        duration: randInt(INJURY_MIN_DURATION, INJURY_MAX_DURATION) });
    }
  });
  return inc.sort((a, b) => a.minute - b.minute);
}

// Wirkung aller Ereignisse bis einschliesslich Minute m auf die Torerwartung.
function incidentFactors(incidents, m){
  let own = 1, opp = 1;
  (incidents || []).forEach(i => {
    if(i.minute > m) return;
    if(i.type === "red"){
      if(i.side === "own"){ own *= RED_CARD_ATTACK_FACTOR; opp *= RED_CARD_CONCEDE_FACTOR; }
      else { opp *= RED_CARD_ATTACK_FACTOR; own *= RED_CARD_CONCEDE_FACTOR; }
    } else if(i.type === "injury" && i.side === "own"){
      own *= INJURY_MATCH_FACTOR;
    }
  });
  return { own, opp };
}

// Spielt die Minuten (von, bis]. Jeder Abschnitt zwischen zwei Ereignissen
// wird mit den dann gueltigen Faktoren gewuerfelt; Tore bekommen eine Minute
// innerhalb ihres Abschnitts.
function playMatchSpan(lambdaHome, lambdaAway, ownIsHome, von, bis, incidents){
  const grenzen = [...new Set([von, ...(incidents || []).map(i => i.minute).filter(m => m > von && m < bis), bis])]
    .sort((a, b) => a - b);
  const goals = [];
  let homeGoals = 0, awayGoals = 0;
  for(let k = 0; k < grenzen.length - 1; k++){
    const a = grenzen[k], b = grenzen[k + 1];
    if(b <= a) continue;
    const f = incidentFactors(incidents, a);
    const lh = lambdaHome * (ownIsHome ? f.own : f.opp);
    const la = lambdaAway * (ownIsHome ? f.opp : f.own);
    const r = rollScore(lh, la, minuteShare(a, b));
    homeGoals += r.homeGoals; awayGoals += r.awayGoals;
    for(let i = 0; i < r.homeGoals; i++) goals.push({ minute: randInt(a + 1, b), side: ownIsHome ? "own" : "opp" });
    for(let i = 0; i < r.awayGoals; i++) goals.push({ minute: randInt(a + 1, b), side: ownIsHome ? "opp" : "own" });
  }
  goals.sort((x, y) => x.minute - y.minute);
  return { homeGoals, awayGoals, goals };
}

// Wer zur Minute m noch auf dem Platz steht.
function playersOnPitch(spieler, incidents, side, m){
  const weg = new Set((incidents || []).filter(i => i.side === side && i.minute < m && i.playerId).map(i => i.playerId));
  return spieler.filter(p => !weg.has(p.id));
}

// Torschuetzen passend zur Minute bestimmen (nicht wer schon vom Platz ist).
function assignGoalScorers(goals, xi, roster, incidents){
  goals.forEach(g => {
    const kader = g.side === "own" ? xi : roster;
    const p = pickScorer(playersOnPitch(kader, incidents, g.side, g.minute).filter(x => x.pos !== "TW"));
    g.scorerId = p ? p.id : null;
    g.scorer = p ? p.name : null;
  });
  return goals;
}

// Ein komplettes eigenes Ligaspiel mit Ereignissen. Liefert dieselbe Form wie
// der Halbzeit-Eingriff, damit simulateMatchday beide Wege gleich behandelt.
function playOwnLeagueMatch(gameState, home, away){
  const ownIsHome = home === gameState.clubName;
  const gegner = ownIsHome ? away : home;
  const xi = getStartingXI(gameState.squad, gameState.matchday + 1);
  const roster = gameState.pool ? getClubRoster(gameState.pool, gegner) : [];
  const incidents = planMatchIncidents(gameState, xi, roster);
  const l = getMatchLambdas(gameState, home, away);
  const span = playMatchSpan(l.home, l.away, ownIsHome, 0, MATCH_MINUTES, incidents);
  assignGoalScorers(span.goals, xi, roster, incidents);
  return {
    home, away, homeGoals: span.homeGoals, awayGoals: span.awayGoals,
    goals: span.goals, incidents,
    ownScorerIds: span.goals.filter(g => g.side === "own").map(g => g.scorerId).filter(Boolean),
    oppScorerIds: span.goals.filter(g => g.side === "opp").map(g => g.scorerId).filter(Boolean)
  };
}

// ============================================
// Formkurve
// ============================================

function pushForm(row, punkte){
  row.form = (row.form || []).concat(punkte).slice(-FORM_WINDOW);
}

// Staerkebonus aus den letzten Spielen: Serien geben Rueckenwind.
function getFormBonus(row){
  if(!row || !row.form || row.form.length < 2) return 0;
  const schnitt = row.form.reduce((s, x) => s + x, 0) / row.form.length;
  const bonus = (schnitt - FORM_NEUTRAL_POINTS) * FORM_FACTOR;
  return Math.max(-FORM_MAX_BONUS, Math.min(FORM_MAX_BONUS, bonus));
}

function getFormLabel(row){
  const b = getFormBonus(row);
  if(b >= 1.2) return "🔥 in Form";
  if(b <= -1.2) return "🥶 in der Krise";
  return null;
}

// ============================================
// Spielernoten (Schulnoten wie im Kicker: 1 = Weltklasse, 6 = Totalausfall)
// ============================================

function rateOwnPlayers(xi, info){
  const { ownGoals, oppGoals, goals, incidents, teamRatingValue } = info;
  const ergebnis = ownGoals > oppGoals ? -0.4 : ownGoals < oppGoals ? 0.4 : 0;
  const noten = xi.map(p => {
    let n = 3.5 + ergebnis + randInt(-6, 6) / 10;
    n -= ((p.strength || 60) - (teamRatingValue || 60)) / 20;
    const tore = goals.filter(g => g.side === "own" && g.scorerId === p.id).length;
    n -= tore * 0.9;
    const hinten = p.pos === "TW" || p.pos === "IV" || p.pos === "LV" || p.pos === "RV";
    if(hinten){
      n += oppGoals === 0 ? -0.6 : (oppGoals - 1) * 0.3;
    }
    const rot = (incidents || []).find(i => i.type === "red" && i.side === "own" && i.playerId === p.id);
    if(rot) n = Math.max(n, 5.5);
    const verletzt = (incidents || []).find(i => i.type === "injury" && i.side === "own" && i.playerId === p.id);
    const note = Math.round(Math.max(1, Math.min(6, n)) * 2) / 2;
    return { id: p.id, name: p.name, pos: p.pos, grade: note, goals: tore,
      red: !!rot, injured: !!verletzt, short: !!verletzt && verletzt.minute < 30 };
  });
  // Wer frueh raus musste, bekommt keine Note.
  const bewertet = noten.filter(n => !n.short);
  const besterWert = Math.min(...bewertet.map(n => n.grade));
  const kandidaten = bewertet.filter(n => n.grade === besterWert && !n.red);
  const motm = kandidaten.sort((a, b) => b.goals - a.goals)[0] || null;
  return { grades: bewertet, motm };
}

// Saisonschnitt fortschreiben.
function recordGrades(squad, bewertung){
  if(!bewertung) return;
  bewertung.grades.forEach(g => {
    const p = squad.find(x => x.id === g.id);
    if(!p) return;
    p.gradeSum = (p.gradeSum || 0) + g.grade;
    p.gradeCount = (p.gradeCount || 0) + 1;
  });
  if(bewertung.motm){
    const p = squad.find(x => x.id === bewertung.motm.id);
    if(p) p.motmCount = (p.motmCount || 0) + 1;
  }
}

function getAverageGrade(p){
  return p && p.gradeCount ? p.gradeSum / p.gradeCount : null;
}

function fmtGrade(n){
  return n == null ? "–" : n.toFixed(1).replace(".", ",");
}

// ============================================
// Verlaengerung und Elfmeterschiessen
// ============================================

// Fuer K.o.-Spiele: bei Remis 30 Minuten Verlaengerung, danach Elfmeter.
function resolveKnockoutDraw(lambdaHome, lambdaAway, homeStrength, awayStrength){
  const v = rollScore(lambdaHome, lambdaAway, EXTRA_TIME_SHARE);
  const res = { etHome: v.homeGoals, etAway: v.awayGoals, pens: null };
  if(v.homeGoals === v.awayGoals) res.pens = penaltyShootout(homeStrength, awayStrength);
  if(v.homeGoals !== v.awayGoals) res.homeWins = v.homeGoals > v.awayGoals;
  else res.homeWins = res.pens.home > res.pens.away;
  return res;
}

// Fuenf Schuetzen je Team, danach K.o. Staerke wirkt nur leicht.
function penaltyShootout(homeStrength, awayStrength){
  const diff = ((homeStrength || 60) - (awayStrength || 60)) / 400;
  const pH = Math.max(0.6, Math.min(0.88, PENALTY_CONVERSION + diff));
  const pA = Math.max(0.6, Math.min(0.88, PENALTY_CONVERSION - diff));
  const seqHome = [], seqAway = [];
  let h = 0, a = 0;
  // Abbruch, sobald eine Seite uneinholbar vorne liegt.
  const entschieden = (restH, restA) => h > a + restA || a > h + restH;
  for(let i = 0; i < 5; i++){
    if(Math.random() < pH){ h++; seqHome.push(true); } else seqHome.push(false);
    if(entschieden(4 - i, 5 - i)) break;
    if(Math.random() < pA){ a++; seqAway.push(true); } else seqAway.push(false);
    if(entschieden(4 - i, 4 - i)) break;
  }
  let runde = 0;
  while(h === a && runde++ < 20){
    const th = Math.random() < pH, ta = Math.random() < pA;
    seqHome.push(th); seqAway.push(ta);
    if(th) h++;
    if(ta) a++;
  }
  if(h === a){ if(Math.random() < 0.5) h++; else a++; }
  return { home: h, away: a, seqHome, seqAway };
}

function fmtPenSeq(seq){
  return (seq || []).map(x => x ? "●" : "○").join("");
}

// Ergebniszusatz: "n.V." oder "i.E. 5:4".
function knockoutSuffix(m){
  if(m && m.pens) return `i.E. ${m.pens.home}:${m.pens.away}`;
  if(m && m.extraTime) return "n.V.";
  return "";
}
