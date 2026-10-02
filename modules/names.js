// ============================================
// NAMES.JS - Namensdatenbank nach Nationalitaeten
// ============================================
// Die Gewichte bilden grob die Herkunftsverteilung in einer europaeischen
// Spitzenliga ab. weight ist relativ, die Summe muss nichts Bestimmtes ergeben.

const NATIONALITIES = [
  { code:"DE", name:"Deutschland", flag:"🇩🇪", weight:30,
    first:["Lukas","Jonas","Finn","Elias","Noah","Leon","Mika","Tim","Paul","Ben","Kai","Erik","Malte","Aaron","Sven","Niklas","Jannik","Fabian","Moritz","Julian","Marvin","Tobias","Hendrik","Simon","Nico","Marcel","Philipp","Jannis","Luca","Robin","Florian","Dennis","Maximilian","Colin","Torben","Silas"],
    last:["Weber","Schmidt","Fischer","Bauer","Hoffmann","Klein","Wolf","Neumann","Schwarz","Zimmermann","Krüger","Braun","Hartmann","Lange","Berger","Schneider","Vogel","Keller","Winkler","Sommer","Brandt","Kaiser","Roth","Engel","Schulz","Richter","Krause","Werner","Peters","Möller","Herrmann","Franke","Stein","Baumann","Reuter","Voigt"] },

  { code:"AT", name:"Österreich", flag:"🇦🇹", weight:5,
    first:["Marcel","Stefan","Andreas","Christoph","Dominik","Manuel","Florian","Patrick","Michael","Thomas","Lukas","Valentin"],
    last:["Gruber","Huber","Wimmer","Steiner","Leitner","Pichler","Aigner","Baumgartner","Ebner","Reiter","Fuchs","Hofer"] },

  { code:"CH", name:"Schweiz", flag:"🇨🇭", weight:4,
    first:["Yann","Remo","Silvan","Nico","Fabian","Loris","Cédric","Andrin","Levin","Ruben"],
    last:["Widmer","Frei","Aebischer","Zuber","Rieder","Bühler","Steffen","Kobel","Schär","Amrein"] },

  { code:"FR", name:"Frankreich", flag:"🇫🇷", weight:8,
    first:["Théo","Lucas","Hugo","Enzo","Nathan","Maxime","Clément","Antoine","Bastien","Rémi","Yanis","Amine","Mathis","Corentin","Julien","Quentin","Adrien","Loïc","Kylian","Baptiste","Noé","Ilyes"],
    last:["Bernard","Dubois","Moreau","Laurent","Girard","Lefèvre","Mercier","Renard","Fontaine","Chevalier","Perrin","Gauthier","Marchand","Blanchard","Roussel","Leclerc","Bonnet","Guillot","Masson","Deschamps","Colin","Barbier"] },

  { code:"NL", name:"Niederlande", flag:"🇳🇱", weight:5,
    first:["Sem","Daan","Bram","Ruben","Thijs","Jesper","Stijn","Joris","Lars","Sven","Teun","Milan","Finn","Luuk","Jurriën","Kick","Mees","Noud","Rens","Tijmen"],
    last:["de Vries","van Dijk","Bakker","Jansen","Visser","de Boer","Mulder","van Leeuwen","Kuipers","Hendriks","Vermeulen","Willems","van der Berg","Smit","Koster","Brouwer","Dekker","van Rijn","Meijer","Prins"] },

  { code:"BE", name:"Belgien", flag:"🇧🇪", weight:3,
    first:["Arne","Wout","Senne","Lander","Matteo","Jarne","Siebe","Thibaut"],
    last:["Peeters","Janssens","Maes","Willems","Claes","Goossens","Wouters","De Smet"] },

  { code:"ES", name:"Spanien", flag:"🇪🇸", weight:5,
    first:["Álvaro","Sergio","Iker","Pablo","Marco","Adrián","Rubén","Javier","Diego","Nacho","Aitor","Unai","Carlos","Mateo","Hugo","Izan","Gonzalo","Borja","Asier","Dani"],
    last:["García","Martínez","Sánchez","Romero","Navarro","Ortega","Castillo","Iglesias","Vidal","Serrano","Aguirre","Molina","Herrera","Delgado","Campos","Reyes","Cabrera","Lozano","Peña","Vargas"] },

  { code:"PT", name:"Portugal", flag:"🇵🇹", weight:4,
    first:["Rui","Tiago","Gonçalo","Bruno","Diogo","Rafael","Vitor","André","Nuno","Miguel","João","Pedro","Fábio","Ricardo","Hugo","Duarte","Salvador","Martim"],
    last:["Ferreira","Pereira","Almeida","Carvalho","Sousa","Teixeira","Moreira","Fonseca","Barbosa","Machado","Cardoso","Marques","Lopes","Neves","Pinto","Correia","Domingues","Faria"] },

  { code:"IT", name:"Italien", flag:"🇮🇹", weight:3,
    first:["Matteo","Lorenzo","Andrea","Federico","Riccardo","Giulio","Davide","Alessio","Stefano","Nicolò","Luca","Marco","Simone","Gianluca","Emanuele","Pietro","Tommaso","Enrico"],
    last:["Ricci","Marchetti","Gallo","Costa","Rinaldi","Barbieri","Fabbri","Caruso","Ferrari","Bellini","Greco","Sartori","Villa","Longo","Basile","Testa","Palmieri","Rizzo"] },

  { code:"BR", name:"Brasilien", flag:"🇧🇷", weight:6,
    first:["Rodrigo","Lucas","Matheus","Gabriel","Felipe","Caio","Vinícius","Everton","Douglas","Wesley","Igor","Bruno","Thiago","Renato","Leandro","Murilo","Danilo","Éder","Paulo","Otávio"],
    last:["Silva","Santos","Oliveira","Costa","Barbosa","Ribeiro","Nogueira","Cardoso","Moraes","Batista","Pinheiro","Vieira","Fernandes","Gomes","Rocha","Azevedo","Correia","Teixeira","Macedo","Freitas"] },

  { code:"AR", name:"Argentinien", flag:"🇦🇷", weight:3,
    first:["Facundo","Nicolás","Emiliano","Santiago","Tomás","Julián","Agustín","Franco"],
    last:["Domínguez","Acosta","Ibarra","Quiroga","Sosa","Ledesma","Peralta","Cabrera"] },

  { code:"PL", name:"Polen", flag:"🇵🇱", weight:3,
    first:["Kacper","Bartosz","Michał","Szymon","Jakub","Mateusz","Filip","Adrian"],
    last:["Kowalczyk","Zieliński","Woźniak","Kamiński","Lewandowski","Szymański","Dąbrowski","Mazur"] },

  { code:"CZ", name:"Tschechien", flag:"🇨🇿", weight:2,
    first:["Ondřej","Tomáš","Vojtěch","Jakub","Marek","Petr"],
    last:["Novák","Svoboda","Dvořák","Černý","Procházka","Kučera"] },

  { code:"HR", name:"Kroatien", flag:"🇭🇷", weight:3,
    first:["Ivan","Luka","Marko","Josip","Filip","Antonio","Domagoj"],
    last:["Horvat","Kovačević","Marić","Jurić","Babić","Vuković","Perić"] },

  { code:"RS", name:"Serbien", flag:"🇷🇸", weight:2,
    first:["Nemanja","Stefan","Miloš","Uroš","Aleksa","Vukašin"],
    last:["Jovanović","Petrović","Nikolić","Ilić","Stanković","Ristić"] },

  { code:"DK", name:"Dänemark", flag:"🇩🇰", weight:3,
    first:["Mikkel","Rasmus","Anders","Frederik","Emil","Oliver","Magnus"],
    last:["Nielsen","Jensen","Andersen","Poulsen","Kristensen","Sørensen","Møller"] },

  { code:"SE", name:"Schweden", flag:"🇸🇪", weight:2,
    first:["Viktor","Oscar","Elias","Hugo","Axel","Melker"],
    last:["Lindqvist","Berg","Nyström","Sundström","Hedlund","Öberg"] },

  { code:"NO", name:"Norwegen", flag:"🇳🇴", weight:2,
    first:["Sander","Mathias","Kristian","Jonas","Håkon","Sindre"],
    last:["Haugen","Johansen","Solberg","Dahl","Bakken","Lund"] },

  { code:"GB", name:"England", flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", weight:3,
    first:["Harry","Callum","Josh","Reece","Ollie","Kieran","Mason","Jude"],
    last:["Whitfield","Bennett","Hargreaves","Chambers","Blackwood","Radcliffe","Ashworth","Kingsley"] },

  { code:"TR", name:"Türkei", flag:"🇹🇷", weight:3,
    first:["Emre","Kerem","Yusuf","Berkay","Ozan","Baris","Arda","Kaan"],
    last:["Yılmaz","Demir","Kaya","Çelik","Aydın","Şahin","Öztürk","Doğan"] },

  { code:"JP", name:"Japan", flag:"🇯🇵", weight:3,
    first:["Ryota","Takumi","Sho","Daichi","Kaito","Yuto","Haruki","Sota"],
    last:["Nakamura","Yoshida","Sakamoto","Fujimoto","Hasegawa","Morita","Kimura","Ishikawa"] },

  { code:"KR", name:"Südkorea", flag:"🇰🇷", weight:2,
    first:["Min-jae","Jae-sung","Woo-young","Hee-chan","Seung-ho","Ji-hoon"],
    last:["Kim","Park","Lee","Choi","Jung","Kang"] },

  { code:"SN", name:"Senegal", flag:"🇸🇳", weight:2,
    first:["Ibrahima","Moussa","Cheikh","Pape","Abdoulaye","Lamine"],
    last:["Diallo","Ndiaye","Sarr","Faye","Gueye","Diouf"] },

  { code:"NG", name:"Nigeria", flag:"🇳🇬", weight:2,
    first:["Chidi","Emeka","Tunde","Kelechi","Obinna","Ifeanyi"],
    last:["Okafor","Adeyemi","Nwachukwu","Balogun","Eze","Okoro"] },

  { code:"GH", name:"Ghana", flag:"🇬🇭", weight:2,
    first:["Kwame","Kofi","Yaw","Nana","Abdul","Joseph"],
    last:["Mensah","Owusu","Boateng","Asante","Appiah","Agyemang"] },

  { code:"CI", name:"Elfenbeinküste", flag:"🇨🇮", weight:1,
    first:["Serge","Franck","Yao","Seydou","Wilfried"],
    last:["Koné","Traoré","Bamba","Yao","Zouhri"] },

  { code:"MA", name:"Marokko", flag:"🇲🇦", weight:2,
    first:["Youssef","Anas","Hamza","Ayoub","Zakaria","Mehdi"],
    last:["El Amrani","Benali","Chakir","Ouahbi","Idrissi","Belkacem"] },

  { code:"US", name:"USA", flag:"🇺🇸", weight:2,
    first:["Tyler","Brandon","Jordan","Cameron","Ethan","Devin"],
    last:["Sullivan","Ramirez","Coleman","Sanders","Bradley","Hoffman"] }
];

