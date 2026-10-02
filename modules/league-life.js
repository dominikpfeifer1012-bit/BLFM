// ============================================
// LEAGUE-LIFE.JS - Trainer, Liga-News, Auszeichnungen, Kapitaen, Schwierigkeit
// ============================================
// Die Liga stand bisher still, sobald man auf den eigenen Verein schaute.
// Jetzt haben alle Vereine Trainer, Krisenclubs wechseln sie, andere
// Vereine handeln untereinander, und am Saisonende gibt es Auszeichnungen.

// ---------- Schwierigkeitsgrade ----------

function getDifficulty(gameState){
  return DIFFICULTIES[(gameState && gameState.difficulty) || "normal"] || DIFFICULTIES.normal;
}

// ---------- Trainer der anderen Vereine ----------

function generateCoachName(heimat){
  const code = heimat || "DE";
  const nat = Math.random() < 0.6 ? (NATIONALITY_BY_CODE[code] || pickNationality()) : pickNationality();
  return { name: generatePlayerName(nat), nat: nat.code };
}

// Fehlende Trainer anlegen (neue Karriere, alte Spielstaende, Aufsteiger).
// Importierte Trainer aus einer Kaderdatei haben Vorrang.
function ensureCoaches(gameState){
  gameState.coaches = gameState.coaches || {};
  ensureLeaguePools(gameState);
  const importiert = typeof getCustomCoach === "function" ? getCustomCoach : () => null;
  gameState.leaguePools.forEach((pool, idx) => pool.forEach(c => {
    if(c.name === gameState.clubName || gameState.coaches[c.name]) return;
    const echt = importiert(c.name);
    gameState.coaches[c.name] = echt ? { name: echt, nat: null, since: gameState.season }
      : Object.assign(generateCoachName(getCountryConfig(getDivisionCountry(idx + 1)).nat), { since: gameState.season });
  }));
  return gameState.coaches;
}

function getCoachName(gameState, clubName){
  const c = ensureCoaches(gameState)[clubName];
  return c ? c.name : null;
}

// ---------- Nachrichten ----------

function addNews(gameState, text, icon){
  gameState.news = gameState.news || [];
  gameState.news.unshift({ season: gameState.season, matchday: gameState.matchday, icon: icon || "📰", text });
  if(gameState.news.length > NEWS_MAX) gameState.news.length = NEWS_MAX;
}

// Krisenclubs trennen sich von ihrem Trainer — an den Bewertungsterminen.
function checkCoachChanges(gameState){
  if(!getBoardCheckpoints(gameState).includes(gameState.matchday)) return;
  ensureCoaches(gameState);
  const tabellen = [gameState.teams, ...Object.values(gameState.shadowLeagues || {}).map(s => s.teams || [])];
  tabellen.forEach(teams => {
    const sortiert = getSortedStandings(teams || []);
    sortiert.slice(-3).forEach(t => {
      if(t.name === gameState.clubName || Math.random() > COACH_FIRE_CHANCE) return;
      const alt = gameState.coaches[t.name];
      const nr = getClubDivision(gameState, t.name);
      const land = nr ? getDivisionCountry(nr) : "de";
      const neu = Object.assign(generateCoachName(getCountryConfig(land).nat), { since: gameState.season });
      gameState.coaches[t.name] = neu;
      // Nachrichten nur aus dem eigenen Land, sonst wird die Liste zur Flut.
      if(land === getOwnCountry(gameState)) addNews(gameState, `${t.name} trennt sich nach Platz ${sortiert.indexOf(t) + 1} von ${alt ? alt.name : "seinem Trainer"}. Nachfolger: ${neu.name}.`, "🔄");
    });
  });
}

