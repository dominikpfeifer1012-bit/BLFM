// ============================================
// UI-MARKET.JS - Transfermarkt: Suche im Weltbestand, Kauf und Verkauf
// ============================================
// Teil der aufgeteilten Oberflaeche. Alle Funktionen bleiben global,
// damit die Ladereihenfolge unkritisch bleibt.

let poolFilters = { pos:"ALL", nat:"ALL", minAge:16, maxAge:38, minStrength:0,
  maxFeeMio:200, search:"", freeOnly:false, expiringOnly:false, willingOnly:true };

let poolSort = { key:"strength", dir:"desc" };

const POOL_PAGE_SIZE = 25;

let poolPage = 0;

function readPoolFilters(){
  const v = id => { const el = document.getElementById(id); return el ? el.value : null; };
  const c = id => { const el = document.getElementById(id); return el ? el.checked : false; };
  poolFilters = {
    pos: v("poolPos") || "ALL",
    nat: v("poolNat") || "ALL",
    minAge: parseInt(v("poolMinAge")) || 16,
    maxAge: parseInt(v("poolMaxAge")) || 38,
    minStrength: parseInt(v("poolMinStrength")) || 0,
    maxFeeMio: parseFloat(v("poolMaxFee")) || 200,
    search: v("poolSearch") || "",
    freeOnly: c("poolFreeOnly"),
    expiringOnly: c("poolExpiringOnly"),
    willingOnly: c("poolWillingOnly")
  };
  poolPage = 0;
  renderMarket(gameState);
}

function poolSortBy(key){
  if(poolSort.key === key) poolSort.dir = poolSort.dir === "asc" ? "desc" : "asc";
  else { poolSort.key = key; poolSort.dir = (key === "name" || key === "pos" || key === "age") ? "asc" : "desc"; }
  renderMarket(gameState);
}

function poolSortArrow(key){
  if(poolSort.key !== key) return "";
  return poolSort.dir === "asc" ? " ▲" : " ▼";
}

function poolTurnPage(delta){
  poolPage += delta;
  renderMarket(gameState);
}