const NATIONALITY_BY_CODE = {};
NATIONALITIES.forEach(n => { NATIONALITY_BY_CODE[n.code] = n; });

// Der Verein zieht seinen Nachwuchs ueberwiegend aus dem eigenen Land.
const HOME_NATIONALITY_CODE = "DE";
const YOUTH_HOME_NATIONALITY_CHANCE = 0.6;

const TOTAL_NATIONALITY_WEIGHT = NATIONALITIES.reduce((sum, n) => sum + n.weight, 0);

function pickNationality(){
  let roll = Math.random() * TOTAL_NATIONALITY_WEIGHT;
  for(const nat of NATIONALITIES){
    roll -= nat.weight;
    if(roll <= 0) return nat;
  }
  return NATIONALITIES[0];
}

function pickYouthNationality(){
  if(Math.random() < YOUTH_HOME_NATIONALITY_CHANCE){
    return NATIONALITY_BY_CODE[HOME_NATIONALITY_CODE] || NATIONALITIES[0];
  }
  return pickNationality();
}

// Namen bleiben innerhalb einer Sitzung eindeutig. Bei rund 11.000 moeglichen
// Kombinationen und mehreren hundert Spielern waeren Dubletten sonst haeufig.
const usedPlayerNames = new Set();

function generatePlayerName(nat){
  for(let attempt = 0; attempt < 40; attempt++){
    const name = randChoice(nat.first) + " " + randChoice(nat.last);
    if(!usedPlayerNames.has(name)){
      usedPlayerNames.add(name);
      return name;
    }
  }
  // Notfall: durchnummerierte Initiale, damit garantiert keine Dublette
  // entsteht — auch wenn die Namensreserve knapp wird.
  const initialen = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for(let i = 0; i < initialen.length * 4; i++){
    const initial = initialen[i % initialen.length];
    const name = `${randChoice(nat.first)} ${initial}. ${randChoice(nat.last)}`;
    if(!usedPlayerNames.has(name)){
      usedPlayerNames.add(name);
      return name;
    }
  }
  const fallback = `${randChoice(nat.first)} ${randChoice(nat.last)} ${usedPlayerNames.size}`;
  usedPlayerNames.add(fallback);
  return fallback;
}

