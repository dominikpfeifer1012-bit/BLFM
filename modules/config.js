// ============================================
// CONFIG.JS - Zentrale Konstanten und Einstellungen
// ============================================

// Bundesliga 2026/27. Staerken nach Abschlusstabelle 2025/26, Kaderwert und Groesse.
const CLUBS = [
  {name:"FC Bayern München", strength:92},
  {name:"Borussia Dortmund", strength:85},
  {name:"Bayer Leverkusen", strength:84},
  {name:"RB Leipzig", strength:84},
  {name:"VfB Stuttgart", strength:80},
  {name:"TSG Hoffenheim", strength:78},
  {name:"Eintracht Frankfurt", strength:77},
  {name:"SC Freiburg", strength:75},
  {name:"Borussia Mönchengladbach", strength:72},
  {name:"1. FC Union Berlin", strength:71},
  {name:"1. FSV Mainz 05", strength:71},
  {name:"FC Augsburg", strength:70},
  {name:"Werder Bremen", strength:70},
  {name:"Hamburger SV", strength:69},
  {name:"FC Schalke 04", strength:68},
  {name:"1. FC Köln", strength:68},
  {name:"SC Paderborn 07", strength:64},
  {name:"SV Elversberg", strength:64}
];

// 2. Bundesliga 2026/27 (Absteiger Wolfsburg, St. Pauli, Heidenheim; Aufsteiger Osnabrueck, Cottbus).
const SECOND_DIVISION_CLUBS = [
  {name:"VfL Wolfsburg", strength:67},
  {name:"Hannover 96", strength:64},
  {name:"FC St. Pauli", strength:63},
  {name:"1. FC Heidenheim", strength:62},
  {name:"SV Darmstadt 98", strength:61},
  {name:"1. FC Kaiserslautern", strength:61},
  {name:"Hertha BSC", strength:61},
  {name:"VfL Bochum", strength:60},
  {name:"1. FC Nürnberg", strength:59},
  {name:"Karlsruher SC", strength:58},
  {name:"Holstein Kiel", strength:58},
  {name:"Dynamo Dresden", strength:57},
  {name:"Arminia Bielefeld", strength:57},
  {name:"1. FC Magdeburg", strength:57},
  {name:"VfL Osnabrück", strength:56},
  {name:"Energie Cottbus", strength:55},
  {name:"Eintracht Braunschweig", strength:55},
  {name:"SpVgg Greuther Fürth", strength:54}
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

// Wer trifft: Stuermer erzielen wie in der Bundesliga gut ein Drittel der
// Mannschaftstore. Vorher waren die Tore so breit verteilt, dass der
// Torschuetzenkoenig nur 14 bis 18 Tore schaffte.
const SCORER_WEIGHTS = { TW:0, RV:1, IV:1, LV:1, DM:1, ZM:3, LM:4, RM:4, OM:7, ST:16 };

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
  offensive: { label:"Offensiv",      own:+0.25, opp:+0.22 },
  balanced:  { label:"Ausgeglichen",  own:0,     opp:0 },
  defensive: { label:"Defensiv",      own:-0.22, opp:-0.25 }
};
const DEFAULT_TACTIC = "balanced";

// --- Vertraege ---
const CONTRACT_MIN_YEARS = 2;
const CONTRACT_MAX_YEARS = 5;
const CONTRACT_YOUTH_YEARS = 3;
const CONTRACT_RENEWAL_YEARS = 3;
const CONTRACT_RENEWAL_FEE_FACTOR = 0.12;   // Anteil des Marktwerts als Handgeld
const CONTRACT_REMINDER_MATCHDAYS = [26, 32];
const CONTRACT_RAISE_BASE = 0.05;    // Grundaufschlag beim Verlaengern
const CONTRACT_RAISE_MAX = 0.6;   // Erinnerung an auslaufende Vertraege

// --- Belastung durch Pokalspiele ---
const CUP_INJURY_FACTOR = 0.8;   // etwas geringer als im Ligaspiel

const YELLOW_CARD_CHANCE_STARTER = 0.12;
const RED_CARD_CHANCE = 0.0045;   // je Spieler und Spiel: rund jedes 20. Spiel ein Platzverweis pro Team
// Wirkung eines Platzverweises ab seiner Minute: eigene Tore seltener,
// Gegentore haeufiger. Eine Verletzung (Auswechslung) kostet etwas Angriff.
const RED_CARD_ATTACK_FACTOR = 0.68;
const RED_CARD_CONCEDE_FACTOR = 1.3;
const INJURY_MATCH_FACTOR = 0.95;

// Formkurve: Schnitt der letzten Spiele gegenueber ~1,4 Punkten.
const FORM_WINDOW = 5;
const FORM_NEUTRAL_POINTS = 1.4;
const FORM_FACTOR = 1.2;           // Staerkepunkte je Punkt ueber/unter Schnitt
const FORM_MAX_BONUS = 2;

// K.o.-Spiele: Verlaengerung (30 Min., muede Beine) und Elfmeterschiessen.
const EXTRA_TIME_SHARE = 0.28;
const PENALTY_CONVERSION = 0.76;
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

