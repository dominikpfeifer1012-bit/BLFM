// ============================================
// PRESS.JS - Pressekonferenzen
// ============================================
// Zwischen den Spieltagen meldet sich die Presse. Jede Antwort hat einen
// Preis: Wer die Mannschaft oeffentlich schuetzt, staerkt die Stimmung und
// belastet das Verhaeltnis zum Vorstand — und umgekehrt.

const PRESS_MIN_GAP = 4;          // Mindestabstand in Spieltagen
const PRESS_SKIP_MORALE = -1.5;   // Kosten einer Nichtaussage
const PRESS_SKIP_PATIENCE = -1;

// Jede Situation hat eine Bedingung und drei Antworten. Die Wirkung trifft
// die Kaderstimmung (morale) und die Geduld des Vorstands (patience).
const PRESS_SITUATIONS = [
  {
    key: "siegesserie",
    gewicht: 3,
    bedingung: gs => (gs.currentWinStreak || 0) >= 3,
    frage: gs => `${gs.currentWinStreak} Siege in Folge. Ist mehr drin als das Saisonziel?`,
    antworten: [
      { text: "Wir greifen oben an.", morale: 5, patience: 4, target: -1,
        folge: "Selbstbewusst — dafür erwartet der Vorstand jetzt einen Platz mehr." },
      { text: "Schön, aber wir bleiben bei unserem Ziel.", morale: 2, patience: 1,
        folge: "Nüchtern und ohne Risiko." },
      { text: "Eine Serie sagt noch nichts aus.", morale: -3, patience: 2,
        folge: "Der Vorstand schätzt die Bodenhaftung, die Mannschaft weniger." }
    ]
  },
  {
    key: "niederlagenserie",
    gewicht: 4,
    bedingung: gs => (gs.records && gs.records.currentUnbeaten === 0)
      && zaehleLetzteNiederlagen(gs) >= 3,
    frage: () => "Drei Niederlagen nacheinander. Woran liegt es?",
    antworten: [
      { text: "Ich stelle mich vor die Mannschaft.", morale: 7, patience: -5,
        folge: "Die Spieler danken es, der Vorstand sieht es kritisch." },
      { text: "Wir haben Fehler gemacht, die wir abstellen.", morale: -1, patience: 1,
        folge: "Sachlich — niemand ist begeistert, niemand verärgert." },
      { text: "Diese Leistung war nicht akzeptabel.", morale: -7, patience: 5,
        folge: "Klare Ansage nach oben, die Kabine ist angespannt." }
    ]
  },
  {
    key: "abstiegskampf",
    gewicht: 4,
    bedingung: gs => eigenePosition(gs) >= gs.teams.length - 3 && gs.matchday >= 8,
    frage: () => "Der Blick auf die Tabelle macht Sorgen. Wie gehen Sie damit um?",
    antworten: [
      { text: "Wir schaffen den Klassenerhalt, das verspreche ich.", morale: 4, patience: 5, target: -1,
        folge: "Ein Versprechen, an dem Sie ab sofort gemessen werden." },
      { text: "Wir arbeiten Spiel für Spiel.", morale: 1, patience: 0,
        folge: "Kein Risiko, keine Wirkung." },
      { text: "Der Kader gibt derzeit nicht mehr her.", morale: -6, patience: -3,
        folge: "Ehrlich, aber niemand hört es gern." }
    ]
  },
  {
    key: "spitzenspiel",
    gewicht: 2,
    bedingung: gs => {
      const info = typeof getNextOpponentInfo === "function" ? getNextOpponentInfo(gs) : null;
      return info && info.opponentStrength >= info.ownStrength + 6;
    },
    frage: gs => {
      const info = getNextOpponentInfo(gs);
      return `Vor dem Spiel gegen ${info ? info.opponentName : "den Favoriten"} — was erwarten Sie?`;
    },
    antworten: [
      { text: "Wir fahren dort hin, um zu gewinnen.", morale: 5, patience: 2, target: -1,
        folge: "Mutig — die Mannschaft nimmt das auf, der Anspruch steigt." },
      { text: "Wir werden es dem Gegner schwer machen.", morale: 1, patience: 0,
        folge: "Zurückhaltend und unverfänglich." },
      { text: "Realistisch betrachtet ist das ein Bonusspiel.", morale: -4, patience: 1,
        folge: "Der Druck ist raus, die Mannschaft fühlt sich abgeschrieben." }
    ]
  },
  {
    key: "unzufriedene",
    gewicht: 3,
    bedingung: gs => typeof getUnhappyPlayers === "function"
      && getUnhappyPlayers(gs).length >= 2,
    frage: gs => {
      const liste = getUnhappyPlayers(gs);
      return `Es heißt, ${liste[0].name} und andere wollen weg. Stimmt das?`;
    },
    antworten: [
      { text: "Jeder hier bekommt seine Chance.", morale: 8, patience: -2,
        folge: "Beruhigt die Kabine, kostet aber Rückhalt beim Vorstand." },
      { text: "Wer gehen will, kann gehen.", morale: -8, patience: 4,
        folge: "Harte Linie — der Vorstand nickt, die Betroffenen nicht." },
      { text: "Interne Angelegenheiten bespreche ich intern.", morale: 2, patience: 0,
        folge: "Nichts gesagt, nichts kaputt gemacht." }
    ]
  },
  {
    key: "jugend",
    gewicht: 2,
    bedingung: gs => (gs.squad || []).filter(p => p.isYouthProduct).length >= 3,
    frage: () => "Ihre Eigengewächse fallen auf. Setzen Sie künftig stärker auf sie?",
    antworten: [
      { text: "Wer gut genug ist, spielt — unabhängig vom Alter.", morale: 5, patience: 1, target: -1,
        folge: "Kommt bei den Talenten an, der Vorstand erwartet nun mehr." },
      { text: "Wir entwickeln in Ruhe, ohne sie zu verheizen.", morale: 3, patience: 0,
        folge: "Besonnen und unstrittig." },
      { text: "Für ganz oben brauchen wir erfahrene Spieler.", morale: -4, patience: 2,
        folge: "Der Vorstand hört Ehrgeiz, die Talente hören etwas anderes." }
    ]
  },
  {
    key: "saisonstart",
    gewicht: 3,
    bedingung: gs => gs.matchday >= 1 && gs.matchday <= 2,
    frage: gs => `Die Saison läuft. Ihr Ziel lautet „${gs.board ? gs.board.goalLabel : "—"}“. Reicht Ihnen das?`,
    antworten: [
      { text: "Wir wollen mehr als das.", morale: 4, patience: 3, target: -1,
        folge: "Ehrgeizig — der Vorstand nimmt Sie beim Wort." },
      { text: "Das Ziel ist realistisch, genau so gehen wir es an.", morale: 1, patience: 2,
        folge: "Solide und unaufgeregt." },
      { text: "Erst mal abwarten, wie wir reinkommen.", morale: -2, patience: -1,
        folge: "Vorsichtig — manche lesen es als Zweifel." }
    ]
  },
  {
    key: "tabellenfuehrer",
    gewicht: 3,
    bedingung: gs => gs.matchday >= 8 && eigenePosition(gs) === 1,
    frage: () => "Sie stehen an der Tabellenspitze. Wird man Sie da noch verdrängen?",
    antworten: [
      { text: "Da oben bleiben wir.", morale: 5, patience: 3, target: -2,
        folge: "Kampfansage — jetzt zählt nur noch Platz eins." },
      { text: "Die Tabelle ist eine Momentaufnahme.", morale: 1, patience: 1,
        folge: "Klassisch und unangreifbar." },
      { text: "Wir sind selbst überrascht.", morale: -3, patience: 0,
        folge: "Sympathisch, aber die Kabine will Führung hören." }
    ]
  },
  {
    key: "ungeschlagen",
    gewicht: 2,
    bedingung: gs => gs.records && (gs.records.currentUnbeaten || 0) >= 6,
    frage: gs => `${gs.records.currentUnbeaten} Spiele ohne Niederlage. Was ist Ihr Geheimnis?`,
    antworten: [
      { text: "Die Mannschaft ist eine Einheit.", morale: 5, patience: 1,
        folge: "Die Spieler fühlen sich gesehen." },
      { text: "Harte Arbeit im Training.", morale: 2, patience: 2,
        folge: "Der Vorstand mag diese Antwort." },
      { text: "Ehrlich gesagt auch etwas Glück.", morale: -2, patience: -1,
        folge: "Bescheiden — vielleicht zu bescheiden." }
    ]
  },
  {
    key: "torflaute",
    gewicht: 3,
    bedingung: gs => {
      const letzte = typeof getOwnResults === "function" ? getOwnResults(gs).slice(-3) : [];
      return letzte.length === 3 && letzte.reduce((s, r) => s + r.goalsFor, 0) <= 1;
    },
    frage: () => "Ein Tor in drei Spielen. Haben Sie ein Stürmerproblem?",
    antworten: [
      { text: "Die Tore kommen, ich vertraue meinen Stürmern.", morale: 5, patience: -2,
        folge: "Rückendeckung für die Offensive." },
      { text: "Wir arbeiten an der Chancenverwertung.", morale: 0, patience: 1,
        folge: "Nüchtern und richtig." },
      { text: "Wir schauen uns auf dem Markt um.", morale: -5, patience: 2,
        folge: "Die Stürmer haben es gelesen." }
    ]
  },
  {
    key: "pokalaus",
    gewicht: 4,
    bedingung: gs => {
      const c = gs.cup;
      if(!c || !c.eliminated || !c.exitRound) return false;
      const termin = getCupTriggerMatchdays(gs)[c.exitRound - 1];
      return termin != null && gs.matchday >= termin - 1 && gs.matchday <= termin + 1;
    },
    frage: gs => `Aus im ${getCupName(gs)} (${CUP_ROUND_LABELS[gs.cup.exitRound - 1] || "Pokal"}). Wie bitter ist das?`,
    antworten: [
      { text: "Jetzt zählt nur noch die Liga.", morale: 2, patience: 1,
        folge: "Der Blick geht nach vorn." },
      { text: "Das war eine Blamage, dafür entschuldige ich mich.", morale: -4, patience: 3,
        folge: "Der Vorstand schätzt die Ehrlichkeit, die Spieler weniger." },
      { text: "Der Pokal hat seine eigenen Gesetze.", morale: 1, patience: -2,
        folge: "Abgedroschen — oben kommt das nicht gut an." }
    ]
  },
  {
    key: "pokallauf",
    gewicht: 3,
    bedingung: gs => {
      const c = gs.cup;
      if(!c || !c.active || c.eliminated || c.round < 2) return false;
      const naechster = getCupTriggerMatchdays(gs)[c.round];
      return naechster != null && naechster - (gs.matchday + 1) <= 1 && naechster - (gs.matchday + 1) >= 0;
    },
    frage: gs => `Als Nächstes steht das ${CUP_ROUND_LABELS[gs.cup.round] || "nächste Pokalspiel"} an. Träumen Sie schon vom Finale?`,
    antworten: [
      { text: "Natürlich, wir wollen den Pokal.", morale: 5, patience: -2,
        folge: "Die Mannschaft brennt — der Vorstand fürchtet um die Liga." },
      { text: "Wir denken von Runde zu Runde.", morale: 1, patience: 1,
        folge: "Vernünftig." },
      { text: "Die Liga hat Vorrang.", morale: -3, patience: 2,
        folge: "Der Vorstand nickt, die Spieler sind enttäuscht." }
    ]
  },
  {
    key: "vorstandwackelt",
    gewicht: 5,
    bedingung: gs => gs.board && !gs.board.dismissed && gs.board.patience < BOARD_WARN_THRESHOLD + 5 && gs.matchday >= 6,
    frage: () => "Es heißt, Ihr Stuhl wackelt. Haben Sie noch das Vertrauen des Vorstands?",
    antworten: [
      { text: "Ich bin überzeugt, dass wir die Wende schaffen.", morale: 3, patience: 3,
        folge: "Kämpferisch — der Vorstand gibt Ihnen noch etwas Zeit." },
      { text: "Das müssen Sie den Vorstand fragen.", morale: -2, patience: -4,
        folge: "Patzig — oben kommt das schlecht an." },
      { text: "Ich konzentriere mich auf die Mannschaft.", morale: 4, patience: 0,
        folge: "Die Kabine steht hinter Ihnen." }
    ]
  }
];