function releasePlayerName(name){
  usedPlayerNames.delete(name);
}

function registerExistingNames(players){
  (players || []).forEach(p => { if(p && p.name) usedPlayerNames.add(p.name); });
}

// Weitere Nationen, die nur ueber eine Kaderdatei ins Spiel kommen. Fuer sie
// gibt es keine Namenslisten, aber Flagge und Landesname.
const EXTRA_NATIONALITY_NAMES = {
  CO: "Kolumbien", CA: "Kanada", DZ: "Algerien", GN: "Guinea", BF: "Burkina Faso", CM: "Kamerun",
  TN: "Tunesien", XK: "Kosovo", HU: "Ungarn", SI: "Slowenien", BA: "Bosnien-Herzegowina",
  CD: "DR Kongo", FI: "Finnland", GR: "Griechenland", EE: "Estland", IS: "Island", GM: "Gambia",
  TG: "Togo", UY: "Uruguay", MX: "Mexiko", AU: "Australien", IE: "Irland", SK: "Slowakei",
  UA: "Ukraine", RO: "Rumänien", BG: "Bulgarien", AL: "Albanien", MK: "Nordmazedonien",
  ME: "Montenegro", GE: "Georgien", IL: "Israel", EG: "Ägypten", ML: "Mali", CV: "Kap Verde",
  AO: "Angola", ZA: "Südafrika", EC: "Ecuador", PY: "Paraguay", CL: "Chile", PE: "Peru",
  VE: "Venezuela", JM: "Jamaika", LU: "Luxemburg", LT: "Litauen", LV: "Lettland",
  CN: "China", IR: "Iran", SA: "Saudi-Arabien", GA: "Gabun", ZM: "Sambia"
};
const extraNationalityCache = {};
function getNationality(player){
  const code = player && player.nat;
  if(!code) return null;
  if(NATIONALITY_BY_CODE[code]) return NATIONALITY_BY_CODE[code];
  if(!EXTRA_NATIONALITY_NAMES[code] || !/^[A-Z]{2}$/.test(code)) return null;
  if(!extraNationalityCache[code]){
    extraNationalityCache[code] = { code, name: EXTRA_NATIONALITY_NAMES[code],
      flag: String.fromCodePoint(...[...code].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65)) };
  }
  return extraNationalityCache[code];
}

