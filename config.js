// ============================================
// CONFIG.JS - Zentrale Konstanten und Einstellungen
// ============================================

const CLUBS = [
  {name:"FC Bayern München", strength:92},
  {name:"Bayer Leverkusen", strength:87},
  {name:"RB Leipzig", strength:85},
  {name:"Borussia Dortmund", strength:84},
  {name:"VfB Stuttgart", strength:78},
  {name:"Eintracht Frankfurt", strength:77},
  {name:"SC Freiburg", strength:75},
  {name:"1. FC Union Berlin", strength:74},
  {name:"Werder Bremen", strength:72},
  {name:"VfL Wolfsburg", strength:73},
  {name:"1. FSV Mainz 05", strength:70},
  {name:"Borussia Mönchengladbach", strength:71},
  {name:"TSG Hoffenheim", strength:69},
  {name:"FC Augsburg", strength:66},
  {name:"1. FC Heidenheim", strength:64},
  {name:"FC St. Pauli", strength:62},
  {name:"Holstein Kiel", strength:61},
  {name:"FC Schalke 04", strength:68}
];

const SECOND_DIVISION_CLUBS = [
  {name:"Hamburger SV", strength:66},
  {name:"1. FC Köln", strength:65},
  {name:"Hertha BSC", strength:63},
  {name:"Fortuna Düsseldorf", strength:62},
  {name:"1. FC Kaiserslautern", strength:60},
  {name:"Karlsruher SC", strength:60},
  {name:"Hannover 96", strength:59},
  {name:"SC Paderborn 07", strength:59},
  {name:"1. FC Nürnberg", strength:58},
  {name:"SV Elversberg", strength:57},
  {name:"1. FC Magdeburg", strength:57},
  {name:"SpVgg Greuther Fürth", strength:56},
  {name:"SV Darmstadt 98", strength:56},
  {name:"Eintracht Braunschweig", strength:54},
  {name:"Hansa Rostock", strength:53},
  {name:"Preußen Münster", strength:52},
  {name:"SSV Ulm 1846", strength:52},
  {name:"SSV Jahn Regensburg", strength:51}
];

const SQUAD_COMPOSITION = [
  {pos:"TW", count:3}, {pos:"RV", count:2}, {pos:"IV", count:5}, {pos:"LV", count:2},
  {pos:"DM", count:2}, {pos:"ZM", count:3}, {pos:"LM", count:2}, {pos:"RM", count:2},
  {pos:"OM", count:2}, {pos:"ST", count:2}
];

const POSITION_ORDER = ["TW","RV","IV","LV","DM","ZM","LM","RM","OM","ST"];

const POSITION_ICONS = {
  TW: "🧤", RV: "🛡️", IV: "🧱", LV: "🛡️", DM: "🔒",
  ZM: "⚙️", LM: "➰", RM: "➰", OM: "🎯", ST: "⚽"
};

// Statt grober Gruppen liegt jede Position auf einer Linie und einer Seite.
// Der Malus ergibt sich daraus, wie weit ein Spieler von seiner Position weg
// muss: ein Seitenwechsel (LM statt RM) kostet wenig, ein Linienwechsel mehr.
const POSITION_LAYOUT = {
  TW: { line:0, side:"C", keeper:true },
  LV: { line:1, side:"L" }, IV: { line:1, side:"C" }, RV: { line:1, side:"R" },
  DM: { line:2, side:"C" },
  LM: { line:3, side:"L" }, ZM: { line:3, side:"C" }, RM: { line:3, side:"R" },
  OM: { line:4, side:"C" },
  ST: { line:5, side:"C" }
};
const POSITION_LINE_PENALTY = 3.5;    // je Linie Abstand
const POSITION_MIRROR_PENALTY = 2;    // links <-> rechts
const POSITION_FLANK_PENALTY = 5;     // aussen <-> zentral
const POSITION_KEEPER_PENALTY = 22;   // Torwart ist nicht ersetzbar
const POSITION_MAX_PENALTY = 20;

const SCORER_WEIGHTS = { TW:0, RV:1, IV:2, LV:1, DM:2, ZM:3, LM:3, RM:3, OM:6, ST:10 };

// --- Formationen ---
// needs bestimmt die elf Plaetze, rows die Darstellung auf dem Spielfeld.
const FORMATIONS = {
  "4-2-3-1": { needs:{TW:1, RV:1, IV:2, LV:1, DM:2, LM:1, OM:1, RM:1, ST:1},
               rows:[["ST"],["LM","OM","RM"],["DM"],["LV","IV","RV"],["TW"]] },
  "4-4-2":   { needs:{TW:1, RV:1, IV:2, LV:1, ZM:2, LM:1, RM:1, ST:2},
               rows:[["ST"],["LM","ZM","RM"],["LV","IV","RV"],["TW"]] },
  "4-3-3":   { needs:{TW:1, RV:1, IV:2, LV:1, DM:1, ZM:2, LM:1, RM:1, ST:1},
               rows:[["LM","ST","RM"],["ZM"],["DM"],["LV","IV","RV"],["TW"]] },
  "4-1-4-1": { needs:{TW:1, RV:1, IV:2, LV:1, DM:1, ZM:2, LM:1, RM:1, ST:1},
               rows:[["ST"],["LM","ZM","RM"],["DM"],["LV","IV","RV"],["TW"]] },
  "3-5-2":   { needs:{TW:1, IV:3, DM:1, ZM:2, LM:1, RM:1, ST:2},
               rows:[["ST"],["LM","ZM","RM"],["DM"],["IV"],["TW"]] },
  "5-3-2":   { needs:{TW:1, LV:1, IV:3, RV:1, DM:1, ZM:2, ST:2},
               rows:[["ST"],["ZM"],["DM"],["LV","IV","RV"],["TW"]] }
};
const DEFAULT_FORMATION = "4-2-3-1";