function renderMarket(gameState){
  const container = document.getElementById("marketList");
  if(!container) return;
  const pool = gameState.pool;
  if(!pool){ container.innerHTML = `<p class="muted">Kein Spielerbestand geladen.</p>`; return; }

  const tw = checkTransferWindow(gameState);
  const stats = getPoolStats(pool);

  const treffer = filterPool(pool, {
    pos: poolFilters.pos, nat: poolFilters.nat,
    minAge: poolFilters.minAge, maxAge: poolFilters.maxAge,
    minStrength: poolFilters.minStrength,
    maxFee: Math.round(poolFilters.maxFeeMio * 1000000),
    search: poolFilters.search,
    freeOnly: poolFilters.freeOnly, expiringOnly: poolFilters.expiringOnly
  }).filter(p => !poolFilters.willingOnly || isWillingToJoin(gameState, p));
  const sortiert = sortPoolResults(treffer, poolSort.key, poolSort.dir);

  const seiten = Math.max(1, Math.ceil(sortiert.length / POOL_PAGE_SIZE));
  if(poolPage >= seiten) poolPage = seiten - 1;
  if(poolPage < 0) poolPage = 0;
  const seite = sortiert.slice(poolPage * POOL_PAGE_SIZE, (poolPage + 1) * POOL_PAGE_SIZE);

  const hinweis = tw.open
    ? `<p class="muted" style="margin:0 0 12px;">Transferfenster offen bis Spieltag ${getCurrentWindowEnd(gameState.matchday + 1)} · <b>${stats.gelistet}</b> von ${stats.gesamt} Spielern sind diese Saison zu haben, davon ${stats.frei} ablösefrei. Zu ${gameState.clubName} wechseln Spieler bis Stärke <b>${getTransferInterestLimit(gameState)}</b>.</p>`
    : `<p style="margin:0 0 12px; color:#FCA311;">🔒 ${tw.message} Du kannst suchen, aber nicht verpflichten.</p>`;

  const natOptionen = ['<option value="ALL">Alle Länder</option>'].concat(
    NATIONALITIES.map(n => `<option value="${n.code}"${poolFilters.nat === n.code ? " selected" : ""}>${n.flag} ${n.name}</option>`)
  ).join("");
  const posOptionen = ['<option value="ALL">Alle Positionen</option>'].concat(
    POSITION_ORDER.map(pos => `<option value="${pos}"${poolFilters.pos === pos ? " selected" : ""}>${POSITION_ICONS[pos]} ${pos}</option>`)
  ).join("");

  let html = hinweis + `
  <div class="filterBar">
    <select id="poolPos" onchange="readPoolFilters()">${posOptionen}</select>
    <select id="poolNat" onchange="readPoolFilters()">${natOptionen}</select>
    <label>Alter <input type="number" id="poolMinAge" value="${poolFilters.minAge}" style="width:52px;" onchange="readPoolFilters()">
      – <input type="number" id="poolMaxAge" value="${poolFilters.maxAge}" style="width:52px;" onchange="readPoolFilters()"></label>
    <label>ab Bewertung <input type="number" id="poolMinStrength" value="${poolFilters.minStrength}" style="width:56px;" onchange="readPoolFilters()"></label>
    <label>bis <input type="number" id="poolMaxFee" value="${poolFilters.maxFeeMio}" style="width:62px;" step="0.5" onchange="readPoolFilters()"> Mio. €</label>
    <label><input type="checkbox" id="poolFreeOnly"${poolFilters.freeOnly ? " checked" : ""} onchange="readPoolFilters()"> nur ablösefrei</label>
    <label><input type="checkbox" id="poolExpiringOnly"${poolFilters.expiringOnly ? " checked" : ""} onchange="readPoolFilters()"> Vertrag läuft aus</label>
    <label><input type="checkbox" id="poolWillingOnly"${poolFilters.willingOnly ? " checked" : ""} onchange="readPoolFilters()"> nur Wechselwillige</label>
    <input type="text" id="poolSearch" placeholder="Name oder Verein..." value="${poolFilters.search}" oninput="readPoolFilters()" style="min-width:150px;">
    <button class="ghost" onclick="resetPoolFilters()">Filter zurücksetzen</button>
  </div>`;

  if(sortiert.length === 0){
    html += `<p class="muted" style="text-align:center; padding:18px 0;">Kein Spieler passt zu diesen Kriterien.</p>`;
  } else {
    html += `<p class="muted" style="margin:0 0 8px;">${sortiert.length} Treffer${seiten > 1 ? ` · Seite ${poolPage + 1} von ${seiten}` : ""}</p>
    <div class="tableWrap"><table>
      <tr>
        <th class="sortable" onclick="poolSortBy('pos')">Pos${poolSortArrow('pos')}</th>
        <th class="sortable" onclick="poolSortBy('name')">Name${poolSortArrow('name')}</th>
        <th>Verein</th>
        <th class="n sortable" onclick="poolSortBy('strength')">Bew.${poolSortArrow('strength')}</th>
        <th class="n sortable" onclick="poolSortBy('potential')">Pot.${poolSortArrow('potential')}</th>
        <th class="n sortable" onclick="poolSortBy('age')">Alter${poolSortArrow('age')}</th>
        <th>Stärken</th>
        <th class="n sortable" onclick="poolSortBy('fee')">Ablöse${poolSortArrow('fee')}</th>
        <th class="n">Gehalt</th>
        <th></th>
      </tr>`;

    seite.forEach(p => {
      const fee = getTransferFee(p);
      const bezahlbar = fee <= gameState.budget;
      const interesse = isWillingToJoin(gameState, p);
      const vereinsText = p.clubName
        ? `${p.clubName}${isContractExpiring(p) ? ' <span class="tagIcon" title="Vertrag läuft aus">📝</span>' : ""}`
        : `<span style="color:var(--win);">ablösefrei</span>`;
      const rest = Math.max(0, Math.round(p.maxStrength - p.strength));

      html += `<tr class="rowLink" onclick="showPoolPlayerDetail('${p.id}')">
        <td><b>${POSITION_ICONS[p.pos] || ""} ${p.pos}</b></td>
        <td>${getFlag(p)} ${p.name}${p.isScoutingFind ? ' <span title="Scouting-Fund">🔍</span>' : ""}</td>
        <td style="font-size:12px;">${vereinsText}</td>
        <td class="n">${Math.round(p.strength)}</td>
        <td class="n" style="color:${rest > 8 ? "var(--win)" : "var(--ink-faint)"};">+${rest}</td>
        <td class="n">${p.age}</td>
        <td>${topAttributeTags(p)}</td>
        <td class="n"${bezahlbar ? "" : ' style="color:var(--loss);"'}>${fmtMoney(fee)}</td>
        <td class="n">${fmtMoney(calculatePlayerSalary(p.strength, p.age))}</td>
        <td>${interesse
          ? `<button onclick="event.stopPropagation(); handleSignPlayer('${p.id}')"${tw.open && bezahlbar ? "" : " disabled"}>Holen</button>`
          : `<button class="ghost" disabled title="Spieler wechseln bis Stärke ${getTransferInterestLimit(gameState)}">Kein Interesse</button>`}</td>
      </tr>`;
    });
    html += `</table></div>`;

    if(seiten > 1){
      html += `<div style="display:flex; gap:8px; justify-content:center; margin-top:12px;">
        <button class="ghost" onclick="poolTurnPage(-1)"${poolPage === 0 ? " disabled" : ""}>Zurück</button>
        <button class="ghost" onclick="poolTurnPage(1)"${poolPage >= seiten - 1 ? " disabled" : ""}>Weiter</button>
      </div>`;
    }
  }

  // Eigener Kader zum Verkauf
  html += `<h4 style="margin-top:22px;">Eigener Kader</h4>
    <div class="tableWrap"><table><tr><th>Pos</th><th>Name</th><th class="n">Bew.</th><th class="n">Alter</th>
    <th class="n">Marktwert</th><th class="n">Erlös</th><th></th></tr>`;
  sortSquadByPosition(gameState.squad).forEach(p => {
    const idx = gameState.squad.indexOf(p);
    html += `<tr><td><b>${POSITION_ICONS[p.pos] || ""} ${p.pos}</b></td><td>${getFlag(p)} ${p.name}</td>
      <td class="n">${Math.round(p.strength)}</td><td class="n">${p.age}</td>
      <td class="n">${fmtMoney(p.value)}</td><td class="n">${fmtMoney(calculateSellValue(p.value))}</td>
      <td><button onclick="handleSellClick(this, ${idx})"${tw.open ? "" : " disabled"}>Verkaufen</button></td></tr>`;
  });
  html += `</table></div>`;

  container.innerHTML = html;
}