function zaehleLetzteNiederlagen(gs){
  if(typeof getOwnResults !== "function") return 0;
  const ergebnisse = getOwnResults(gs);
  let n = 0;
  for(let i = ergebnisse.length - 1; i >= 0; i--){
    if(ergebnisse[i].result === "loss") n++; else break;
  }
  return n;
}

function eigenePosition(gs){
  const sorted = getSortedStandings(gs.teams || []);
  const idx = sorted.findIndex(t => t.name === gs.clubName);
  return idx === -1 ? 99 : idx + 1;
}

function isPressEnabled(gs){
  return gs && gs.pressConferences !== false;
}

// Waehlt eine passende Situation aus. Gibt null zurueck, wenn gerade keine
// ansteht — dann meldet sich die Presse einfach nicht.
function pickPressSituation(gameState){
  if(!isPressEnabled(gameState)) return null;
  if(gameState.seasonEnded) return null;

  const letzte = gameState.lastPressMatchday != null ? gameState.lastPressMatchday : -99;
  if(gameState.matchday - letzte < PRESS_MIN_GAP) return null;

  let passend = PRESS_SITUATIONS.filter(s => {
    try { return s.bedingung(gameState); } catch(e) { return false; }
  });
  // Dieselbe Frage nicht zweimal hintereinander, sofern es eine andere gibt.
  const zuletzt = (gameState.pressHistory || []).slice(-1)[0];
  if(zuletzt && passend.length > 1) passend = passend.filter(s => s.key !== zuletzt.situation);
  if(passend.length === 0) return null;

  // Nach Gewicht ziehen, damit brisante Lagen haeufiger drankommen.
  const gesamt = passend.reduce((sum, s) => sum + s.gewicht, 0);
  let wurf = Math.random() * gesamt;
  for(const s of passend){
    wurf -= s.gewicht;
    if(wurf <= 0) return s;
  }
  return passend[passend.length - 1];
}