// --- Grundausrichtung ---
const TACTICS = {
  offensive: { label:"Offensiv",      own:+0.25, opp:+0.20, desc:"Mehr eigene Chancen, dafür mehr Gegentore." },
  balanced:  { label:"Ausgeglichen",  own:0,     opp:0,     desc:"Keine Verschiebung in eine Richtung." },
  defensive: { label:"Defensiv",      own:-0.20, opp:-0.25, desc:"Weniger Gegentore, dafür weniger eigene Chancen." }
};
const DEFAULT_TACTIC = "balanced";

// --- Vertraege ---
const CONTRACT_MIN_YEARS = 2;
const CONTRACT_MAX_YEARS = 5;
const CONTRACT_YOUTH_YEARS = 3;
const CONTRACT_RENEWAL_YEARS = 3;
const CONTRACT_RENEWAL_FEE_FACTOR = 0.12;   // Anteil des Marktwerts als Handgeld

// --- Belastung durch Pokalspiele ---
const CUP_INJURY_FACTOR = 0.8;   // etwas geringer als im Ligaspiel

const YELLOW_CARD_CHANCE_STARTER = 0.12;
const RED_CARD_CHANCE = 0.002;
const YELLOW_CARDS_FOR_BAN = 5;
const YELLOW_ACCUMULATION_BAN_MATCHES = 1;
const RED_CARD_BAN_MATCHES = 2;

// Profis bestreiten regelmaessig 30+ Startelfeinsaetze pro Saison. Die
// Ermuedung soll Rotation belohnen, nicht Dauerspieler bestrafen: acht
// Spiele in Folge sind frei, danach hoechstens -3.
const FATIGUE_THRESHOLD_MATCHES = 8;
const FATIGUE_PENALTY_PER_EXTRA_MATCH = 0.5;
const FATIGUE_MAX_PENALTY = 3;

const CUP_ROUND_TRIGGER_MATCHDAYS = [3, 8, 14, 22, 30];
const CUP_ROUND_LABELS = ["1. Runde", "Achtelfinale", "Viertelfinale", "Halbfinale", "Finale"];
// 32 Teilnehmer: alle Erstligisten plus gezogene Zweitligisten.
// 32 -> 16 -> 8 -> 4 -> 2 -> 1 ergibt genau fuenf Runden ohne Freilos.
const CUP_FIELD_SIZE = 32;
const CUP_ROUND_BONUS = 250000;
const CUP_CHAMPION_BONUS = 4000000;

// Europapokal im Championsleague-Format: 8 Gruppen a 4 Teams, davon 4 aus
// der Bundesliga (Top 4 der Vorsaison) und 28 europaeische Vereine.
// Gruppenphase mit Hin- und Rueckspiel, danach K.o. ab dem Achtelfinale.
const EUROPE_GROUP_COUNT = 8;
const EUROPE_TEAMS_PER_GROUP = 4;
const EUROPE_GROUP_NAMES = ["A","B","C","D","E","F","G","H"];
const EUROPE_QUALIFY_PER_GROUP = 2;

const EUROPE_GROUP_MATCHDAYS = [2, 5, 7, 11, 13, 16];
const EUROPE_KO_MATCHDAYS = [20, 24, 28, 32];
const EUROPE_KO_LABELS = ["Achtelfinale", "Viertelfinale", "Halbfinale", "Finale"];

const EUROPE_GROUP_WIN_BONUS = 150000;
const EUROPE_GROUP_DRAW_BONUS = 50000;
const EUROPE_QUALIFY_BONUS = 800000;
const EUROPE_ROUND_BONUS = 400000;
const EUROPE_CHAMPION_BONUS = 6000000;

const EURO_CLUBS = [
  {name:"Real Madrid", strength:93},
  {name:"Manchester City", strength:92},
  {name:"FC Barcelona", strength:90},
  {name:"FC Liverpool", strength:90},
  {name:"Paris Saint-Germain", strength:89},
  {name:"Inter Mailand", strength:88},
  {name:"FC Arsenal", strength:88},
  {name:"Atlético Madrid", strength:86},
  {name:"FC Chelsea", strength:85},
  {name:"Juventus Turin", strength:85},
  {name:"SSC Neapel", strength:84},
  {name:"Atalanta Bergamo", strength:83},
  {name:"AC Mailand", strength:83},
  {name:"Manchester United", strength:82},
  {name:"Benfica Lissabon", strength:81},
  {name:"Sporting Lissabon", strength:81},
  {name:"FC Porto", strength:80},
  {name:"PSV Eindhoven", strength:79},
  {name:"Ajax Amsterdam", strength:78},
  {name:"Olympique Marseille", strength:78},
  {name:"Feyenoord Rotterdam", strength:77},
  {name:"Club Brügge", strength:76},
  {name:"RB Salzburg", strength:75},
  {name:"Galatasaray Istanbul", strength:75},
  {name:"Celtic Glasgow", strength:74},
  {name:"Schachtar Donezk", strength:73},
  {name:"Roter Stern Belgrad", strength:72},
  {name:"Olympique Lyon", strength:72}
];

