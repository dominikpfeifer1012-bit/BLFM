// ============================================
// CLUBS-INTL.JS - Vereine der Ligen in England, Spanien, Italien, Frankreich
// ============================================
// Saison 2026/27. Staerken auf derselben Skala wie die Bundesliga (Bayern 92):
// Tabellenplatz der Vorsaison, Kaderwert und Groesse. Die Auf- und Absteiger
// aus 2025/26 sind nach bestem Wissen eingetragen und lassen sich ueber den
// Kader-Import oder hier anpassen.

// ---------- England ----------
const PREMIER_LEAGUE_CLUBS = [
  {name:"FC Arsenal", strength:91},
  {name:"Manchester City", strength:90},
  {name:"FC Liverpool", strength:89},
  {name:"FC Chelsea", strength:86},
  {name:"Aston Villa", strength:83},
  {name:"Newcastle United", strength:82},
  {name:"Manchester United", strength:81},
  {name:"Tottenham Hotspur", strength:81},
  {name:"Brighton & Hove Albion", strength:78},
  {name:"Crystal Palace", strength:77},
  {name:"Nottingham Forest", strength:76},
  {name:"AFC Bournemouth", strength:76},
  {name:"FC Brentford", strength:76},
  {name:"FC Fulham", strength:75},
  {name:"FC Everton", strength:75},
  {name:"AFC Sunderland", strength:74},
  {name:"Leeds United", strength:73},
  {name:"Ipswich Town", strength:71},
  {name:"FC Middlesbrough", strength:70},
  {name:"Coventry City", strength:70}
];

const CHAMPIONSHIP_CLUBS = [
  {name:"West Ham United", strength:72},
  {name:"Wolverhampton Wanderers", strength:71},
  {name:"FC Burnley", strength:69},
  {name:"FC Southampton", strength:66},
  {name:"Leicester City", strength:66},
  {name:"Hull City", strength:63},
  {name:"FC Millwall", strength:63},
  {name:"Norwich City", strength:63},
  {name:"Birmingham City", strength:63},
  {name:"AFC Wrexham", strength:63},
  {name:"Sheffield United", strength:63},
  {name:"West Bromwich Albion", strength:63},
  {name:"Preston North End", strength:62},
  {name:"Stoke City", strength:62},
  {name:"FC Watford", strength:62},
  {name:"Bristol City", strength:62},
  {name:"Swansea City", strength:61},
  {name:"Derby County", strength:60},
  {name:"Queens Park Rangers", strength:60},
  {name:"Blackburn Rovers", strength:60},
  {name:"FC Portsmouth", strength:59},
  {name:"Charlton Athletic", strength:59},
  {name:"Cardiff City", strength:59},
  {name:"Bolton Wanderers", strength:58}
];

const ENGLAND_RESERVE_CLUBS = [
  {name:"Luton Town", strength:56},
  {name:"Oxford United", strength:55},
  {name:"Huddersfield Town", strength:55},
  {name:"Sheffield Wednesday", strength:54},
  {name:"Plymouth Argyle", strength:54},
  {name:"Lincoln City", strength:54},
  {name:"FC Reading", strength:53},
  {name:"FC Barnsley", strength:52},
  {name:"Wigan Athletic", strength:52},
  {name:"Stockport County", strength:53},
  {name:"Peterborough United", strength:51},
  {name:"Rotherham United", strength:50}
];

// ---------- Spanien ----------
const LALIGA_CLUBS = [
  {name:"Real Madrid", strength:91},
  {name:"FC Barcelona", strength:91},
  {name:"Atlético Madrid", strength:86},
  {name:"Athletic Bilbao", strength:80},
  {name:"FC Villarreal", strength:80},
  {name:"Real Betis Sevilla", strength:78},
  {name:"Real Sociedad", strength:77},
  {name:"Celta Vigo", strength:74},
  {name:"FC Sevilla", strength:74},
  {name:"FC Valencia", strength:73},
  {name:"CA Osasuna", strength:72},
  {name:"Rayo Vallecano", strength:72},
  {name:"FC Getafe", strength:71},
  {name:"Espanyol Barcelona", strength:71},
  {name:"RCD Mallorca", strength:70},
  {name:"FC Elche", strength:69},
  {name:"Deportivo Alavés", strength:69},
  {name:"Racing Santander", strength:67},
  {name:"Deportivo La Coruña", strength:67},
  {name:"UD Almería", strength:66}
];

const LALIGA2_CLUBS = [
  {name:"FC Girona", strength:68},
  {name:"UD Levante", strength:64},
  {name:"Real Oviedo", strength:63},
  {name:"UD Las Palmas", strength:62},
  {name:"CD Leganés", strength:62},
  {name:"Real Valladolid", strength:61},
  {name:"FC Málaga", strength:60},
  {name:"Sporting Gijón", strength:60},
  {name:"FC Granada", strength:60},
  {name:"CD Castellón", strength:60},
  {name:"FC Cádiz", strength:59},
  {name:"SD Eibar", strength:59},
  {name:"Burgos CF", strength:58},
  {name:"FC Córdoba", strength:58},
  {name:"Albacete Balompié", strength:57},
  {name:"SD Huesca", strength:57},
  {name:"FC Andorra", strength:56},
  {name:"CD Mirandés", strength:56},
  {name:"CD Teneriffa", strength:56},
  {name:"Real Murcia", strength:55},
  {name:"AD Ceuta", strength:54},
  {name:"Cultural Leonesa", strength:54}
];