// ============================================
// UEFA-Wettbewerbe (Format seit 2024/25)
// ============================================
// Champions League, Europa League und Conference League mit je 36 Teams in
// einer Ligaphase. CL und EL: 8 Gegner aus 4 Toepfen, Conference League:
// 6 Gegner aus 6 Toepfen. Platz 1-8 direkt ins Achtelfinale, 9-24 spielen
// K.o.-Play-offs, ab 25 ist Schluss. K.o.-Runden mit Hin- und Rueckspiel,
// das Finale auf neutralem Platz.
const UEFA_COMPS = {
  cl:  { key: "cl",  name: "Champions League",  short: "CL",  icon: "⭐", rounds: 8, pots: 4,
         prize: { start: 2500000, win: 300000, draw: 100000, stages: [300000, 700000, 1000000, 1500000, 2000000], champion: 6000000 },
         coeffBonus: 4, reputation: { stage: 1.5, title: 8 } },
  el:  { key: "el",  name: "Europa League",     short: "EL",  icon: "🟠", rounds: 8, pots: 4,
         prize: { start: 800000, win: 120000, draw: 40000, stages: [150000, 300000, 450000, 700000, 1000000], champion: 2500000 },
         coeffBonus: 1, reputation: { stage: 1, title: 5 } },
  ecl: { key: "ecl", name: "Conference League", short: "ECL", icon: "🟢", rounds: 6, pots: 6,
         prize: { start: 500000, win: 80000, draw: 30000, stages: [100000, 200000, 300000, 450000, 700000], champion: 1500000 },
         coeffBonus: 0, reputation: { stage: 0.7, title: 3 } }
};
const UEFA_COMP_ORDER = ["cl", "el", "ecl"];
const UEFA_FIELD_SIZE = 36;
const UEFA_DIRECT_R16 = 8;        // Platz 1-8 direkt ins Achtelfinale
const UEFA_PLAYOFF_UNTIL = 24;    // Platz 9-24 in die K.o.-Play-offs
const UEFA_KO_STAGES = ["K.o.-Play-offs", "Achtelfinale", "Viertelfinale", "Halbfinale", "Finale"];
// Termine (fuer 34 Spieltage geplant, werden gestreckt): 8 Ligaphasen-
// Spieltage, dann je zwei Termine fuer Play-offs, Achtel-, Viertel- und
// Halbfinale, zuletzt das Finale.
const UEFA_DATES = [2, 4, 6, 9, 11, 13, 15, 17, 19, 20, 23, 24, 26, 27, 28, 29, 33];
const UEFA_LEAGUE_DATES = 8;

// Startplaetze der fuenf Ligen: CL nach Tabelle (Frankreich drei), dazu
// ein Platz fuer die zwei besten Laender der Vorjahreswertung. EL: naechster
// Tabellenplatz plus Pokalsieger. Conference League: der Platz danach.
const UEFA_CL_SLOTS = { de: 4, en: 4, es: 4, it: 4, fr: 3 };
const UEFA_EXTRA_CL_COUNTRIES = 2;

// Koeffizienten: Sieg 2, Remis 1, je erreichter K.o.-Runde ab dem
// Achtelfinale 1 Punkt, dazu ein Teilnahmebonus je Wettbewerb.
const UEFA_COEFF_WIN = 2;
const UEFA_COEFF_DRAW = 1;
const UEFA_COEFF_YEARS = 5;
// Fuenfjahreswertung zum Start (je Saison, aelteste zuerst), grob an der
// echten UEFA-Wertung orientiert.
const UEFA_COUNTRY_SEED = {
  en: [21.6, 23.0, 23.0, 21.4, 22.6], it: [16.2, 21.4, 19.4, 21.0, 19.8], es: [18.9, 19.9, 16.6, 18.8, 19.5],
  de: [18.7, 17.3, 19.4, 17.6, 16.4], fr: [16.6, 13.8, 13.1, 16.1, 14.2], PT: [11.6, 14.0, 13.6, 12.0, 13.9],
  NL: [9.9, 15.8, 12.8, 13.0, 12.3], BE: [9.6, 11.6, 11.4, 12.2, 11.3], TR: [6.0, 8.6, 12.0, 9.0, 11.4],
  CZ: [9.4, 9.5, 9.7, 13.1, 8.1], GR: [6.2, 9.3, 5.6, 14.6, 9.0], CH: [5.1, 9.2, 9.6, 6.5, 9.1],
  AT: [8.2, 8.8, 5.3, 8.4, 9.5], NO: [6.0, 9.0, 7.8, 8.2, 11.0], DK: [9.6, 5.8, 9.4, 8.0, 7.2],
  SCO: [9.5, 7.7, 5.3, 9.6, 8.1], PL: [5.9, 2.8, 12.9, 6.0, 9.5], HR: [7.4, 7.1, 5.6, 7.0, 6.5],
  SE: [3.8, 5.5, 6.0, 5.0, 6.3], RS: [5.5, 5.5, 5.5, 5.4, 4.8], CY: [5.0, 6.1, 5.8, 5.6, 8.0],
  IL: [5.8, 5.4, 6.1, 4.6, 5.3], UA: [4.6, 5.8, 5.0, 4.3, 5.1], HU: [4.0, 4.8, 6.0, 4.4, 5.6],
  RO: [3.3, 4.6, 3.8, 5.4, 7.5], SI: [2.8, 4.8, 5.3, 6.0, 5.3], BG: [3.4, 4.3, 3.6, 4.8, 5.1],
  SK: [3.5, 4.0, 4.4, 4.6, 4.0], AZ: [2.8, 3.3, 5.1, 5.0, 6.0], KZ: [3.1, 3.4, 3.7, 4.4, 4.0],
  MD: [3.2, 4.5, 3.0, 2.0, 3.1], IE: [1.6, 2.6, 2.2, 3.5, 4.2], BA: [1.6, 2.0, 2.4, 2.8, 3.3],
  FI: [2.8, 2.6, 2.3, 2.0, 2.4], IS: [1.0, 2.0, 1.7, 2.2, 2.3], XK: [1.0, 1.3, 1.5, 2.2, 2.1],
  NIR: [1.0, 1.5, 1.6, 1.4, 1.5], WAL: [1.0, 1.0, 1.4, 1.2, 1.4]
};
const UEFA_COUNTRY_NAMES = {
  PT: "Portugal", NL: "Niederlande", BE: "Belgien", TR: "Türkei", CZ: "Tschechien", GR: "Griechenland",
  CH: "Schweiz", AT: "Österreich", NO: "Norwegen", DK: "Dänemark", SCO: "Schottland", PL: "Polen",
  HR: "Kroatien", SE: "Schweden", RS: "Serbien", CY: "Zypern", IL: "Israel", UA: "Ukraine",
  HU: "Ungarn", RO: "Rumänien", SI: "Slowenien", BG: "Bulgarien", SK: "Slowakei", AZ: "Aserbaidschan",
  KZ: "Kasachstan", MD: "Moldau", IE: "Irland", BA: "Bosnien-Herzegowina", FI: "Finnland", IS: "Island",
  XK: "Kosovo", NIR: "Nordirland", WAL: "Wales"
};