// Windows liefert keine Flaggen-Glyphen: aus 🇩🇪 werden zwei Buchstaben "DE".
// Deshalb wird die Unterstuetzung einmalig gemessen und sonst auf ein
// lesbares Laenderkuerzel ausgewichen.
let flagSupportCache = null;

function browserSupportsFlags(){
  if(flagSupportCache !== null) return flagSupportCache;
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if(!ctx){ flagSupportCache = false; return false; }
    ctx.font = "16px sans-serif";
    // Wird das Paar zu einer Flagge zusammengesetzt, ist es schmaler als
    // die beiden Einzelzeichen nebeneinander.
    const paar = ctx.measureText("\u{1F1E9}\u{1F1EA}").width;
    const einzeln = ctx.measureText("\u{1F1E9}").width;
    flagSupportCache = paar < einzeln * 1.8;
  } catch(e) {
    flagSupportCache = false;
  }
  return flagSupportCache;
}

// Erlaubt es, die Erkennung zu ueberstimmen — etwa wenn ein System doch
// Flaggen kann, die Messung das aber nicht erkennt.
function setFlagSupport(value){
  flagSupportCache = value === null ? null : !!value;
  return flagSupportCache;
}

function getFlag(player){
  const nat = getNationality(player);
  if(!nat) return "";
  if(browserSupportsFlags()) return nat.flag;
  return `<span class="natCode" title="${nat.name}">${nat.code}</span>`;
}

// Fuer Stellen, an denen kein HTML moeglich ist (etwa title-Attribute).
function getFlagText(player){
  const nat = getNationality(player);
  if(!nat) return "";
  return browserSupportsFlags() ? nat.flag : nat.code;
}