// Andere Vereine handeln untereinander, wenn ein Transferfenster aufgeht.
function simulateAiTransfers(gameState){
  if(!gameState.pool || !getTransferWindows(gameState).some(([start]) => start === gameState.matchday + 1)) return;
  const vereine = buildPoolClubList(gameState);
  const staerke = Object.fromEntries(vereine.map(c => [c.name, c]));
  const kandidaten = shuffleArray(gameState.pool.players.filter(p =>
    p.clubName && staerke[p.clubName] && p.strength >= 66 && staerke[p.clubName].strength < p.strength - 2));
  let n = 0;
  for(const p of kandidaten){
    if(n >= AI_TRANSFERS_PER_WINDOW) break;
    const ziele = vereine.filter(c => c.name !== p.clubName && c.strength >= p.strength - 4 && c.strength <= p.strength + 8);
    if(ziele.length === 0) continue;
    const ziel = randChoice(ziele);
    const fee = Math.round(p.value * randFloat(1.0, 1.5) / 50000) * 50000;
    addNews(gameState, `${p.name} (${p.pos}, ${Math.round(p.strength)}) wechselt für ${fmtMoney(fee)} von ${p.clubName} zu ${ziel.name}.`, "💼");
    p.clubName = ziel.name; p.clubTier = ziel.tier; p.transferListed = false;
    n++;
  }
}

function renderNewsPanel(gameState){
  const el = document.getElementById("newsPanel");
  if(!el) return;
  const news = (gameState.news || []).slice(0, 8);
  el.innerHTML = news.length === 0
    ? '<p class="muted" style="margin:0;">Noch keine Meldungen. Trainerwechsel und Transfers anderer Vereine erscheinen hier.</p>'
    : news.map(n => `<div class="newsRow"><span class="newsIcon">${n.icon}</span><span>${n.text}<span class="muted" style="font-size:11px;"> · ${n.matchday ? "Spieltag " + n.matchday : "Sommer"} ${n.season}/${String(n.season + 1).slice(2)}</span></span></div>`).join("");
}

// ---------- Auszeichnungen ----------

function markSeasonStart(gameState){
  (gameState.squad || []).forEach(p => { p.seasonStartStrength = p.strength; });
}

function computeSeasonAwards(gameState){
  const kader = gameState.squad || [];
  const awards = {};
  const wert = p => p.strength + (p.goalsSeason || 0) * 1.0 + Math.max(0, p.strength - (p.seasonStartStrength != null ? p.seasonStartStrength : p.strength)) * 1.5;
  // Mit genug Einsaetzen entscheidet der Notenschnitt, sonst die Leistungsdaten.
  const benotet = kader.filter(p => (p.gradeCount || 0) >= 10)
    .sort((a, b) => getAverageGrade(a) - getAverageGrade(b) || (b.motmCount || 0) - (a.motmCount || 0));
  const bester = benotet[0] || [...kader].sort((a, b) => wert(b) - wert(a))[0];
  if(bester) awards.playerOfSeason = { name: bester.name, pos: bester.pos,
    info: bester.gradeCount >= 10
      ? `Note ${fmtGrade(getAverageGrade(bester))} · ${bester.goalsSeason || 0} Tore${bester.motmCount ? ` · ${bester.motmCount}× bester Spieler` : ""}`
      : `${Math.round(bester.strength)} · ${bester.goalsSeason || 0} Tore` };

  const zuwachs = p => p.seasonStartStrength != null ? p.strength - p.seasonStartStrength : 0;
  const talent = kader.filter(p => p.age <= 21 && zuwachs(p) >= 2).sort((a, b) => zuwachs(b) - zuwachs(a))[0];
  if(talent) awards.discovery = { name: talent.name, pos: talent.pos, info: `${talent.age} J. · +${Math.round(zuwachs(talent))} in dieser Saison` };

  const torjaeger = getLeagueTopScorers(gameState, 1)[0];
  if(torjaeger) awards.topScorer = { name: torjaeger.name, club: torjaeger.club, info: `${torjaeger.goals} Tore` };

  // Elf der Saison der eigenen Liga (4-4-2)
  const liga = new Set((gameState.teams || []).map(t => t.name));
  const kandidaten = [
    ...kader.map(p => ({ p, club: gameState.clubName })),
    ...((gameState.pool && gameState.pool.players) || []).filter(p => liga.has(p.clubName)).map(p => ({ p, club: p.clubName }))
  ];
  const benutzt = new Set();
  awards.team = TEAM_OF_SEASON_SLOTS.map(slot => {
    const wahl = kandidaten.filter(k => slot.pos.includes(k.p.pos) && !benutzt.has(k.p.id))
      .sort((a, b) => (b.p.strength + (b.p.goalsSeason || 0) * 0.5) - (a.p.strength + (a.p.goalsSeason || 0) * 0.5))[0];
    if(!wahl) return null;
    benutzt.add(wahl.p.id);
    return { slot: slot.label, name: wahl.p.name, club: wahl.club, own: wahl.club === gameState.clubName, strength: Math.round(wahl.p.strength) };
  }).filter(Boolean);
  return awards;
}

