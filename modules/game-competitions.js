// ============================================
// GAME-COMPETITIONS.JS - Auswertung von Pokal und Europapokal
// ============================================
// Teil der aufgeteilten Spiellogik. Alle Funktionen bleiben global,
// damit die Ladereihenfolge unkritisch bleibt.

function processCupResult(cupResult){
  const roundLabel = CUP_ROUND_LABELS[cupResult.round - 1] || `Runde ${cupResult.round}`;

  if(cupResult.ownMatch){
    const m = cupResult.ownMatch;
    const wonMatch = m.winner === gameState.clubName;
    const scoreText = m.wasDraw
      ? `${m.home} ${m.homeGoals}:${m.awayGoals} ${m.away} (${knockoutSuffix(m)} · weiter: ${m.winner})`
      : `${m.home} ${m.homeGoals}:${m.awayGoals} ${m.away}`;
    addLogEntry(gameState, `🏆 DFB-Pokal ${roundLabel}: ${scoreText}`, wonMatch ? "win" : "loss", true);
    if(m.upset){
      addLogEntry(gameState, wonMatch
        ? "✨ Pokalsensation! Ein Zweitligist wirft einen Erstligisten raus."
        : "😬 Blamage im Pokal — Ausscheiden gegen einen Zweitligisten.");
    }

    if(wonMatch){
      gameState.budget = addToBudget(gameState.budget, CUP_ROUND_BONUS);
      addLogEntry(gameState, `💰 Pokal-Prämie: +${fmtMoney(CUP_ROUND_BONUS)}`);
      addBoardCredit(gameState, BOARD_CUP_ROUND_CREDIT);
      showToast(`🏆 DFB-Pokal: ${roundLabel} gewonnen!`, "success");
    } else {
      showToast(`DFB-Pokal: Ausgeschieden in der ${roundLabel}.`, "info");
    }
  }

  if(cupResult.champion){
    if(cupResult.champion === gameState.clubName){
      gameState.budget = addToBudget(gameState.budget, CUP_CHAMPION_BONUS);
      addLogEntry(gameState, `🏆👑 DFB-Pokal gewonnen! Prämie: +${fmtMoney(CUP_CHAMPION_BONUS)}`, "win", true);
      unlockAchievement("cupWinner");
      showToast("🏆 DFB-POKALSIEGER! Herzlichen Glückwunsch!", "success");
    } else {
      addLogEntry(gameState, `🏆 DFB-Pokal-Sieger dieser Saison: ${cupResult.champion}`, null, true);
    }
  }

  renderCupStatus(gameState);
}

function processEuropeResult(euResult){
  if(euResult.type === "group") return processEuropeGroupResult(euResult);
  return processEuropeKnockoutResult(euResult);
}

function processEuropeGroupResult(res){
  const m = res.ownMatch;
  if(m){
    const scoreText = m.isHome
      ? `${gameState.clubName} ${m.ownGoals}:${m.oppGoals} ${m.opponent}`
      : `${m.opponent} ${m.oppGoals}:${m.ownGoals} ${gameState.clubName}`;
    addLogEntry(gameState, `\u{1F30D} Europapokal Gruppe ${gameState.europe.ownGroup}, Spieltag ${res.matchday}/${res.totalMatchdays}: ${scoreText}`, m.result, true);

    const bonus = m.result === "win" ? EUROPE_GROUP_WIN_BONUS
                : m.result === "draw" ? EUROPE_GROUP_DRAW_BONUS : 0;
    if(bonus > 0){
      gameState.budget = addToBudget(gameState.budget, bonus);
      addLogEntry(gameState, `\u{1F4B0} Europapokal-Prämie: +${fmtMoney(bonus)}`);
    }
    if(res.ownStanding){
      showToast(`\u{1F30D} Gruppe ${res.ownStanding.groupName}: Platz ${res.ownStanding.position} nach ${res.matchday} Spielen.`,
        m.result === "win" ? "success" : "info");
    }
  }

  if(res.groupStageFinished){
    const st = res.ownStanding;
    if(res.qualifiedForKnockout){
      gameState.budget = addToBudget(gameState.budget, EUROPE_QUALIFY_BONUS);
      addLogEntry(gameState, `\u{1F30D} Gruppenphase als ${st ? st.position + "." : ""} abgeschlossen — Achtelfinale erreicht! Prämie: +${fmtMoney(EUROPE_QUALIFY_BONUS)}`, "win", true);
      showToast("\u{1F30D} Achtelfinale erreicht!", "success");
    } else {
      addLogEntry(gameState, `\u{1F30D} In der Gruppenphase ausgeschieden (Platz ${st ? st.position : "?"} in Gruppe ${st ? st.groupName : "?"}).`, "loss", true);
      showToast("Europapokal: in der Gruppenphase ausgeschieden.", "info");
      announceEuropeWinner();
    }
  }

  renderEuropeStatus(gameState);
}

function processEuropeKnockoutResult(res){
  const m = res.ownMatch;
  if(m){
    const scoreText = m.wasDraw
      ? `${gameState.clubName} ${m.ownGoals}:${m.oppGoals} ${m.opponent} (${m.suffix || "n.V."}: ${m.won ? "weiter" : "ausgeschieden"})`
      : `${gameState.clubName} ${m.ownGoals}:${m.oppGoals} ${m.opponent}`;
    addLogEntry(gameState, `\u{1F30D} Europapokal ${res.roundLabel}: ${scoreText}`, m.won ? "win" : "loss", true);

    if(m.won){
      gameState.budget = addToBudget(gameState.budget, EUROPE_ROUND_BONUS);
      addLogEntry(gameState, `\u{1F4B0} Europapokal-Prämie: +${fmtMoney(EUROPE_ROUND_BONUS)}`);
      addBoardCredit(gameState, BOARD_EUROPE_ROUND_CREDIT);
      showToast(`\u{1F30D} ${res.roundLabel} gewonnen!`, "success");
    } else {
      showToast(`Europapokal: im ${res.roundLabel} ausgeschieden.`, "info");
    }
  }

  if(res.champion){
    gameState.budget = addToBudget(gameState.budget, EUROPE_CHAMPION_BONUS);
    addLogEntry(gameState, `\u{1F30D}\u{1F451} Europapokal gewonnen! Prämie: +${fmtMoney(EUROPE_CHAMPION_BONUS)}`, "win", true);
    unlockAchievement("europeChampion");
    showToast("\u{1F30D} EUROPAPOKALSIEGER! Herzlichen Glückwunsch!", "success");
  } else if(m && !m.won){
    announceEuropeWinner();
  }

  renderEuropeStatus(gameState);
}

function announceEuropeWinner(){
  const winner = gameState.europe && gameState.europe.winnerName;
  if(winner && winner !== gameState.clubName){
    addLogEntry(gameState, `\u{1F30D} Europapokalsieger dieser Saison: ${winner}`);
  }
}