function resetPoolFilters(){
  poolFilters = { pos:"ALL", nat:"ALL", minAge:16, maxAge:38, minStrength:0,
    maxFeeMio:200, search:"", freeOnly:false, expiringOnly:false, willingOnly:true };
  poolPage = 0;
  renderMarket(gameState);
}

// Profil eines Spielers aus dem Bestand — gleiche Darstellung wie im Kader,
// aber mit Ablöse statt Verkaufsknopf.

// Profil eines Spielers aus dem Bestand — gleiche Darstellung wie im Kader,
// aber mit Ablöse statt Verkaufsknopf.
function showPoolPlayerDetail(playerId){
  const player = getPoolPlayer(gameState.pool, playerId);
  if(!player) return;
  const nat = getNationality(player);
  const fee = getTransferFee(player);
  const tw = checkTransferWindow(gameState);
  const bezahlbar = fee <= gameState.budget;
  const interesse = isWillingToJoin(gameState, player);

  const stat = (k, v, sub) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>`;

  document.getElementById("playerModalContent").innerHTML = `
    <div class="profHead">
      <span class="profFlag">${getFlag(player) || "⚽"}</span>
      <div class="profName">
        <h3>${player.name}</h3>
        <p class="muted" style="margin:0;">${POSITION_ICONS[player.pos] || ""} ${player.pos} · ${player.age} Jahre${nat ? ` · ${nat.name}` : ""}</p>
        <p class="muted" style="margin:2px 0 0;">${player.clubName || "vereinslos"}</p>
      </div>
      <div class="profRating"><div class="v">${Math.round(player.strength)}</div><div class="k">Bewertung</div></div>
    </div>

    <p class="eyebrow">Attribute</p>
    <div style="margin:6px 0 16px;">
      ${ATTRIBUTES.map(a => {
        const wert = player.attributes ? player.attributes[a] : 0;
        const cap = player.maxAttributes ? player.maxAttributes[a] : wert;
        const wichtig = ((POSITION_WEIGHTS[player.pos] || {})[a] || 0) >= 0.30;
        return `<div style="display:flex; align-items:center; gap:9px; margin-bottom:6px;">
          <span style="width:15px;">${ATTRIBUTE_ICONS[a]}</span>
          <span style="flex:0 0 74px; font-size:12px; color:${wichtig ? "var(--gold)" : "var(--ink-dim)"};">${ATTRIBUTE_LABELS[a]}</span>
          <span class="bar" style="flex:1;"><i class="ghost" style="width:${cap}%;"></i><i style="width:${wert}%; position:relative;"></i></span>
          <span class="num" style="width:52px; text-align:right; font-size:12px;">${Math.round(wert)}<span style="color:var(--ink-faint);">/${Math.round(cap)}</span></span>
        </div>`;
      }).join("")}
    </div>

    <div class="statGrid">
      ${stat("Ablöse", fmtMoney(fee), player.clubName ? "inkl. Aufschlag" : "Handgeld")}
      ${stat("Gehalt", fmtMoney(calculatePlayerSalary(player.strength, player.age)), "pro Saison")}
      ${stat("Potenzial", `+${Math.max(0, Math.round(player.maxStrength - player.strength))}`, `bis ${Math.round(player.maxStrength)}`)}
      ${stat("Vertrag", `${getContractYears(player)} J.`, isContractExpiring(player) ? "läuft aus" : "")}
    </div>

    ${player.isScoutingFind ? '<div class="profTags"><span class="profTag gold">🔍 Scouting-Fund</span></div>' : ""}

    <div style="margin-top:14px;">
      <button onclick="handleSignPlayer('${player.id}')"${tw.open && bezahlbar && interesse ? "" : " disabled"}>
        Verpflichten · ${fmtMoney(fee)}
      </button>
      ${!tw.open ? '<p class="muted" style="margin:8px 0 0;">Transferfenster geschlossen.</p>' : ""}
      ${tw.open && !interesse ? `<p class="muted" style="margin:8px 0 0; color:var(--loss);">Kein Interesse: ${gameState.clubName} ist ihm zu klein. Spieler wechseln bis Stärke ${getTransferInterestLimit(gameState)}.</p>` : ""}
      ${tw.open && interesse && !bezahlbar ? `<p class="muted" style="margin:8px 0 0; color:var(--loss);">Budget reicht nicht (${fmtMoney(gameState.budget)} verfügbar).</p>` : ""}
    </div>
  `;
  document.getElementById("playerModalOverlay").classList.add("show");
}

function handleSellClick(btnEl, squadIndex){
  if(btnEl.dataset.confirm === "1"){
    handleSellPlayer(squadIndex);
    return;
  }
  btnEl.dataset.confirm = "1";
  const original = btnEl.textContent;
  btnEl.textContent = "Sicher? ✔";
  btnEl.style.background = "#e63946";
  btnEl.style.color = "#fff";
  setTimeout(() => {
    if(document.body.contains(btnEl)){
      btnEl.dataset.confirm = "0";
      btnEl.textContent = original;
      btnEl.style.background = "";
      btnEl.style.color = "";
    }
  }, 3000);
}