const ACHIEVEMENTS = [
  { key:"firstWin", label:"🏆 Erster Sieg", desc:"Ersten Pflichtsieg eingefahren" },
  { key:"winStreak5", label:"🔥 5 Siege in Folge", desc:"Fünf Spiele in Serie gewonnen" },
  { key:"champion", label:"👑 Meister", desc:"Die 1. Bundesliga-Saison auf Platz 1 beendet" },
  { key:"topFour", label:"⭐ Europapokal-Rang", desc:"1. Bundesliga-Saison unter den Top 4 beendet" },
  { key:"bigSigning", label:"💎 Königstransfer", desc:"Einen Spieler für über 50% des verfügbaren Budgets verpflichtet" },
  { key:"cupWinner", label:"🏆 Pokalsieger", desc:"Den DFB-Pokal gewonnen" },
  { key:"europeChampion", label:"🌍 Europapokalsieger", desc:"Den Europapokal gewonnen" },
  { key:"promotion", label:"⬆️ Aufstieg", desc:"Aus der 2. in die 1. Bundesliga aufgestiegen" },
  { key:"youthStar", label:"🌱 Eigengewächs", desc:"Einen Jugendspieler auf Bewertung 85 entwickelt" }
];

const PRICE_CONFIG = {
  baseValue: 1600000,
  refStrength: 70,
  exponent: 6.6,
  minValue: 150000,
  roundTo: 50000
};

const VALUE_LONGEVITY_CURVE = [
  {age:17, factor:1.4},
  {age:29, factor:1.0},
  {age:35, factor:0.35}
];
const VALUE_POTENTIAL_PREMIUM_WEIGHT = 0.5;
const VALUE_POTENTIAL_PREMIUM_DIVISOR = 30;
const VALUE_POTENTIAL_PREMIUM_MAX = 0.6;

const BUDGET_REFERENCE_STRENGTH = 92;
const BUDGET_REFERENCE_AMOUNT = 32000000;
const BUDGET_EXPONENT = 3.6;
const BUDGET_ROUND_TO = 50000;

// Leistungspraemien sind fuer JEDEN Verein identisch. Ein Sieg ist ein Sieg,
// ein Titel ist ein Titel — unabhaengig davon, wie gross der Verein ist.
const MATCH_BONUS_BASE = {
  win: 200000,
  draw: 70000,
  loss: 0
};
const UNDERDOG_BONUS_PER_POINT = 15000;

const SELL_FACTOR = 0.9;
const MIN_SQUAD_SIZE = 18;
const MATCHES_PER_MATCHDAY = 9;
const TOTAL_MATCHDAYS = 34;

const TRANSFER_WINDOWS = [
  [1, 5],
  [16, 18]
];

const INJURY_CHANCE_STARTER = 0.02;
const INJURY_CHANCE_BENCH = 0.01;
const INJURY_MIN_DURATION = 2;
const INJURY_MAX_DURATION = 5;
const INJURY_DECLINE_PER_MATCHDAY = 0.08;

const TEAM_RATING_XI_WEIGHT = 0.75;
const TEAM_RATING_BENCH_WEIGHT = 0.25;
const TEAM_RATING_BENCH_SIZE = 7;   // nur die echte Ersatzbank zaehlt

const DEV_YOUNG_AGE = 18;
const DEV_PEAK_AGE_START = 26;
const DEV_PEAK_AGE_END = 29;
const DEV_DECLINE_END_AGE = 35;
const DEV_MAX_GROWTH_PER_MATCHDAY = 0.12;
const DEV_MAX_DECLINE_PER_MATCHDAY = 0.05;
const DEV_STARTER_GROWTH_MULTIPLIER = 1.7;
const DEV_STARTER_DECLINE_MULTIPLIER = 0.5;

const DEV_POTENTIAL_SLOPE = -1/3;
const DEV_POTENTIAL_INTERCEPT = 30;
const DEV_POTENTIAL_GAIN_MIN = 1;
const DEV_POTENTIAL_GAIN_MAX = 25;

const SCOUTING_CHANCE = 0.12;
const SCOUTING_POTENTIAL_BONUS_MIN = 10;
const SCOUTING_POTENTIAL_BONUS_MAX = 25;
const SCOUTING_POTENTIAL_CAP = 97;

const SEASON_END_BONUS_BASE = 4000000;
const SEASON_END_BONUS_MIN_FACTOR = 0.15;

// --- Entwicklung der KI-Vereine zwischen den Saisons ---
// Jeder Verein hat ein festes Grundniveau (baseStrength). Die aktuelle
// Staerke pendelt darum herum, kann sich aber nie dauerhaft davon loesen.
const AI_DRIFT_REVERSION = 0.35;        // Ruecktrieb zum Grundniveau
const AI_DRIFT_PERFORMANCE = 2.2;       // Einfluss der Vorsaison-Platzierung
const AI_DRIFT_NOISE = 1.0;             // Zufallsanteil
const AI_DRIFT_MAX_PER_SEASON = 3.0;    // Deckel pro Saison
const AI_DRIFT_MAX_DEVIATION = 5.0;     // maximaler Abstand zum Grundniveau
const AI_DRIFT_PROMOTION_BOOST = 2.5;   // Aufsteiger investieren
const AI_DRIFT_RELEGATION_HIT = -2.5;   // Absteiger verlieren Spieler
const AI_STRENGTH_FLOOR = 42;
const AI_STRENGTH_CEILING = 94;

