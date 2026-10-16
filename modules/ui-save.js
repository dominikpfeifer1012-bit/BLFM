// ============================================
// UI-SAVE.JS - Spielstaende: Platzauswahl, Export und Import
// ============================================
// Teil der aufgeteilten Oberflaeche. Alle Funktionen bleiben global,
// damit die Ladereihenfolge unkritisch bleibt.

// ---------- Anzeigegroesse ----------
// Wirkt wie der Browser-Zoom, wird je Geraet gespeichert.
const UI_SCALES = [0.7, 0.8, 0.9, 1, 1.1];

function getUiScale(){
  const s = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale"));
  return s > 0 ? s : 1;
}

function setUiScale(s){
  document.documentElement.style.setProperty("--ui-scale", s);
  document.documentElement.style.zoom = s;
  try { localStorage.setItem("bl_ui_scale", String(s)); } catch(e){}
  renderUiScaleControls();
}

function renderUiScaleControls(){
  const aktuell = getUiScale();
  ["uiScaleRow", "uiScaleRowSetup"].forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    el.innerHTML = UI_SCALES.map(s => `<button type="button" class="ghost${Math.abs(s - aktuell) < 0.01 ? " on" : ""}" onclick="setUiScale(${s})">${Math.round(s * 100)} %</button>`).join("");
  });
}

function openSaveModal(){
  renderUiScaleControls();
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

// Startbildschirm: Auswahl der Anzeigegroesse sofort zeigen.
if(typeof document !== "undefined") renderUiScaleControls();