function renderAwards(awards){
  if(!awards) return "";
  const zeile = (icon, titel, a, extra) => a ? `<div class="stat"><div class="k">${icon} ${titel}</div><div class="v" style="font-size:15px; font-family:var(--body);">${a.name}</div><div class="sub">${extra || a.info}</div></div>` : "";
  const elf = (awards.team || []).map(t => `<span class="teamTag${t.own ? " own" : ""}" title="${t.club}">${t.slot} ${t.name}</span>`).join("");
  return `<p class="eyebrow">Auszeichnungen</p>
    <div class="statGrid" style="margin-bottom:10px;">
      ${zeile("⭐", "Spieler der Saison", awards.playerOfSeason)}
      ${zeile("🌱", "Entdeckung", awards.discovery)}
      ${zeile("⚽", "Torschützenkönig", awards.topScorer, awards.topScorer ? `${awards.topScorer.club} · ${awards.topScorer.info}` : "")}
    </div>
    ${elf ? `<p class="eyebrow">Elf der Saison</p><div class="teamOfSeason">${elf}</div>` : ""}`;
}

// ---------- Kapitaen ----------

function getCaptain(gameState){
  const kader = gameState.squad || [];
  let kapitaen = kader.find(p => p.id === gameState.captainId);
  if(!kapitaen && kader.length){
    // Ohne Wahl: erfahrener Leistungstraeger
    kapitaen = [...kader].sort((a, b) => (b.strength + Math.min(b.age, 32) * 0.6) - (a.strength + Math.min(a.age, 32) * 0.6))[0];
    gameState.captainId = kapitaen.id;
  }
  return kapitaen || null;
}

function setCaptain(gameState, playerId){
  const neu = (gameState.squad || []).find(p => p.id === playerId);
  if(!neu) return { success: false, message: "Spieler nicht gefunden." };
  const alt = (gameState.squad || []).find(p => p.id === gameState.captainId);
  if(alt && alt.id === neu.id) return { success: false, message: `${neu.name} ist bereits Kapitän.` };
  if(alt) setMorale(alt, getMorale(alt) - CAPTAIN_DEPOSED_MORALE);
  setMorale(neu, getMorale(neu) + CAPTAIN_APPOINTED_MORALE);
  gameState.captainId = neu.id;
  return { success: true, message: `©️ ${neu.name} ist neuer Kapitän${alt ? ` — ${alt.name} ist enttäuscht` : ""}.` };
}

// Ein zufriedener Kapitaen in der Startelf hebt die Stimmung, ein
// unzufriedener zieht sie nach unten.
function applyCaptainInfluence(gameState, xiIds){
  const k = getCaptain(gameState);
  if(!k || !xiIds.has(k.id)) return;
  const wirkung = (getMorale(k) - MORALE_NEUTRAL) / 30 * CAPTAIN_MORALE_PULL;
  (gameState.squad || []).forEach(p => { if(p.id !== k.id) setMorale(p, getMorale(p) + wirkung); });
}

function handleSetCaptain(playerId){
  const r = setCaptain(gameState, playerId);
  showToast(r.message, r.success ? "success" : "info");
  if(r.success){ addLogEntry(gameState, r.message); showPlayerDetail(playerId); refreshSquadViews(); }
}