// --- Gehaelter ---
// Bewusst an die Staerke gekoppelt, nicht an den Marktwert: ein alternder
// Star hat einen niedrigen Marktwert, kostet im Kader aber weiter viel Geld.
const SALARY_BASE = 300000;        // Jahresgehalt bei Referenzstaerke
const SALARY_REF_STRENGTH = 70;
const SALARY_EXPONENT = 4.5;       // flacher als die Marktwertkurve (6.6)
const SALARY_MIN = 60000;
const SALARY_ROUND_TO = 10000;
const SALARY_YOUTH_AGE = 20;       // bis hier gilt der Nachwuchsrabatt
const SALARY_FULL_AGE = 24;        // ab hier volles Gehalt
const SALARY_YOUTH_FACTOR = 0.6;

// --- Einnahmen ---
// TV-Geld, Zuschauer und Sponsoren richten sich nach dem VEREINSSTANDING.
// Das Standing waechst mit sportlichem Erfolg, ist also nicht wie die
// Poolstaerke bei der Gruendungsstaerke eingefroren. Nur so kann ein klein
// gestarteter Verein seine gestiegene Gehaltslast auch tragen.
const MATCHDAY_FLAT_REVENUE = 35000;      // fuer jeden Verein gleich
const MATCHDAY_SCALED_REVENUE = 140000;   // waechst mit dem Standing
const CLUB_REVENUE_REF_STRENGTH = 70;
const CLUB_REVENUE_EXPONENT = 4.5;        // wie die Gehaltskurve
const CLUB_REVENUE_MIN_FACTOR = 0.30;
const CLUB_REVENUE_MAX_FACTOR = 4.0;
const DIVISION2_REVENUE_FACTOR = 0.5;

// --- Vereinsstanding ---
// Zielwert = Kaderstaerke, angepasst um Platzierung und Liga. Das Standing
// folgt diesem Ziel langsam, Erfolg zahlt sich also erst mit Verzoegerung aus.
const STATURE_MAX_RISE_PER_SEASON = 4.0;
const STATURE_MAX_FALL_PER_SEASON = 3.0;
const STATURE_POSITION_SWING = 4.0;   // Platz 1 bringt +4, letzter Platz -4
const STATURE_DIVISION2_PENALTY = 8.0;
const STATURE_MIN = 40;
const STATURE_MAX = 95;

// --- Karriereende ---
// Die Wahrscheinlichkeit steigt mit dem Alter; schwache Spieler hoeren eher auf.
const RETIREMENT_MIN_AGE = 33;
const RETIREMENT_FORCED_AGE = 40;
const RETIREMENT_BASE_CHANCE = 0.12;
const RETIREMENT_AGE_RAMP = 0.12;
const RETIREMENT_WEAK_THRESHOLD = 60;
const RETIREMENT_WEAK_BONUS = 0.20;

// --- Jugendabteilung ---
// Der Nachwuchs startet schwach, hat aber deutlich mehr Luft nach oben als
// ein Marktspieler gleicher Staerke. Das ist der eigentliche Reiz.
const YOUTH_INTAKE_MAX = 4;
const YOUTH_AGE_MIN = 16;
const YOUTH_AGE_MAX = 19;
const YOUTH_STRENGTH_OFFSET = 20;   // Abstand zur Vereinsstaerke
const YOUTH_STRENGTH_SPREAD = 5;
const YOUTH_POTENTIAL_MIN = 8;
const YOUTH_POTENTIAL_MAX = 34;
const YOUTH_TALENT_CHANCE = 0.15;   // Chance auf ein Ausnahmetalent
const YOUTH_STAR_ACHIEVEMENT_RATING = 85;

const LOG_MAX_ENTRIES = 300;
// Wie viele Eintraege gleichzeitig im Protokoll stehen. Ohne Begrenzung
// waechst der Seiteninhalt mit jeder Saison und das Zeichnen wird langsam.
const LOG_PAGE_SIZE = 40;

// --- Vorstand und Saisonziel ---
// Das Ziel richtet sich nach der Vereinsgroesse. Die Geduld sinkt, wenn du
// hinter der Erwartung liegst, und steigt, wenn du sie uebertriffst.
const BOARD_CHECKPOINTS = [12, 23, 34];
const BOARD_START_PATIENCE = 75;
const BOARD_MAX_PATIENCE = 100;
const BOARD_PATIENCE_PER_RANK = 3;
const BOARD_MAX_SWING = 25;
const BOARD_WARN_THRESHOLD = 30;
const BOARD_CUP_ROUND_CREDIT = 5;
const BOARD_EUROPE_ROUND_CREDIT = 7;

const BOARD_GOALS_DIV1 = [
  { minStrength: 88, label: "Deutscher Meister",                target: 1 },
  { minStrength: 80, label: "Qualifikation für den Europapokal", target: 4 },
  { minStrength: 72, label: "Einstelliger Tabellenplatz",        target: 9 },
  { minStrength: 64, label: "Gesicherter Mittelfeldplatz",       target: 13 },
  { minStrength: 0,  label: "Klassenerhalt",                     target: 15 }
];
const BOARD_GOALS_DIV2 = [
  { minStrength: 62, label: "Direkter Aufstieg",        target: 2 },
  { minStrength: 55, label: "Aufstiegsrelegation",      target: 3 },
  { minStrength: 48, label: "Vorderes Tabellendrittel", target: 6 },
  { minStrength: 0,  label: "Klassenerhalt",            target: 15 }
];