const SPAIN_RESERVE_CLUBS = [
  {name:"Real Saragossa", strength:55},
  {name:"Racing Ferrol", strength:52},
  {name:"Hércules Alicante", strength:51},
  {name:"SD Ponferradina", strength:51},
  {name:"Gimnàstic Tarragona", strength:51},
  {name:"AD Alcorcón", strength:50},
  {name:"CD Lugo", strength:50},
  {name:"UD Ibiza", strength:50},
  {name:"Algeciras CF", strength:49},
  {name:"CE Sabadell", strength:49},
  {name:"Unionistas Salamanca", strength:48},
  {name:"Real Unión Irún", strength:47}
];

// ---------- Italien ----------
const SERIE_A_CLUBS = [
  {name:"Inter Mailand", strength:88},
  {name:"SSC Neapel", strength:85},
  {name:"AC Mailand", strength:84},
  {name:"Juventus Turin", strength:84},
  {name:"Atalanta Bergamo", strength:82},
  {name:"AS Rom", strength:81},
  {name:"Como 1907", strength:79},
  {name:"Lazio Rom", strength:77},
  {name:"FC Bologna", strength:77},
  {name:"AC Florenz", strength:74},
  {name:"FC Turin", strength:72},
  {name:"Udinese Calcio", strength:71},
  {name:"CFC Genua", strength:70},
  {name:"US Sassuolo", strength:70},
  {name:"Cagliari Calcio", strength:69},
  {name:"Parma Calcio", strength:69},
  {name:"US Lecce", strength:67},
  {name:"US Palermo", strength:67},
  {name:"FC Venedig", strength:67},
  {name:"Frosinone Calcio", strength:66}
];

const SERIE_B_CLUBS = [
  {name:"AC Pisa", strength:65},
  {name:"Hellas Verona", strength:65},
  {name:"US Cremonese", strength:64},
  {name:"AC Monza", strength:63},
  {name:"FC Empoli", strength:61},
  {name:"Modena FC", strength:60},
  {name:"Sampdoria Genua", strength:59},
  {name:"Spezia Calcio", strength:59},
  {name:"US Catanzaro", strength:59},
  {name:"SSC Bari", strength:58},
  {name:"Cesena FC", strength:58},
  {name:"FC Südtirol", strength:57},
  {name:"Calcio Padova", strength:57},
  {name:"Carrarese Calcio", strength:56},
  {name:"AC Reggiana", strength:56},
  {name:"Juve Stabia", strength:56},
  {name:"AC Mantova", strength:56},
  {name:"US Avellino", strength:56},
  {name:"LR Vicenza", strength:56},
  {name:"Benevento Calcio", strength:55}
];

const ITALY_RESERVE_CLUBS = [
  {name:"US Salernitana", strength:54},
  {name:"Catania FC", strength:54},
  {name:"Delfino Pescara", strength:53},
  {name:"AS Cittadella", strength:52},
  {name:"Ternana Calcio", strength:52},
  {name:"Cosenza Calcio", strength:51},
  {name:"FC Crotone", strength:51},
  {name:"SS Arezzo", strength:51},
  {name:"Calcio Lecco", strength:50},
  {name:"AC Perugia", strength:50},
  {name:"US Triestina", strength:50},
  {name:"Trapani Calcio", strength:49}
];

// ---------- Frankreich ----------
const LIGUE1_CLUBS = [
  {name:"Paris Saint-Germain", strength:90},
  {name:"Olympique Marseille", strength:80},
  {name:"AS Monaco", strength:79},
  {name:"OSC Lille", strength:77},
  {name:"Olympique Lyon", strength:77},
  {name:"RC Lens", strength:76},
  {name:"OGC Nizza", strength:74},
  {name:"Stade Rennes", strength:74},
  {name:"Racing Straßburg", strength:74},
  {name:"FC Toulouse", strength:70},
  {name:"Stade Brest", strength:70},
  {name:"Paris FC", strength:69},
  {name:"AS Saint-Étienne", strength:66},
  {name:"SCO Angers", strength:66},
  {name:"Le Havre AC", strength:66},
  {name:"FC Lorient", strength:66},
  {name:"AJ Auxerre", strength:66},
  {name:"ES Troyes AC", strength:64}
];

const LIGUE2_CLUBS = [
  {name:"FC Nantes", strength:64},
  {name:"FC Metz", strength:63},
  {name:"Stade Reims", strength:62},
  {name:"HSC Montpellier", strength:60},
  {name:"Le Mans FC", strength:58},
  {name:"Red Star Paris", strength:57},
  {name:"EA Guingamp", strength:57},
  {name:"USL Dunkerque", strength:57},
  {name:"Amiens SC", strength:56},
  {name:"Clermont Foot", strength:56},
  {name:"Pau FC", strength:55},
  {name:"FC Annecy", strength:55},
  {name:"Grenoble Foot", strength:55},
  {name:"Rodez AF", strength:55},
  {name:"SC Bastia", strength:54},
  {name:"Stade Laval", strength:54},
  {name:"AS Nancy", strength:54},
  {name:"US Boulogne", strength:52}
];

const FRANCE_RESERVE_CLUBS = [
  {name:"Stade Malherbe Caen", strength:52},
  {name:"FC Sochaux", strength:51},
  {name:"FCO Dijon", strength:51},
  {name:"Valenciennes FC", strength:50},
  {name:"AC Ajaccio", strength:50},
  {name:"US Orléans", strength:49},
  {name:"FC Rouen", strength:49},
  {name:"US Quevilly", strength:49},
  {name:"FC Versailles", strength:49},
  {name:"FC Martigues", strength:48},
  {name:"Bourg-Péronnas", strength:48},
  {name:"Nîmes Olympique", strength:47}
];