function applyPressAnswer(gameState, situationKey, index){
  const situation = PRESS_SITUATIONS.find(s => s.key === situationKey);
  if(!situation) return null;

  const antwort = index != null && situation.antworten[index]
    ? situation.antworten[index]
    : { text: "Keine Stellungnahme.", morale: PRESS_SKIP_MORALE,
        patience: PRESS_SKIP_PATIENCE, folge: "Die Presse notiert Ihr Schweigen." };

  if(antwort.morale && typeof setMorale === "function"){
    (gameState.squad || []).forEach(p => setMorale(p, getMorale(p) + antwort.morale));
  }
  if(antwort.patience && gameState.board){
    gameState.board.patience = Math.max(0, Math.min(BOARD_MAX_PATIENCE,
      gameState.board.patience + antwort.patience));
  }
  // Grosse Ankuendigungen erhoehen den Anspruch: der Vorstand misst Sie ab
  // sofort an einer besseren Platzierung. Damit hat jede mutige Antwort
  // ihren Preis und keine ist pauschal die beste Wahl.
  if(antwort.target && gameState.board){
    gameState.board.targetPosition = Math.max(1,
      gameState.board.targetPosition + antwort.target);
  }

  gameState.lastPressMatchday = gameState.matchday;
  if(antwort.target && gameState.board){
    gameState.board.goalLabel = `${gameState.board.goalLabel} (nachgeschärft)`
      .replace(/ \(nachgeschärft\)+$/, " (nachgeschärft)");
  }
  gameState.pressHistory = gameState.pressHistory || [];
  gameState.pressHistory.push({
    season: gameState.season, matchday: gameState.matchday,
    situation: situationKey, antwort: antwort.text,
    morale: antwort.morale || 0, patience: antwort.patience || 0
  });
  if(gameState.pressHistory.length > 60){
    gameState.pressHistory = gameState.pressHistory.slice(-60);
  }

  return antwort;
}