// ============================================
// Attribute
// ============================================
// Jeder Spieler hat vier Werte statt einer Zahl. Die bisherige "strength"
// bleibt als ABGELEITETER Gesamtwert erhalten: sie ist der positionsgewichtete
// Schnitt der Attribute. Dadurch funktionieren Marktwert, Gehalt, Entwicklung
// und Teambewertung unveraendert weiter.
const ATTRIBUTES = ["def", "pas", "sho", "pac"];
const ATTRIBUTE_LABELS = { def: "Abwehr", pas: "Aufbau", sho: "Abschluss", pac: "Tempo" };
const ATTRIBUTE_ICONS  = { def: "🛡", pas: "🎯", sho: "⚽", pac: "⚡" };

// Was eine Position von einem Spieler VERLANGT (Summe je Position = 1).
const POSITION_WEIGHTS = {
  TW: { def:0.65, pas:0.25, sho:0.00, pac:0.10 },
  IV: { def:0.55, pas:0.20, sho:0.03, pac:0.22 },
  LV: { def:0.38, pas:0.22, sho:0.05, pac:0.35 },
  RV: { def:0.38, pas:0.22, sho:0.05, pac:0.35 },
  DM: { def:0.40, pas:0.38, sho:0.05, pac:0.17 },
  ZM: { def:0.20, pas:0.48, sho:0.14, pac:0.18 },
  LM: { def:0.12, pas:0.30, sho:0.18, pac:0.40 },
  RM: { def:0.12, pas:0.30, sho:0.18, pac:0.40 },
  OM: { def:0.07, pas:0.40, sho:0.30, pac:0.23 },
  ST: { def:0.04, pas:0.16, sho:0.53, pac:0.27 }
};

// Wie ein Spieler dieser Position typischerweise AUSSIEHT (relativ zum
// Gesamtwert). Ein Stuermer hat viel Abschluss und wenig Abwehr.
const POSITION_SHAPES = {
  TW: { def:1.12, pas:0.82, sho:0.35, pac:0.72 },
  IV: { def:1.15, pas:0.92, sho:0.55, pac:0.86 },
  LV: { def:1.05, pas:0.92, sho:0.55, pac:1.12 },
  RV: { def:1.05, pas:0.92, sho:0.55, pac:1.12 },
  DM: { def:1.08, pas:1.06, sho:0.62, pac:0.86 },
  ZM: { def:0.88, pas:1.15, sho:0.82, pac:0.94 },
  LM: { def:0.82, pas:1.04, sho:0.88, pac:1.12 },
  RM: { def:0.82, pas:1.04, sho:0.88, pac:1.12 },
  OM: { def:0.64, pas:1.14, sho:1.02, pac:1.00 },
  ST: { def:0.55, pas:0.86, sho:1.18, pac:1.04 }
};

const ATTRIBUTE_SPREAD = 4;      // Streuung je Attribut bei der Erzeugung
const ATTRIBUTE_MIN = 20;
const ATTRIBUTE_MAX = 99;

// Eine Umstellung kostet aus zwei Gruenden: fachlich (die Attribute passen
// nicht zur Rolle) und durch Eingewoehnung (die Rolle ist ungewohnt). Beide
// Teile werden gedaempft, damit die Summe bei den bewaehrten Werten landet:
// LM->RM bleibt billig, IV->ST bleibt teuer.
const ATTRIBUTE_LOSS_FACTOR = 0.55;
const FAMILIARITY_FACTOR = 0.45;

// --- Live-Simulation ---
const MATCH_MINUTES = 90;
const LIVE_TICK_MS = 55;              // Zeit je Spielminute
const LIVE_EVENT_PAUSE_MS = 950;      // Pause bei einem Ereignis
// Tore fallen im echten Fussball haeufiger in der zweiten Halbzeit.
const GOAL_MINUTE_SECOND_HALF_BIAS = 0.58;

// ============================================
// Weltpool
// ============================================
// Alle Vereine haben einen Spielerstamm. Wichtig: die Vereinsstaerke bleibt
// weiterhin der massgebliche Wert fuer die Simulation — der Pool ersetzt sie
// NICHT. Sonst wuerde die ueber viele Durchgaenge austarierte Balance kippen.
const POOL_PLAYERS_PER_CLUB = 18;
const POOL_FOREIGN_CLUB_COUNT = 14;     // zusaetzliche Vereine aus dem Ausland
const POOL_FREE_AGENT_COUNT = 40;
// genPlayer streut intern bereits um +-10. Ein grosser Zusatzwert hier wuerde
// das verdoppeln und einem Mittelklasseverein Weltklassespieler bescheren.
const POOL_STRENGTH_SPREAD = 3;
const POOL_MAX_ABOVE_CLUB = 8;           // Deckel ueber der Vereinsstaerke

// Vertragsende im Bestand: die meisten Spieler verlaengern oder wechseln,
// nur wenige werden wirklich vereinslos.
const POOL_RENEW_CHANCE = 0.72;
const POOL_TRANSFER_CHANCE = 0.16;

