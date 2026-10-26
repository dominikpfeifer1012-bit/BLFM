// Versionskennung: Seite, Module und config.js muessen zusammenpassen.
// Sonst mischt der Browser nach einem Update alte und neue Dateien aus
// seinem Speicher, und das Spiel bricht an vielen Stellen ab.
const fs=require("fs"); const path=require("path");
const root=path.join(__dirname, "..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const config=fs.readFileSync(path.join(root,"modules","config.js"),"utf8");
let fails=0;
function check(l, fn){ const r=fn(); const ok=r===true; console.log(`${ok?"OK  ":"FAIL"}  ${l}${ok?"":" -> "+r}`); if(!ok) fails++; }

const seite=(html.match(/window\.BLFM_BUILD = "([^"]+)"/)||[])[1];
const modul=(config.match(/const GAME_BUILD = "([^"]+)"/)||[])[1];
const tags=[...html.matchAll(/<script src="modules\/([a-z-]+\.js)(\?v=([^"]+))?"><\/script>/g)];
const css=[...html.matchAll(/href="modules\/([a-z-]+\.css)(\?v=([^"]+))?"/g)];

check("Seite hat eine Versionskennung", () => seite ? true : "BLFM_BUILD fehlt");
check("config.js hat dieselbe Kennung", () => modul===seite ? true : `${modul} / ${seite}`);
check("Jedes Modul trägt die Kennung", () => {
  const ohne=tags.filter(t=>t[3]!==seite).map(t=>t[1]);
  return tags.length>30 && !ohne.length ? true : `ohne/abweichend: ${ohne.join(", ")}`;
});
check("Auch das Stylesheet", () => css.every(c=>c[3]===seite) ? true : "fonts.css ohne Kennung");
check("Alle Module im Ordner sind eingebunden", () => {
  const dateien=fs.readdirSync(path.join(root,"modules")).filter(f=>f.endsWith(".js"));
  const fehlen=dateien.filter(f=>!tags.some(t=>t[1]===f));
  return fehlen.length ? `nicht eingebunden: ${fehlen.join(", ")}` : true;
});

console.log(fails===0?"\nAlle Prüfungen bestanden.":`\n${fails} Prüfung(en) fehlgeschlagen.`);
process.exit(fails?1:0);
