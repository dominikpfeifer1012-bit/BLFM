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
    addLogEntry(gameState, `🏆 ${getCupName(gameState)} ${roundLabel}: ${scoreText}`, wonMatch ? "win" : "loss", true);
    if(m.upset){
      addLogEntry(gameState, wonMatch
        ? "✨ Pokalüberraschung gegen einen höherklassigen Gegner"
        : "😬 Pokal-Aus gegen einen unterklassigen Gegner");
    }

    if(wonMatch){
      gameState.budget = addToBudget(gameState.budget, CUP_ROUND_BONUS);
      addLogEntry(gameState, `💰 Pokal-Prämie: +${fmtMoney(CUP_ROUND_BONUS)}`);
      addBoardCredit(gameState, BOARD_CUP_ROUND_CREDIT);
      showToast(`🏆 ${getCupName(gameState)}: ${roundLabel} gewonnen`, "success");
    } else {
      showToast(`${getCupName(gameState)}: Aus in der ${roundLabel}`, "info");
    }
  }

  if(cupResult.champion){
    if(cupResult.champion === gameState.clubName){
      gameState.budget = addToBudget(gameState.budget, CUP_CHAMPION_BONUS);
      addLogEntry(gameState, `🏆👑 ${getCupName(gameState)} gewonnen · Prämie ${fmtMoney(CUP_CHAMPION_BONUS)}`, "win", true);
      unlockAchievement("cupWinner");
      showToast(`🏆 ${getCupName(gameState)} gewonnen`, "success");
    } else {
      addLogEntry(gameState, `🏆 ${getCupName(gameState)}-Sieger dieser Saison: ${cupResult.champion}`, null, true);
    }
  }

  renderCupStatus(gameState);
}