// --- Alterspyramide ---
// Damit dauerhaft Talente nachkommen, wird pro Saison ein fester Jahrgang
// aufgenommen. Reichen die natuerlichen Abgaenge dafuer nicht, treten
// zusaetzlich die aeltesten Spieler ab. Ohne das altert der Bestand: die
// jungen Jahrgaenge wandern nach oben und werden nicht ersetzt.
// Der Zustrom wird aus der Bestandsgroesse abgeleitet statt fest gesetzt:
// bei einer Karriere von rund 19 Jahren (Eintritt mit 17, Abgang im Schnitt
// mit 36) braucht ein Bestand von N Spielern etwa N/19 Zugaenge pro Saison.
// Dadurch bleibt die Alterspyramide auch stabil, wenn eine Liga dazukommt.
const POOL_AVERAGE_CAREER_YEARS = 19.3;
const POOL_INTAKE_AGE_MIN = 16;
const POOL_INTAKE_AGE_MAX = 18;
const POOL_MAX_SIZE_DRIFT = 40;          // erlaubte Schwankung der Bestandsgroesse

// Nur ein Teil des Pools ist pro Saison zu haben. Das ersetzt die alte
// Begrenzung auf eine Marktaktualisierung pro Spieltag: das Angebot ist
// endlich, also darf frei gesucht und gefiltert werden.
const TRANSFER_LIST_SHARE = 0.30;
const TRANSFER_LIST_MIN = 60;
// Mindestanteil junger Spieler auf der Liste. Ohne diese Vorgabe bestand das
// Angebot fast nur aus Routiniers mit auslaufendem Vertrag.
const TRANSFER_LIST_YOUNG_SHARE = 0.28;
const TRANSFER_LIST_YOUNG_MAX_AGE = 22;

// Aufschlag auf den Marktwert: ein Verein gibt seinen Spieler nicht zum
// Buchwert her. Vertragsende senkt den Aufschlag deutlich.

// Aufschlag auf den Marktwert: ein Verein gibt seinen Spieler nicht zum
// Buchwert her. Vertragsende senkt den Aufschlag deutlich.
const TRANSFER_FEE_PREMIUM = 0.35;
const TRANSFER_FEE_EXPIRING_PREMIUM = 0.05;
const FREE_AGENT_SIGNING_FEE = 0.10;     // Handgeld statt Abloese

// Entwicklung des Pools zwischen den Saisons
const POOL_DEV_YOUNG_GAIN = 2.2;
const POOL_DEV_DECLINE = 1.6;
// Nachwuchs kommt bewusst UNTER Vereinsniveau herein. Startete er auf
// Vereinsniveau und waechst dann darueber hinaus, steigt der Bestandsschnitt
// von Saison zu Saison an.
const POOL_INTAKE_BELOW_CLUB = 4;

// ============================================
// Jugendmannschaft
// ============================================
// Laeuft parallel zur ersten Mannschaft. Junge Spieler, die es nicht in die
// Startelf schaffen, bekommen hier Einsatzzeit — sonst entwickeln sie sich
// nie und der ganze Nachwuchs waere wertlos.
const YOUTH_TEAM_MAX_AGE = 21;
const YOUTH_TEAM_SIZE = 11;
const YOUTH_TEAM_MIN_PLAYERS = 6;
// Zwischen Bank (1.0) und Startelf (1.7): Jugendspiele entwickeln, aber
// weniger als Einsaetze bei den Profis.
const YOUTH_DEV_MULTIPLIER = 1.45;
const YOUTH_OPPONENT_OFFSET = 20;     // Gegner sind deutlich schwaecher
const YOUTH_OPPONENT_SPREAD = 7;
const YOUTH_PROMOTION_GAP = 3;        // ab hier lohnt der Sprung in den Profikader

// ============================================
// Moral
// ============================================
// Verbindet Einsatzzeit, Erfolg und Vertragslage. Der Wert liegt zwischen
// 0 und 100; MORALE_NEUTRAL ist der Ruhepunkt, an dem die Moral weder hilft
// noch schadet. Dadurch bleibt die austarierte Balance im Mittel erhalten.
const MORALE_START = 70;
const MORALE_NEUTRAL = 70;
const MORALE_MIN = 0;
const MORALE_MAX = 100;

// Veraenderung je Spieltag nach Einsatzrolle. Die Werte sind so gewaehlt,
// dass sich ein Stammspieler bei rund 75 einpendelt — nur knapp ueber dem
// Ruhepunkt. Sonst bekaeme die ganze Startelf einen dauerhaften Bonus und
// die austarierte Balance wuerde sich verschieben.
// Gleichgewicht = MORALE_NEUTRAL + Rollenwert / MORALE_REVERSION
const MORALE_XI = 0.6;               // pendelt sich bei ~75 ein
const MORALE_YOUTH_YOUNG = 0.4;      // fuer Talente ist die Jugend ein Angebot
const MORALE_YOUTH_OLD = -2.5;       // ein Routinier gehoert nicht dorthin
const MORALE_BENCH = -0.8;           // ~63
const MORALE_RESERVE = -4.5;         // ~33, also unter der Unzufriedenheitsgrenze
const MORALE_INJURED = -0.3;

// Ergebnis der ersten Mannschaft faerbt auf den ganzen Kader ab
const MORALE_RESULT = { win: 0.8, draw: 0.1, loss: -0.9 };

// Vertragslage
const MORALE_EXPIRING_CONTRACT = -0.4;
const MORALE_RENEWAL_BOOST = 12;

// Rueckkehr zum Ruhepunkt, damit Ausschlaege nicht ewig nachwirken
const MORALE_REVERSION = 0.12;