// Nationale Supercups (Meister gegen Pokalsieger) und der UEFA Supercup
// (CL- gegen EL-Sieger) eroeffnen die Saison.
const SUPERCUP_NAMES = { de: "DFL-Supercup", en: "Community Shield", es: "Supercopa de España",
  it: "Supercoppa Italiana", fr: "Trophée des Champions" };
const SUPERCUP_PRIZE = 500000;
const UEFA_SUPERCUP_PRIZE = 1000000;

// Vorstand: Europapokal-Ziel nach Rang im Teilnehmerfeld.
const BOARD_EUROPE_GOAL_BONUS = 8;
const BOARD_EUROPE_GOAL_MISS = 8;

// Rotation: wer so oft in Folge begonnen hat, wird geschont, wenn ein
// Ersatz hoechstens ROTATION_MAX_GAP Punkte schwaecher ist.
const ROTATION_START_LIMIT = 3;
const ROTATION_MAX_GAP = 4;

// Europapokal-Teilnehmer aus Laendern ohne eigene Liga im Spiel. Die
// Vereine der fuenf grossen Ligen kommen ueber ihre Tabellen hinein; diese
// fuellen die drei Wettbewerbe nach Staerke auf.
const EURO_CLUBS = [
  {name:"Benfica Lissabon", strength:81, country:"PT"},
  {name:"Sporting Lissabon", strength:81, country:"PT"},
  {name:"FC Porto", strength:80, country:"PT"},
  {name:"PSV Eindhoven", strength:79, country:"NL"},
  {name:"Ajax Amsterdam", strength:77, country:"NL"},
  {name:"Feyenoord Rotterdam", strength:77, country:"NL"},
  {name:"Club Brügge", strength:76, country:"BE"},
  {name:"Galatasaray Istanbul", strength:76, country:"TR"},
  {name:"Fenerbahçe Istanbul", strength:75, country:"TR"},
  {name:"SC Braga", strength:74, country:"PT"},
  {name:"RB Salzburg", strength:74, country:"AT"},
  {name:"Celtic Glasgow", strength:74, country:"SCO"},
  {name:"AZ Alkmaar", strength:73, country:"NL"},
  {name:"Union Saint-Gilloise", strength:73, country:"BE"},
  {name:"Beşiktaş Istanbul", strength:73, country:"TR"},
  {name:"Olympiakos Piräus", strength:73, country:"GR"},
  {name:"Bodø/Glimt", strength:72, country:"NO"},
  {name:"Glasgow Rangers", strength:72, country:"SCO"},
  {name:"Schachtar Donezk", strength:72, country:"UA"},
  {name:"Slavia Prag", strength:72, country:"CZ"},
  {name:"Roter Stern Belgrad", strength:72, country:"RS"},
  {name:"BSC Young Boys", strength:71, country:"CH"},
  {name:"PAOK Thessaloniki", strength:71, country:"GR"},
  {name:"Dinamo Zagreb", strength:71, country:"HR"},
  {name:"FC Kopenhagen", strength:71, country:"DK"},
  {name:"FC Midtjylland", strength:70, country:"DK"},
  {name:"Sparta Prag", strength:70, country:"CZ"},
  {name:"RSC Anderlecht", strength:70, country:"BE"},
  {name:"KRC Genk", strength:70, country:"BE"},
  {name:"SK Sturm Graz", strength:69, country:"AT"},
  {name:"Trabzonspor", strength:69, country:"TR"},
  {name:"FC Twente", strength:69, country:"NL"},
  {name:"Panathinaikos Athen", strength:69, country:"GR"},
  {name:"AEK Athen", strength:69, country:"GR"},
  {name:"Ferencváros Budapest", strength:69, country:"HU"},
  {name:"FC Basel", strength:69, country:"CH"},
  {name:"Viktoria Pilsen", strength:68, country:"CZ"},
  {name:"FC Utrecht", strength:68, country:"NL"},
  {name:"KAA Gent", strength:68, country:"BE"},
  {name:"Lech Posen", strength:67, country:"PL"},
  {name:"Legia Warschau", strength:67, country:"PL"},
  {name:"Partizan Belgrad", strength:67, country:"RS"},
  {name:"Malmö FF", strength:67, country:"SE"},
  {name:"Qarabağ Ağdam", strength:67, country:"AZ"},
  {name:"Vitória Guimarães", strength:66, country:"PT"},
  {name:"İstanbul Başakşehir", strength:66, country:"TR"},
  {name:"Maccabi Tel Aviv", strength:66, country:"IL"},
  {name:"Ludogorez Rasgrad", strength:66, country:"BG"},
  {name:"FCSB Bukarest", strength:66, country:"RO"},
  {name:"Rapid Wien", strength:66, country:"AT"},
  {name:"Dynamo Kiew", strength:66, country:"UA"},
  {name:"Hajduk Split", strength:65, country:"HR"},
  {name:"Molde FK", strength:65, country:"NO"},
  {name:"Raków Częstochowa", strength:65, country:"PL"},
  {name:"Jagiellonia Białystok", strength:65, country:"PL"},
  {name:"Brøndby IF", strength:65, country:"DK"},
  {name:"Servette Genf", strength:64, country:"CH"},
  {name:"FC Lugano", strength:64, country:"CH"},
  {name:"LASK Linz", strength:64, country:"AT"},
  {name:"Royal Antwerpen", strength:64, country:"BE"},
  {name:"Pafos FC", strength:63, country:"CY"},
  {name:"Heart of Midlothian", strength:63, country:"SCO"},
  {name:"FC Famalicão", strength:63, country:"PT"},
  {name:"Aberdeen FC", strength:62, country:"SCO"},
  {name:"NK Celje", strength:62, country:"SI"},
  {name:"APOEL Nikosia", strength:62, country:"CY"},
  {name:"CFR Cluj", strength:62, country:"RO"},
  {name:"Slovan Bratislava", strength:62, country:"SK"},
  {name:"Maccabi Haifa", strength:62, country:"IL"},
  {name:"Omonia Nikosia", strength:61, country:"CY"},
  {name:"BK Häcken", strength:61, country:"SE"},
  {name:"HNK Rijeka", strength:61, country:"HR"},
  {name:"Olimpija Ljubljana", strength:60, country:"SI"},
  {name:"FK Astana", strength:60, country:"KZ"},
  {name:"Shamrock Rovers", strength:59, country:"IE"},
  {name:"Sheriff Tiraspol", strength:59, country:"MD"},
  {name:"Zrinjski Mostar", strength:58, country:"BA"},
  {name:"HJK Helsinki", strength:58, country:"FI"},
  {name:"Breiðablik", strength:56, country:"IS"},
  {name:"FC Drita", strength:55, country:"XK"},
  {name:"Larne FC", strength:54, country:"NIR"},
  {name:"The New Saints", strength:54, country:"WAL"}
];

