// ============================================
// UI-SAVE.JS - Spielstaende: Platzauswahl, Export und Import
// ============================================
// Teil der aufgeteilten Oberflaeche. Alle Funktionen bleiben global,
// damit die Ladereihenfolge unkritisch bleibt.

function openSaveModal(){
  renderSaveSlots();
  document.getElementById("saveOverlay").classList.add("show");
}

function closeSaveModal(){
  document.getElementById("saveOverlay").classList.remove("show");
}

function renderSaveSlots(){
  const el = document.getElementById("saveSlotList");
  if(!el) return;

  const aktiv = gameState ? gameState.saveSlot : null;
  const auto = readAutoSaveInfo();
  const autoZeile = auto ? `<div class="lineupOption" style="cursor:default;">
      <span style="flex:1;">
        <b>Automatisch</b> <span class="muted" style="font-size:11px;">nach jedem Spieltag</span>
        <br>${auto.label}<br><span class="muted" style="font-size:11px;">Spieltag ${(auto.matchday || 0) + 1}${auto.savedAt ? " · " + new Date(auto.savedAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : ""}</span>
      </span>
      <span style="display:flex; gap:6px; flex-wrap:wrap;">
        <button class="ghost" onclick="handleLoadFromSlot(AUTOSAVE_SLOT)">Laden</button>
      </span>
    </div>` : "";
  el.innerHTML = autoZeile + listSaveSlots().map(p => {
    const datum = p.savedAt
      ? new Date(p.savedAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })
      : null;
    const beschreibung = p.belegt
      ? `${p.label}<br><span class="muted" style="font-size:11px;">Spieltag ${(p.matchday || 0) + 1}${datum ? " · " + datum : ""}</span>`
      : '<span class="muted">leer</span>';

    return `<div class="lineupOption${p.slot === aktiv ? " auto" : ""}" style="cursor:default;">
      <span style="flex:1;">
        <b>Platz ${p.slot}</b>${p.slot === aktiv ? ' <span class="badge win">aktiv</span>' : ""}
        <br>${beschreibung}
      </span>
      <span style="display:flex; gap:6px; flex-wrap:wrap;">
        <button class="ghost" onclick="handleSaveToSlot(${p.slot})">Speichern</button>
        <button class="ghost" onclick="handleLoadFromSlot(${p.slot})"${p.belegt ? "" : " disabled"}>Laden</button>
        <button class="ghost" onclick="handleDeleteSlot(${p.slot})"${p.belegt ? "" : " disabled"}>Löschen</button>
      </span>
    </div>`;
  }).join("");
}