// Wirkung auf die Spielstaerke: nach oben begrenzt, nach unten haerter —
// ein unzufriedener Spieler schadet mehr, als ein zufriedener nuetzt.
const MORALE_BONUS_MAX = 2.0;
const MORALE_MALUS_MAX = 4.0;

// Wirkung auf die Entwicklung
const MORALE_DEV_MIN = 0.70;
const MORALE_DEV_MAX = 1.25;

// Ab hier will ein Spieler wechseln
const MORALE_UNHAPPY_THRESHOLD = 35;
const MORALE_CRITICAL_THRESHOLD = 20;

// --- Belohnung fuer Uebererfuellung ---
// Der Vorstand konnte bisher nur strafen. Wer sein Ziel deutlich uebertrifft,
// bekommt jetzt zusaetzliches Transferbudget — skaliert mit dem Standing,
// damit die Summe zur Vereinsgroesse passt.
const BOARD_REWARD_MIN_RANKS = 3;        // ab drei Plaetzen ueber dem Ziel
const BOARD_REWARD_PER_RANK = 350000;
const BOARD_REWARD_MAX = 8000000;

// --- Vereinswechsel nach Entlassung ---
const JOB_OFFER_COUNT = 3;
const JOB_OFFER_MAX_STRENGTH_DROP = 22;  // Angebote liegen unter dem letzten Verein
const JOB_OFFER_MIN_STRENGTH_DROP = 4;

// ============================================
// Trainingsfokus
// ============================================
// Eine Entscheidung, die zwischen den Spieltagen getroffen wird. Jeder Fokus
// hat einen Preis: Wer eine Seite verstaerkt, vernachlaessigt eine andere.
//
// attr: Faktoren auf die Entwicklung der einzelnen Attribute.
// Weil der Gesamtwert der positionsgewichtete Schnitt ist, hilft ein Fokus
// vor allem den Spielern, deren Position dieses Attribut braucht.
const TRAINING_FOCUS = {
  balanced: {
    label: "Ausgeglichen",
    desc: "Kein Schwerpunkt. Alles entwickelt sich gleichmäßig.",
    attr: { def:1.0, pas:1.0, sho:1.0, pac:1.0 },
    injury: 1.0, fatigue: 1.0, morale: 0
  },
  offense: {
    label: "Offensive",
    desc: "Abschluss und Aufbau wachsen schneller, die Abwehrarbeit leidet.",
    attr: { def:0.65, pas:1.35, sho:1.45, pac:1.0 },
    injury: 1.0, fatigue: 1.0, morale: 0.1
  },
  defense: {
    label: "Defensive",
    desc: "Abwehrarbeit wächst schneller, dafür fehlt es vorne an Schliff.",
    attr: { def:1.50, pas:1.0, sho:0.60, pac:0.95 },
    injury: 0.9, fatigue: 1.0, morale: -0.1
  },
  athletics: {
    label: "Athletik",
    desc: "Tempo wächst deutlich, aber die Verletzungsgefahr steigt spürbar.",
    attr: { def:0.88, pas:0.75, sho:0.88, pac:1.60 },
    injury: 1.45, fatigue: 0.85, morale: -0.2
  },
  regeneration: {
    label: "Regeneration",
    desc: "Schont die Beine und hebt die Stimmung, kostet aber Entwicklung.",
    attr: { def:0.55, pas:0.55, sho:0.55, pac:0.55 },
    injury: 0.55, fatigue: 0.45, morale: 0.9
  }
};
const DEFAULT_TRAINING = "balanced";

// ============================================
// Taktische Konter
// ============================================
// Ausrichtungen wirken gegeneinander. Eine tief stehende Mannschaft faengt
// einen offensiven Gegner ab, zwei offensive liefern sich ein offenes Spiel,
// zwei defensive neutralisieren sich.
//
// Die Werte verschieben die Torerwartung beider Seiten. Ueber alle neun
// Paarungen gemittelt heben sie sich nahezu auf.
const TACTIC_COUNTER = {
  offensive: {
    offensive: { own: 0.15, opp: 0.15 },   // offenes Spiel
    balanced:  { own: 0.05, opp: 0.00 },
    defensive: { own: -0.15, opp: 0.10 }   // wird abgefangen
  },
  balanced: {
    offensive: { own: 0.00, opp: 0.05 },
    balanced:  { own: 0.00, opp: 0.00 },
    defensive: { own: -0.05, opp: 0.00 }
  },
  defensive: {
    offensive: { own: 0.10, opp: -0.15 },  // Konter greift
    balanced:  { own: 0.00, opp: -0.05 },
    defensive: { own: -0.15, opp: -0.15 }  // beide neutralisiert
  }
};

// Wie sich ein KI-Verein ausrichtet: klarer Aussenseiter stellt sich tief,
// klarer Favorit spielt nach vorn.
const AI_TACTIC_UNDERDOG_GAP = 6;
const AI_TACTIC_FAVOURITE_GAP = 6;