const ACHIEVEMENTS = [
  { key:"firstWin", label:"🏆 Erster Sieg", desc:"Ersten Pflichtsieg eingefahren" },
  { key:"winStreak5", label:"🔥 5 Siege in Folge", desc:"Fünf Spiele in Serie gewonnen" },
  { key:"champion", label:"👑 Meister", desc:"Eine Saison in einer ersten Liga auf Platz 1 beendet" },
  { key:"topFour", label:"⭐ Europapokal-Rang", desc:"Eine Saison in einer ersten Liga unter den Top 4 beendet" },
  { key:"bigSigning", label:"💎 Königstransfer", desc:"Einen Spieler für über 50% des verfügbaren Budgets verpflichtet" },
  { key:"cupWinner", label:"🏆 Pokalsieger", desc:"Den nationalen Pokal gewonnen" },
  { key:"europeChampion", label:"🌍 Europapokalsieger", desc:"Den Europapokal gewonnen" },
  { key:"promotion", label:"⬆️ Aufstieg", desc:"In eine höhere Liga aufgestiegen" },
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

// Eine gemeinsame Torformel fuer alle Spiele (eigene Liga, Schattenligen,
// Pokal, Europapokal, Jugend). Kalibriert auf echte Werte: rund 3 Tore pro
// Spiel, Heim/Remis/Auswaerts etwa 45/23/32, ein Favorit mit 12+ Punkten
// Vorsprung gewinnt rund drei Viertel seiner Spiele.
const MATCH_ENGINE = {
  baseGoals: 1.40,       // Torerwartung bei gleich starken Teams auf neutralem Platz
  homeAdvantage: 3,      // Heimvorteil in Staerkepunkten
  scale: 28,             // 28 Staerkepunkte Unterschied = Faktor e auf die Tore
  sharedGoals: 0.2,      // gemeinsamer Anteil beider Teams: etwas mehr Remis
  minLambda: 0.15
};

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
// Anteil des staerkeabhaengigen Potenzials, der je nach Alter noch offen ist.
const POTENTIAL_AGE_FACTORS = [
  { maxAge: 19, factor: 1.6 },
  { maxAge: 21, factor: 1.3 },
  { maxAge: 23, factor: 1.0 },
  { maxAge: 26, factor: 0.6 },
  { maxAge: 29, factor: 0.3 },
  { maxAge: 99, factor: 0.12 }
];

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
const BOARD_EUROPE_ROUND_CREDIT = 7;   // Vorstandsguthaben je gewonnener K.o.-Runde
// Konto im Minus: Geduldsverlust je Spieltag, Zwangsverkauf nach so vielen Spieltagen
const DEBT_PATIENCE_PER_MATCHDAY = 1;
const DEBT_FORCED_SALE_AFTER = 6;
const BOARD_GOAL_MET_BONUS = 2;          // Ziel genau erreicht: kleines Plus statt Stillstand

// Saisonziele haengen am Staerke-Rang innerhalb der eigenen Liga (maxRank:
// hoechstens so viele Vereine sind staerker, plus eins). Feste Staerkewerte
// passten nur zur Bundesliga: in Liga 2 und 3 sollten sonst 13 von 18
// Vereinen mindestens Dritter werden. minStrength dient nur als Rueckfall,
// falls keine Ligadaten vorliegen.
const BOARD_GOALS_DIV1 = [
  { maxRank: 1,  minStrength: 88, label: "Deutscher Meister",                target: 1 },
  { maxRank: 4,  minStrength: 80, label: "Qualifikation für den Europapokal", target: 4 },
  { maxRank: 8,  minStrength: 72, label: "Einstelliger Tabellenplatz",        target: 9 },
  { maxRank: 12, minStrength: 64, label: "Gesicherter Mittelfeldplatz",       target: 13 },
  { maxRank: 99, minStrength: 0,  label: "Klassenerhalt",                     target: 15 }
];
const BOARD_GOALS_DIV2 = [
  { maxRank: 2,  minStrength: 62, label: "Direkter Aufstieg",           target: 2 },
  { maxRank: 3,  minStrength: 55, label: "Aufstiegsrelegation",         target: 3 },
  { maxRank: 8,  minStrength: 48, label: "Vorderes Tabellendrittel",    target: 6 },
  { maxRank: 12, minStrength: 44, label: "Gesicherter Mittelfeldplatz", target: 12 },
  { maxRank: 99, minStrength: 0,  label: "Klassenerhalt",               target: 15 }
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
const HALFTIME_FIRST_SHARE = 0.44;      // Anteil der Torerwartung in Halbzeit 1 (spaete Tore sind haeufiger)
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
const POOL_PLAYERS_PER_CLUB_SMALL = 13;   // zweite Ligen im Ausland
const POOL_FOREIGN_CLUB_COUNT = 14;     // zusaetzliche Vereine aus dem Ausland
const POOL_FREE_AGENT_COUNT = 40;
// Vereinslose bleiben nicht lange ohne Verein: zum Jahreswechsel findet ein
// Teil einen neuen Club, die Besten zuerst. Ohne Spielpraxis bauen sie ab.
const POOL_FREE_AGENT_MAX = 60;
const POOL_FREE_AGENT_SIGN_CHANCE = 0.5;
const POOL_FREE_AGENT_DECLINE = 1.5;
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
const TRANSFER_LIST_SHARE = 0.15;
const TRANSFER_LIST_MIN = 60;
// Mindestanteil junger Spieler auf der Liste. Ohne diese Vorgabe bestand das
// Angebot fast nur aus Routiniers mit auslaufendem Vertrag.
const TRANSFER_LIST_YOUNG_SHARE = 0.28;
const TRANSFER_LIST_YOUNG_MAX_AGE = 22;

// Aufschlag auf den Marktwert: ein Verein gibt seinen Spieler nicht zum
// Buchwert her. Vertragsende senkt den Aufschlag deutlich.
const TRANSFER_FEE_PREMIUM = 0.35;
const TRANSFER_FEE_EXPIRING_PREMIUM = 0.05;
const FREE_AGENT_SIGNING_FEE = 0.25;     // Handgeld statt Abloese
const FREE_AGENT_SALARY_FACTOR = 1.2;    // Vereinslose verlangen mehr Gehalt
// Obergrenze fuer den Profikader (ohne Jugend und Leihen).
const MAX_SQUAD_SIZE = 32;
// Wechselbereitschaft: Ein Spieler kommt nur, wenn er den Verein nicht um
// mehr als diesen Wert ueberragt. Sonst holt ein Abstiegskandidat fuer ein
// paar Millionen Weltklasse, weil der Marktwert vom Kaeufer unabhaengig ist.
const TRANSFER_MAX_ABOVE_CLUB = 6;

// Automatische Aufstellung: kleiner Vorzug fuer die gelernte Position, damit
// niemand fuer ein bis zwei Punkte auf einen fremden Platz rutscht.
const AUTO_LINEUP_NATURAL_BONUS = 1.5;

// Scouting: Breite der Potenzialspanne fremder Spieler
const SCOUT_RANGE_BASE = 12;
const SCOUT_RANGE_PER_LEVEL = 2;        // je Ausbaustufe der Scouting-Abteilung
const SCOUT_COST_BASE = 60000;          // gezielte Beobachtung, skaliert mit dem Verein

// Leihen
const LOAN_MAX_AGE = 23;
const LOAN_GAIN_MIN = 3;
const LOAN_GAIN_MAX = 7;

// Schwierigkeitsgrade
const DIFFICULTIES = {
  leicht: { label: "Leicht", budget: 1.4,  patience: 85, patienceLoss: 0.7, transferBonus: 4 },
  normal: { label: "Normal", budget: 1.0,  patience: 75, patienceLoss: 1.0, transferBonus: 0 },
  schwer: { label: "Schwer", budget: 0.75, patience: 60, patienceLoss: 1.3, transferBonus: -4 }
};

// Liga-Leben: Nachrichten, Trainerwechsel, Transfers anderer Vereine
const NEWS_MAX = 40;
const COACH_FIRE_CHANCE = 0.3;
const AI_TRANSFERS_PER_WINDOW = 4;
const TEAM_OF_SEASON_SLOTS = [
  { label: "TW", pos: ["TW"] }, { label: "RV", pos: ["RV"] }, { label: "IV", pos: ["IV"] }, { label: "IV", pos: ["IV"] },
  { label: "LV", pos: ["LV"] }, { label: "RM", pos: ["RM"] }, { label: "ZM", pos: ["ZM", "DM", "OM"] },
  { label: "ZM", pos: ["ZM", "DM", "OM"] }, { label: "LM", pos: ["LM"] }, { label: "ST", pos: ["ST"] }, { label: "ST", pos: ["ST", "OM"] }
];

// Kapitaen
const CAPTAIN_MORALE_PULL = 0.6;       // je Spieltag, bei sehr guter/schlechter Laune des Kapitaens
const CAPTAIN_APPOINTED_MORALE = 6;
const CAPTAIN_DEPOSED_MORALE = 8;

// Trainer-Ruf (0-100)
const REPUTATION_START = 40;
const REPUTATION_PER_RANK = 1.5;

// Finanzen: Sponsoren, Trainingslager, Unterhalt
const SPONSOR_BASE = 1800000;               // pro Saison, mal (0,2 + Einnahmefaktor)
const FACILITY_UPKEEP_PER_LEVEL = 8000;     // pro Ausbaustufe und Spieltag (skaliert)
const CAMP_TIERS = [
  { key: "basis",   label: "Heimtrainingslager", icon: "🏠", costBase: 250000,  morale: 5,  boost: 0,   matchdays: 0 },
  { key: "ausland", label: "Auslandslager",      icon: "✈️", costBase: 700000,  morale: 8,  boost: 1.5, matchdays: 8 },
  { key: "premium", label: "Premium-Camp",       icon: "🌴", costBase: 1600000, morale: 12, boost: 2.5, matchdays: 12 }
];

// Angebote anderer Vereine fuer eigene Spieler (nur im Transferfenster)
const OFFER_CHANCE_PER_MATCHDAY = 0.55;
const OFFER_MAX_ACTIVE = 3;
const OFFER_FEE_MIN = 0.85;          // Anteil des Marktwerts
const OFFER_FEE_MAX = 1.45;
const OFFER_BUYER_MAX_BELOW = 6;     // Kaeufer hoechstens so viel schwaecher als der Spieler
const OFFER_COUNTER_RAISE = 0.20;    // Nachforderung beim Nachverhandeln
const OFFER_DISAPPOINT_RATIO = 1.2;  // ab diesem Angebot ist eine Absage enttaeuschend
const OFFER_REJECT_MORALE = 14;

// Notverpflichtungen bei zu kleinem Kader: hoechstens so stark wie der Verein.
const REFILL_MAX_ABOVE_CLUB = 0;

// Jugend gilt erst als bereit, wenn sie hoechstens so weit unter der Teamstaerke liegt.
const YOUTH_READY_MAX_BELOW_TEAM = 12;

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
// Stellenmarkt: Anteil freier Trainerposten je Saison und noetiger Ruf
// (Staerke 92 -> 80, 75 -> 46, 60 -> 16).
const JOB_VACANCY_SHARE = 0.2;
const JOB_REP_BASE_STRENGTH = 52;
const JOB_REP_PER_POINT = 2;
// Erfolgreiche Trainer kommen auch ohne passenden Ruf bei Vereinen bis
// knapp ueber dem eigenen unter.
const JOB_STATURE_MARGIN = 2;
const JOB_STATURE_MIN_PATIENCE = 50;
const JOB_HOPELESS_GAP = 12;
const JOB_LEAK_CHANCE = 0.2;
const JOB_LEAK_PATIENCE = 6;
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
    desc: "",
    attr: { def:1.0, pas:1.0, sho:1.0, pac:1.0 },
    injury: 1.0, fatigue: 1.0, morale: 0, match: { att: 0, def: 0 }
  },
  offense: {
    label: "Offensive",
    desc: "Entwicklung Abschluss/Aufbau ↑, Abwehr ↓",
    attr: { def:0.65, pas:1.35, sho:1.45, pac:1.0 },
    injury: 1.0, fatigue: 1.0, morale: 0.1, match: { att: 2.5, def: -1.5 }
  },
  defense: {
    label: "Defensive",
    desc: "Entwicklung Abwehr ↑, Abschluss ↓",
    attr: { def:1.50, pas:1.0, sho:0.60, pac:0.95 },
    injury: 0.9, fatigue: 1.0, morale: -0.1, match: { att: -1.5, def: 2.5 }
  },
  athletics: {
    label: "Athletik",
    desc: "Entwicklung Tempo ↑↑",
    attr: { def:0.88, pas:0.75, sho:0.88, pac:1.60 },
    injury: 1.45, fatigue: 0.85, morale: -0.2, match: { att: 1, def: 1 }
  },
  regeneration: {
    label: "Regeneration",
    desc: "Entwicklung ↓, Stimmung ↑",
    attr: { def:0.55, pas:0.55, sho:0.55, pac:0.55 },
    injury: 0.55, fatigue: 0.45, morale: 0.9, match: { att: -1, def: -1 }
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
// Schere-Stein-Papier: Defensiv kontert Offensiv, Offensiv drueckt
// Ausgeglichen an die Wand, Ausgeglichen knackt den tiefen Block. Vorher
// hatte Defensiv in keiner Paarung einen Nachteil und war im Schnitt vier
// bis fuenf Punkte pro Saison besser als alles andere. Jede Zeile ist das
// Spiegelbild der Gegenrichtung: [A][B] = {own:x, opp:y} <=> [B][A] = {own:y, opp:x}.
const TACTIC_COUNTER = {
  offensive: {
    offensive: { own: 0.15, opp: 0.15 },   // offenes Spiel
    balanced:  { own: 0.10, opp: 0.00 },   // Druck
    defensive: { own: -0.12, opp: 0.08 }   // wird abgefangen
  },
  balanced: {
    offensive: { own: 0.00, opp: 0.10 },
    balanced:  { own: 0.00, opp: 0.00 },
    defensive: { own: 0.10, opp: -0.04 }   // geduldiger Aufbau knackt den Riegel
  },
  defensive: {
    offensive: { own: 0.08, opp: -0.12 },  // Konter greift
    balanced:  { own: -0.04, opp: 0.10 },
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
    wirkung: stufe => `Kommerzeinnahmen +${stufe * 6}%`,
    perLevel: 0.06
  },
  coaching: {
    label: "Trainerstab",
    icon: "📋",
    wirkung: stufe => `Entwicklung +${stufe * 5}%`,
    perLevel: 0.05
  },
  youth: {
    label: "Jugendarbeit",
    icon: "🌱",
    wirkung: stufe => `Talente +${stufe * 2} Bewertung, +${stufe * 3} Potenzial`,
    perLevel: 1
  },
  medical: {
    label: "Medizin",
    icon: "🩺",
    wirkung: stufe => `Verletzungsrisiko −${stufe * 8}%`,
    perLevel: 0.08
  },
  scouting: {
    label: "Scouting",
    icon: "🔍",
    wirkung: stufe => `Scouting-Funde +${stufe * 25}%, mehr Spieler am Markt`,
    perLevel: 0.25
  }
};

// ============================================
// Ligen
// ============================================
// 3. Liga 2026/27 mit allen 20 Vereinen (38 Spieltage, vier Absteiger in die Regionalliga).
const THIRD_DIVISION_CLUBS = [
  {name:"Fortuna Düsseldorf", strength:52},
  {name:"Rot-Weiss Essen", strength:51},
  {name:"MSV Duisburg", strength:51},
  {name:"Preußen Münster", strength:50},
  {name:"Hansa Rostock", strength:50},
  {name:"SC Verl", strength:49},
  {name:"Alemannia Aachen", strength:49},
  {name:"SV Wehen Wiesbaden", strength:48},
  {name:"SV Waldhof Mannheim", strength:47},
  {name:"FC Viktoria Köln", strength:46},
  {name:"FC Ingolstadt 04", strength:46},
  {name:"SSV Jahn Regensburg", strength:46},
  {name:"1. FC Saarbrücken", strength:46},
  {name:"VfB Stuttgart II", strength:44},
  {name:"TSG Hoffenheim II", strength:44},
  {name:"Würzburger Kickers", strength:44},
  {name:"SV Meppen", strength:43},
  {name:"SG Sonnenhof Großaspach", strength:42},
  {name:"SC Fortuna Köln", strength:42},
  {name:"TSV Havelse", strength:41}
];

// Regionalliga: wird nicht ausgespielt. Aus diesem Kreis steigen jedes Jahr
// vier Vereine in die 3. Liga auf (nach Staerke gewichtet ausgelost), die
// vier Letzten der 3. Liga kommen dafuer hinzu.
const REGIONAL_CLUBS = [
  {name:"TSV 1860 München", strength:44},
  {name:"FC Erzgebirge Aue", strength:43},
  {name:"SSV Ulm 1846", strength:43},
  {name:"SpVgg Unterhaching", strength:41},
  {name:"SV Sandhausen", strength:41},
  {name:"Kickers Offenbach", strength:41},
  {name:"1. FC Schweinfurt 05", strength:39},
  {name:"Hallescher FC", strength:40},
  {name:"FC Carl Zeiss Jena", strength:40},
  {name:"1. FC Lokomotive Leipzig", strength:40},
  {name:"FC Bayern München II", strength:40},
  {name:"Chemnitzer FC", strength:39},
  {name:"Rot-Weiß Oberhausen", strength:39},
  {name:"FC 08 Homburg", strength:38},
  {name:"Wuppertaler SV", strength:37},
  {name:"SC Freiburg II", strength:38}
];
const REGIONAL_PROMOTIONS = 4;          // Auf- bzw. Absteiger zwischen 3. Liga und Regionalliga
const REGIONAL_RELEGATION_STRENGTH_LOSS = 2;

// Ziele fuer die dritte Liga
const BOARD_GOALS_DIV3 = [
  { maxRank: 2,  minStrength: 48, label: "Direkter Aufstieg",           target: 2 },
  { maxRank: 3,  minStrength: 44, label: "Aufstiegsrelegation",         target: 3 },
  { maxRank: 8,  minStrength: 40, label: "Vorderes Tabellendrittel",    target: 6 },
  { maxRank: 12, minStrength: 36, label: "Gesicherter Mittelfeldplatz", target: 12 },
  { maxRank: 99, minStrength: 0,  label: "Klassenerhalt",               target: 16 }
];

// Saisonziele aus der Ligagroesse: der Klassenerhalt haengt an der Zahl der
// Absteiger, das Mittelfeld an der Groesse.
function buildTopDivisionGoals(size, meister, sicher){
  return [
    { maxRank: 1,  minStrength: 88, label: meister,                             target: 1 },
    { maxRank: 4,  minStrength: 80, label: "Qualifikation für den Europapokal", target: 4 },
    { maxRank: 8,  minStrength: 72, label: "Einstelliger Tabellenplatz",        target: 9 },
    { maxRank: 12, minStrength: 64, label: "Gesicherter Mittelfeldplatz",       target: Math.round(size * 0.72) },
    { maxRank: 99, minStrength: 0,  label: "Klassenerhalt",                     target: sicher }
  ];
}
function buildLowerDivisionGoals(size, direkt, playoffLabel, playoffBis, sicher){
  return [
    { maxRank: 2,  minStrength: 62, label: "Direkter Aufstieg",           target: direkt },
    { maxRank: 3,  minStrength: 55, label: playoffLabel,                  target: playoffBis },
    { maxRank: 8,  minStrength: 48, label: "Vorderes Tabellendrittel",    target: Math.round(size / 3) },
    { maxRank: 12, minStrength: 44, label: "Gesicherter Mittelfeldplatz", target: Math.round(size * 0.62) },
    { maxRank: 99, minStrength: 0,  label: "Klassenerhalt",               target: sicher }
  ];
}

// Laender mit ihrem Pokal und dem Reservekreis unter der untersten Liga
// (wird nicht ausgespielt, liefert Aufsteiger und nimmt Absteiger auf).
const COUNTRIES = [
  { key: "de", name: "Deutschland", flag: "🇩🇪", code: "DE", nat: "DE", cup: "DFB-Pokal", cupShort: "Pokal",
    reserve: { label: "Regionalliga", clubs: REGIONAL_CLUBS, swaps: REGIONAL_PROMOTIONS } },
  { key: "en", name: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", code: "EN", nat: "GB", cup: "FA Cup", cupShort: "FA Cup",
    reserve: { label: "League One", clubs: ENGLAND_RESERVE_CLUBS, swaps: 3 } },
  { key: "es", name: "Spanien", flag: "🇪🇸", code: "ES", nat: "ES", cup: "Copa del Rey", cupShort: "Copa",
    reserve: { label: "Primera RFEF", clubs: SPAIN_RESERVE_CLUBS, swaps: 4 } },
  { key: "it", name: "Italien", flag: "🇮🇹", code: "IT", nat: "IT", cup: "Coppa Italia", cupShort: "Coppa",
    reserve: { label: "Serie C", clubs: ITALY_RESERVE_CLUBS, swaps: 4 } },
  { key: "fr", name: "Frankreich", flag: "🇫🇷", code: "FR", nat: "FR", cup: "Coupe de France", cupShort: "Coupe",
    reserve: { label: "National", clubs: FRANCE_RESERVE_CLUBS, swaps: 3 } }
];

// Regeln an der Nahtstelle zur naechsttieferen Liga desselben Landes:
//  relegation: Drittletzter oben gegen Dritten unten
//  playoff:    Plaetze der unteren Liga spielen einen weiteren Aufsteiger aus
//  barrage:    Play-off der unteren Liga, Sieger gegen den Drittletzten oben
const SEAM_DE = { directDown: 2, directUp: 2, playoff: { type: "relegation" } };
const SEAM_PLAYOFF = { directDown: 3, directUp: 2, playoff: { type: "playoff", positions: [3, 4, 5, 6] } };
const SEAM_FR = { directDown: 2, directUp: 2, playoff: { type: "barrage", positions: [3, 4, 5] } };

// Eine Stelle, an der alles Ligaabhaengige zusammenlaeuft. Die Nummer (nr)
// ist eindeutig ueber alle Laender, tier ist die Spielklasse im Land.
const DIVISIONS = [
  { nr: 1, country: "de", tier: 1, label: "1. Bundesliga", short: "1. BL",
    clubs: CLUBS, revenueFactor: 1.0, staturePenalty: 0,
    goals: BOARD_GOALS_DIV1, europe: true, seam: SEAM_DE },
  { nr: 2, country: "de", tier: 2, label: "2. Bundesliga", short: "2. BL",
    clubs: SECOND_DIVISION_CLUBS, revenueFactor: 0.5, staturePenalty: 8,
    goals: BOARD_GOALS_DIV2, europe: false, seam: SEAM_DE },
  { nr: 3, country: "de", tier: 3, label: "3. Liga", short: "3. L",
    clubs: THIRD_DIVISION_CLUBS, revenueFactor: 0.22, staturePenalty: 16,
    goals: BOARD_GOALS_DIV3, europe: false },
  { nr: 4, country: "en", tier: 1, label: "Premier League", short: "PL",
    clubs: PREMIER_LEAGUE_CLUBS, revenueFactor: 1.3, staturePenalty: 0,
    goals: buildTopDivisionGoals(20, "Englischer Meister", 17), europe: true, seam: SEAM_PLAYOFF },
  { nr: 5, country: "en", tier: 2, label: "Championship", short: "CH",
    clubs: CHAMPIONSHIP_CLUBS, revenueFactor: 0.6, staturePenalty: 8,
    goals: buildLowerDivisionGoals(24, 2, "Aufstiegs-Play-offs", 6, 21), europe: false },
  { nr: 6, country: "es", tier: 1, label: "LaLiga", short: "LL",
    clubs: LALIGA_CLUBS, revenueFactor: 1.0, staturePenalty: 0,
    goals: buildTopDivisionGoals(20, "Spanischer Meister", 17), europe: true, seam: SEAM_PLAYOFF },
  { nr: 7, country: "es", tier: 2, label: "LaLiga 2", short: "LL2",
    clubs: LALIGA2_CLUBS, revenueFactor: 0.4, staturePenalty: 8,
    goals: buildLowerDivisionGoals(22, 2, "Aufstiegs-Play-offs", 6, 18), europe: false },
  { nr: 8, country: "it", tier: 1, label: "Serie A", short: "SA",
    clubs: SERIE_A_CLUBS, revenueFactor: 0.95, staturePenalty: 0,
    goals: buildTopDivisionGoals(20, "Italienischer Meister", 17), europe: true, seam: SEAM_PLAYOFF },
  { nr: 9, country: "it", tier: 2, label: "Serie B", short: "SB",
    clubs: SERIE_B_CLUBS, revenueFactor: 0.4, staturePenalty: 8,
    goals: buildLowerDivisionGoals(20, 2, "Aufstiegs-Play-offs", 6, 16), europe: false },
  { nr: 10, country: "fr", tier: 1, label: "Ligue 1", short: "L1",
    clubs: LIGUE1_CLUBS, revenueFactor: 0.85, staturePenalty: 0,
    goals: buildTopDivisionGoals(18, "Französischer Meister", 15), europe: true, seam: SEAM_FR },
  { nr: 11, country: "fr", tier: 2, label: "Ligue 2", short: "L2",
    clubs: LIGUE2_CLUBS, revenueFactor: 0.35, staturePenalty: 8,
    goals: buildLowerDivisionGoals(18, 2, "Aufstiegs-Play-offs", 5, 15), europe: false }
];