// ============================================
// Eigener Jugendkader
// ============================================
// Die Jugend ist ein eigener Bereich neben dem Profikader. Sie zaehlt nicht
// zur Kadergroesse und nicht zur Teambewertung, kostet aber Gehalt. Dadurch
// haengt der Nachwuchs nicht mehr davon ab, ob im Profikader Platz ist.
const YOUTH_SQUAD_MAX_SIZE = 16;
const YOUTH_SQUAD_MAX_AGE = 21;          // danach: hochziehen oder verlieren
const YOUTH_INTAKE_CANDIDATES = 7;       // Vorschlaege am Saisonende
const YOUTH_INTAKE_MAX_PICK = 4;         // davon aufnehmbar
const YOUTH_CANDIDATE_AGE_MIN = 16;
const YOUTH_CANDIDATE_AGE_MAX = 18;
// Jugendspieler kosten weniger als ein Profi gleichen Alters.
const YOUTH_SALARY_FACTOR = 0.45;
// Auffangnetz: faellt der Profikader unter diesen Wert, wird am Saisonende
// nachbesetzt — erst aus der Jugend, dann mit vereinslosen Spielern.
// Ohne das koennte der Kader ausbluten, seit der Nachwuchs nicht mehr
// automatisch in die erste Mannschaft rutscht.
const SQUAD_REFILL_THRESHOLD = 20;

// ============================================
// Investitionen in den Verein
// ============================================
// Fuenf Bereiche mit je fuenf Stufen. Die Kosten steigen deutlich an, damit
// der Ausbau ueber mehrere Saisons laeuft und mit Transfers um dasselbe
// Budget konkurriert. Die Wirkung ist je Stufe angegeben.
const FACILITY_LEVELS = 5;
const FACILITY_COSTS = [2000000, 3500000, 5500000, 8000000, 11500000];

const FACILITIES = {
  stadium: {
    label: "Stadion",
    icon: "🏟",
    desc: "Mehr Plätze und bessere Vermarktung erhöhen die Einnahmen.",
    wirkung: stufe => `Kommerzeinnahmen +${stufe * 6}%`,
    perLevel: 0.06
  },
  coaching: {
    label: "Trainerstab",
    icon: "📋",
    desc: "Bessere Trainer entwickeln den Kader schneller.",
    wirkung: stufe => `Entwicklung +${stufe * 5}%`,
    perLevel: 0.05
  },
  youth: {
    label: "Jugendarbeit",
    icon: "🌱",
    desc: "Die Jugendabteilung findet stärkere Talente mit mehr Potenzial.",
    wirkung: stufe => `Talente +${stufe * 2} Bewertung, +${stufe * 3} Potenzial`,
    perLevel: 1
  },
  medical: {
    label: "Medizin",
    icon: "🩺",
    desc: "Weniger Verletzungen und kürzere Ausfallzeiten.",
    wirkung: stufe => `Verletzungsrisiko −${stufe * 8}%`,
    perLevel: 0.08
  },
  scouting: {
    label: "Scouting",
    icon: "🔍",
    desc: "Das Netzwerk findet häufiger unentdeckte Talente und mehr Angebote.",
    wirkung: stufe => `Scouting-Funde +${stufe * 25}%, mehr Spieler am Markt`,
    perLevel: 0.25
  }
};

// ============================================
// Ligen
// ============================================
// Die 3. Liga wechselt jaehrlich stark in ihrer Zusammensetzung. Die Namen
// sind typische Vertreter, die Staerken sind Schaetzungen — beides laesst
// sich hier jederzeit anpassen.
const THIRD_DIVISION_CLUBS = [
  {name:"TSV 1860 München", strength:51},
  {name:"Dynamo Dresden", strength:50},
  {name:"Rot-Weiss Essen", strength:49},
  {name:"1. FC Saarbrücken", strength:49},
  {name:"Energie Cottbus", strength:48},
  {name:"SV Waldhof Mannheim", strength:48},
  {name:"VfL Osnabrück", strength:47},
  {name:"Arminia Bielefeld", strength:47},
  {name:"FC Erzgebirge Aue", strength:46},
  {name:"SpVgg Unterhaching", strength:45},
  {name:"VfB Stuttgart II", strength:45},
  {name:"Hallescher FC", strength:44},
  {name:"SC Verl", strength:44},
  {name:"FC Viktoria Köln", strength:43},
  {name:"SV Sandhausen", strength:43},
  {name:"Alemannia Aachen", strength:42},
  {name:"TSV Havelse", strength:41},
  {name:"FC Ingolstadt 04", strength:41}
];

// Ziele fuer die dritte Liga
const BOARD_GOALS_DIV3 = [
  { minStrength: 48, label: "Direkter Aufstieg",        target: 2 },
  { minStrength: 44, label: "Aufstiegsrelegation",      target: 3 },
  { minStrength: 40, label: "Vorderes Tabellendrittel", target: 6 },
  { minStrength: 0,  label: "Klassenerhalt",            target: 16 }
];

// Eine Stelle, an der alles Ligaabhaengige zusammenlaeuft. Eine weitere Liga
// ergaenzt man hier, nicht verstreut im Code.
const DIVISIONS = [
  { nr: 1, label: "1. Bundesliga", short: "1. BL",
    clubs: CLUBS, revenueFactor: 1.0, staturePenalty: 0,
    goals: BOARD_GOALS_DIV1, europe: true },
  { nr: 2, label: "2. Bundesliga", short: "2. BL",
    clubs: SECOND_DIVISION_CLUBS, revenueFactor: 0.5, staturePenalty: 8,
    goals: BOARD_GOALS_DIV2, europe: false },
  { nr: 3, label: "3. Liga", short: "3. L",
    clubs: THIRD_DIVISION_CLUBS, revenueFactor: 0.22, staturePenalty: 16,
    goals: BOARD_GOALS_DIV3, europe: false }
];
