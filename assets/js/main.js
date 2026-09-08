/**
 * COPAFA Bingo - Motor de Control y Tablero del Operador
 * Basado en Bingo Master Board v3.0.1 (c) 2011-2018 Timothy Hsu (Games by Tim)
 * Distribuido bajo la Licencia MIT (ver archivo LICENSE)
 *
 * Versión 3 (Sprint Final): Modalidades de Juego, Patrón Ganador 5x5, Datos de Evento Reutilizables.
 * Sincronización en tiempo real con la Vista Pública / Proyector (publico.html).
 */

const fixedWidth = document.getElementById("area").offsetWidth;
const fixedHeight = document.getElementById("area").offsetHeight;
let isFullScreen = false;
let loadedMasterBoard = false;
let keyPressed = false;

// Estado temporal para edición de modalidad/patrón en slide
let tempCustomPattern = [];
let tempPatternType = "none";

// Estado enlazado al motor de sincronización CopafaSync
let saveData = window.CopafaSync
  ? window.CopafaSync.getState()
  : {
      version: 3,
      eventTitle: "",
      gameTitle: "",
      prizeTitle: "",
      sponsor: "",
      patternType: "none",
      patternName: "Sin modalidad",
      customPattern: [],
      drawnBingoBalls: [],
      themeColor: "classic",
      bingoStyle: "ball",
      ballsDrawnRemaining: "drawn",
      firstRun: 0
    };

// Suscripción al motor de sincronización CopafaSync
if (window.CopafaSync) {
  window.CopafaSync.subscribe(function (state) {
    saveData = state;
    renderBoardFromState(state);
    updateBigBingoBall();
    updateBallStats();
    updateUndoButton();
    updateHistoryDisplay();
    populateGameDataUI(state);
    renderMiniPatternCard();
    if (state.themeColor) {
      changeBG(state.themeColor);
      if (typeof setUpSettings === "function") {
        setUpSettings();
      }
    }
  });
}

function init() {
  resize();
  window.addEventListener("resize", resize);
  document.addEventListener("fullscreenchange", onFullScreenChange, false);
  document.addEventListener("webkitfullscreenchange", onFullScreenChange, false);

  const bingoBallClass = document.querySelectorAll(".bingoBall");
  for (let i = 0; i < bingoBallClass.length; i += 1) {
    bingoBallClass[i].addEventListener("click", () => {
      activateBingoBall(i + 1);
    });
  }

  // Inicializar celdas del mini patrón en el panel del operador
  initMiniPatternGrid();

  let param = location.search;
  if (param === "?masterboard") {
    setTimeout(() => {
      hide("titleSlide");
      show("fullScreenToggleLayer");
      show("masterBoardSlide", "grid");
    }, 50);
  } else {
    setTimeout(() => {
      show("fullScreenToggleLayer");
      show("titleSlide");
    }, 50);
  }

  document.onkeyup = function () {
    keyPressed = false;
  };

  const img1 = new Image();
  const img2 = new Image();
  const img3 = new Image();
  img1.src = "./assets/img/fullscreenUpHover.svg";
  img2.src = "./assets/img/fullscreenDownHover.svg";
  img3.src = "./assets/img/homeButtonHover.svg";
}

function resize() {
  const viewNames = [
    document.getElementById("area"),
    document.getElementById("fader"),
    document.getElementById("fullScreenToggleLayer")
  ];
  let areaMultiplier = viewNames[0].offsetHeight / viewNames[0].offsetWidth;
  let windowMultiplier = window.innerHeight / window.innerWidth;
  if (windowMultiplier < areaMultiplier) {
    for (let i = 0; i < viewNames.length; i += 1) {
      if (viewNames[i]) {
        viewNames[i].style.transform = `scale(` + window.innerHeight / fixedHeight + `)`;
      }
    }
  } else {
    for (let i = 0; i < viewNames.length; i += 1) {
      if (viewNames[i]) {
        viewNames[i].style.transform = `scale(` + window.innerWidth / fixedWidth + `)`;
      }
    }
  }
}

function onFullScreenChange() {
  const fullscreenElement =
    document.fullscreenElement || document.webkitFullscreenElement;
  if (fullscreenElement === null || fullscreenElement === undefined) {
    isFullScreen = false;
  } else {
    isFullScreen = true;
  }
  changeFullScreenImg();
}

function show(elementName, display) {
  const fader = document.getElementById("fader");
  if (elementName !== "fullScreenToggleLayer") {
    fader.classList.add("notransition");
    fader.style.opacity = "1";
  }

  const targetEl = document.getElementById(elementName);
  if (targetEl) {
    if (display === "flex") {
      targetEl.style.display = "flex";
    } else if (display === "grid") {
      targetEl.style.display = "grid";
    } else {
      targetEl.style.display = "block";
    }
  }

  if (elementName === "masterBoardSlide") {
    changeBG(saveData.themeColor);
    document.getElementById("fullScreenToggle").classList.add("fullScreenToggleSmall");
    document.getElementById("homeButton").style.display = "block";
    if (loadedMasterBoard === false) {
      setUpMasterBoard();
      loadedMasterBoard = true;
    }
    document.onkeydown = function (e) {
      // Si el operador está escribiendo en campos de formulario, no interceptar atajos
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
      if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") {
        return;
      }

      if (!keyPressed) {
        keyPressed = true;
        if (e.keyCode === 82) {
          // 'r' -> Reset con confirmación
          e.preventDefault();
          confirmResetBoard();
        } else if (e.keyCode === 90 && (e.ctrlKey || e.metaKey)) {
          // Ctrl+Z / Cmd+Z -> Deshacer último
          e.preventDefault();
          undoLastBall();
        } else if (e.keyCode === 85) {
          // 'u' -> Deshacer último
          e.preventDefault();
          undoLastBall();
        } else if (e.keyCode === 87) {
          // 'w' -> Modalidad / Winning Pattern
          e.preventDefault();
          openWinningPatternSlide();
        } else if (e.keyCode === 84) {
          // 't' -> Themes
          e.preventDefault();
          hide("masterBoardSlide");
          show("settingsSlide", "grid");
        } else if (e.keyCode === 86) {
          // 'v' -> Toggle bolas restantes / sorteadas
          e.preventDefault();
          toggleBallsDrawnRemaining("toggle");
        } else if (e.keyCode === 72) {
          // 'h' -> Ir al inicio
          e.preventDefault();
          hide("masterBoardSlide");
          show("titleSlide");
        } else if (e.keyCode === 70) {
          // 'f' -> Pantalla completa
          e.preventDefault();
          toggleFullScreen();
        }
      }
    };
  } else if (elementName === "settingsSlide") {
    setUpSettings(saveData.themeColor);
    document.onkeydown = function (e) {
      if (!keyPressed) {
        keyPressed = true;
        if (e.keyCode === 84 || e.keyCode === 13) {
          hide("settingsSlide");
          show("masterBoardSlide", "grid");
        } else if (e.keyCode === 70) {
          toggleFullScreen();
        }
      }
    };
  } else if (elementName === "winningPatternSlide") {
    document.onkeydown = function (e) {
      if (!keyPressed) {
        keyPressed = true;
        if (e.keyCode === 87 || e.keyCode === 13) {
          closeWinningPatternSlide();
        } else if (e.keyCode === 70) {
          toggleFullScreen();
        }
      }
    };
  } else if (elementName === "titleSlide") {
    document.onkeydown = function (e) {
      if (!keyPressed) {
        keyPressed = true;
        if (e.keyCode === 13) {
          hide("titleSlide");
          show("masterBoardSlide", "grid");
        } else if (e.keyCode === 70) {
          toggleFullScreen();
        }
      }
    };
  }

  if (elementName !== "fullScreenToggleLayer") {
    setTimeout(() => {
      fader.classList.remove("notransition");
      fader.style.opacity = "0";
    }, 50);
  }
}

function hide(elementName) {
  document.getElementById(elementName).style.display = "none";
  if (elementName === "masterBoardSlide") {
    document.getElementById("fullScreenToggle").classList.remove("fullScreenToggleSmall");
    document.getElementById("homeButton").style.display = "none";
    document.getElementById("area").style.background = "#fff";
  }
}

function changeBG(theColor) {
  const area = document.getElementById("area");
  const fader = document.getElementById("fader");
  let bg = "#eae9d2";
  if (theColor === "classic") {
    bg = "#eae9d2";
  } else if (theColor === "red") {
    bg = "#ffd3cc";
  } else if (theColor === "green") {
    bg = "#cae3b5";
  } else if (theColor === "blue") {
    bg = "#d3e0ff";
  } else if (theColor === "purple") {
    bg = "#ebceea";
  }
  if (area) area.style.background = bg;
  if (fader) fader.style.background = bg;
}

function changeFullScreenImg() {
  if (isFullScreen === false) {
    document.getElementById("fullScreenButton").style.display = "block";
    document.getElementById("fullScreenButtonDown").style.display = "none";
  } else {
    document.getElementById("fullScreenButton").style.display = "none";
    document.getElementById("fullScreenButtonDown").style.display = "block";
  }
}

function toggleFullScreen() {
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    } else if (document.documentElement.webkitRequestFullscreen) {
      document.documentElement.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

/**
 * Registro manual de bolilla con protección contra doble clic
 */
function activateBingoBall(theNumber) {
  if (!window.CopafaSync) return;
  const added = window.CopafaSync.addBall(theNumber);
  if (!added) {
    // Ya estaba registrada: no alterar nada
    return;
  }
}

/**
 * Deshace únicamente la última bolilla registrada
 */
function undoLastBall() {
  if (!window.CopafaSync) return;
  window.CopafaSync.undoLastBall();
}

/**
 * Reset con diálogo de confirmación.
 * Al aceptar, limpia las balotas pero conserva evento, partida, premio, modalidad y patrocinador.
 */
function confirmResetBoard() {
  const confirmed = window.confirm(
    "¿Está seguro de reiniciar el tablero para una nueva partida?\n\n" +
    "• Se limpiarán las bolillas registradas y el historial.\n" +
    "• Se conservarán los datos de Evento, Partida, Premio y Modalidad."
  );
  if (confirmed) {
    if (window.CopafaSync) {
      window.CopafaSync.resetDrawnBalls();
    }
  }
}

/* ==========================================================================
   MODALIDADES Y PATRÓN GANADOR 5x5 (Reutilizando Winning Pattern de TimTree)
   ========================================================================== */

/**
 * Inicializa la mini cuadrícula 5x5 en el panel del operador
 */
function initMiniPatternGrid() {
  const container = document.getElementById("operatorMiniCard");
  if (!container) return;
  container.innerHTML = "";

  // Cabecera B-I-N-G-O
  const letters = ["B", "I", "N", "G", "O"];
  letters.forEach(l => {
    const h = document.createElement("div");
    h.className = "miniCardHeader";
    h.innerText = l;
    container.appendChild(h);
  });

  // 25 celdas ordenadas por filas para renderizado CSS grid
  // Fila 1: B1, I6, N11, G16, O21
  // Fila 2: B2, I7, N12, G17, O22
  // etc.
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const cellNum = c * 5 + r + 1;
      const cell = document.createElement("div");
      cell.className = "miniCardCell";
      cell.id = "miniCell" + cellNum;
      container.appendChild(cell);
    }
  }
  renderMiniPatternCard();
}

/**
 * Actualiza la visualización de la mini tarjeta 5x5 en el operador
 */
function renderMiniPatternCard() {
  const pattern = saveData.customPattern || [];
  for (let i = 1; i <= 25; i++) {
    const el = document.getElementById("miniCell" + i);
    if (el) {
      if (pattern.indexOf(i) !== -1) {
        el.classList.add("miniCardActive");
      } else {
        el.classList.remove("miniCardActive");
      }
    }
  }

  const labelEl = document.getElementById("operatorPatternLabel");
  if (labelEl) {
    labelEl.innerText = saveData.patternName || "Sin modalidad";
  }

  const selectEl = document.getElementById("selectPattern");
  if (selectEl && document.activeElement !== selectEl) {
    selectEl.value = saveData.patternType || "none";
  }
}

/**
 * Abre el slide interactivo para configurar la modalidad y patrón
 */
function openWinningPatternSlide() {
  tempCustomPattern = (saveData.customPattern || []).slice();
  tempPatternType = saveData.patternType || "none";

  // Actualizar casillas grandes
  for (let i = 1; i <= 25; i++) {
    const cellEl = document.getElementById(i + "bigcard");
    if (cellEl) {
      if (tempCustomPattern.indexOf(i) !== -1) {
        cellEl.classList.add("bingoCardActive");
      } else {
        cellEl.classList.remove("bingoCardActive");
      }
    }
  }

  hide("masterBoardSlide");
  show("winningPatternSlide", "grid");
}

/**
 * Cierra el slide guardando el patrón seleccionado/editado
 */
function closeWinningPatternSlide() {
  if (window.CopafaSync) {
    window.CopafaSync.setPattern(tempPatternType, tempCustomPattern);
  }
  hide("winningPatternSlide");
  show("masterBoardSlide", "grid");
}

/**
 * Alterna una casilla específica en la tarjeta 5x5 grande
 */
function toggleWinningPattern(cellNumber) {
  const num = parseInt(cellNumber, 10);
  const cellEl = document.getElementById(num + "bigcard");
  const idx = tempCustomPattern.indexOf(num);

  if (idx === -1) {
    tempCustomPattern.push(num);
    if (cellEl) cellEl.classList.add("bingoCardActive");
  } else {
    tempCustomPattern.splice(idx, 1);
    if (cellEl) cellEl.classList.remove("bingoCardActive");
  }

  // Al editar casillas directamente pasa a modo Personalizado
  tempPatternType = "custom";
}

/**
 * Selecciona una modalidad preset desde el slide
 */
function selectPatternPreset(presetKey) {
  tempPatternType = presetKey;
  const presets = window.CopafaSync ? window.CopafaSync.PATTERN_PRESETS : null;
  if (presets && presets[presetKey]) {
    tempCustomPattern = presets[presetKey].cells.slice();
  } else {
    tempCustomPattern = [];
  }

  for (let i = 1; i <= 25; i++) {
    const cellEl = document.getElementById(i + "bigcard");
    if (cellEl) {
      if (tempCustomPattern.indexOf(i) !== -1) {
        cellEl.classList.add("bingoCardActive");
      } else {
        cellEl.classList.remove("bingoCardActive");
      }
    }
  }
}

/**
 * Limpia todas las casillas activas en la interfaz de edición
 */
function clearWinningPatternUI() {
  tempCustomPattern = [];
  tempPatternType = "custom";
  for (let i = 1; i <= 25; i++) {
    const cellEl = document.getElementById(i + "bigcard");
    if (cellEl) cellEl.classList.remove("bingoCardActive");
  }
}

/**
 * Maneja el cambio de selección en el dropdown de modalidades
 */
function onPatternSelectChanged(val) {
  if (val === "custom") {
    openWinningPatternSlide();
  } else {
    if (window.CopafaSync) {
      window.CopafaSync.setPattern(val);
    }
  }
}

/**
 * Carga un Preset de Evento completo (Preset 1, 2 o 3)
 */
function loadEventPreset(index) {
  if (!window.CopafaSync) return;
  window.CopafaSync.applyEventPreset(index);

  // Retroalimentación visual en el botón de preset
  const presetBtns = document.querySelectorAll(".quickPresetBtn");
  if (presetBtns && presetBtns[index]) {
    const activeBtn = presetBtns[index];
    const originalText = activeBtn.innerText;
    activeBtn.innerText = "✓ Cargado";
    setTimeout(() => {
      activeBtn.innerText = originalText;
    }, 1000);
  }
}

/* ==========================================================================
   FORMULARIO DE DATOS DE EVENTO Y PARTIDA
   ========================================================================== */

/**
 * Guarda los datos ingresados en el formulario del operador
 */
function saveGameDataFromUI() {
  if (!window.CopafaSync) return;
  const eventInput = document.getElementById("inputEventTitle");
  const gameInput = document.getElementById("inputGameTitle");
  const prizeInput = document.getElementById("inputPrizeTitle");
  const sponsorInput = document.getElementById("inputSponsor");
  const patternSelect = document.getElementById("selectPattern");

  const eventTitle = eventInput ? eventInput.value : "";
  const gameTitle = gameInput ? gameInput.value : "";
  const prizeTitle = prizeInput ? prizeInput.value : "";
  const sponsor = sponsorInput ? sponsorInput.value : "";
  const patternType = patternSelect ? patternSelect.value : saveData.patternType;

  window.CopafaSync.setGameInfo({
    eventTitle: eventTitle,
    gameTitle: gameTitle,
    prizeTitle: prizeTitle,
    sponsor: sponsor,
    patternType: patternType
  });

  const btn = document.getElementById("saveGameDataBtn");
  if (btn) {
    btn.classList.add("savedFeedback");
    btn.innerText = "CONFIGURACIÓN GUARDADA ✓";
    setTimeout(() => {
      btn.classList.remove("savedFeedback");
      btn.innerText = "GUARDAR CONFIGURACIÓN";
    }, 1200);
  }
}

/**
 * Puebla los inputs del operador con el estado actual
 */
function populateGameDataUI(state) {
  if (!state) return;
  const eventTitleInput = document.getElementById("inputEventTitle");
  const gameTitleInput = document.getElementById("inputGameTitle");
  const prizeTitleInput = document.getElementById("inputPrizeTitle");
  const sponsorInput = document.getElementById("inputSponsor");
  const selectPattern = document.getElementById("selectPattern");

  if (eventTitleInput && document.activeElement !== eventTitleInput) {
    eventTitleInput.value = state.eventTitle || "";
  }
  if (gameTitleInput && document.activeElement !== gameTitleInput) {
    gameTitleInput.value = state.gameTitle || "";
  }
  if (prizeTitleInput && document.activeElement !== prizeTitleInput) {
    prizeTitleInput.value = state.prizeTitle || "";
  }
  if (sponsorInput && document.activeElement !== sponsorInput) {
    sponsorInput.value = state.sponsor || "";
  }
  if (selectPattern && document.activeElement !== selectPattern) {
    selectPattern.value = state.patternType || "none";
  }
}

/* ==========================================================================
   RENDERIZADO DE TABLERO Y BALOTA GRANDE
   ========================================================================== */

/**
 * Sincroniza visualmente el tablero completo 1-75 según el estado
 */
function renderBoardFromState(state) {
  const drawn = state && Array.isArray(state.drawnBingoBalls) ? state.drawnBingoBalls : [];
  for (let i = 1; i <= 75; i++) {
    const ballEl = document.getElementById(i + "bingo");
    if (!ballEl) continue;

    const ballType = typeOfBingo(i);
    if (drawn.indexOf(i) !== -1) {
      ballEl.classList.add(ballType);
    } else {
      ballEl.classList.remove(
        "bingoBallBallActiveB",
        "bingoBallBallActiveI",
        "bingoBallBallActiveN",
        "bingoBallBallActiveG",
        "bingoBallBallActiveO",
        "bingoBallVintageActive"
      );
    }
  }
}

/**
 * Sincroniza la balota grande con el último número registrado en el historial.
 */
function updateBigBingoBall() {
  const bigBall = document.getElementById("bigBingoBall");
  const bigLetter = document.getElementById("bigBingoLetter");
  const bigNumber = document.getElementById("bigBingoNumber");
  if (!bigBall || !bigLetter || !bigNumber) return;

  bigBall.classList.remove(
    "bingoBallBallActiveB",
    "bingoBallBallActiveI",
    "bingoBallBallActiveN",
    "bingoBallBallActiveG",
    "bingoBallBallActiveO",
    "bigBingoBallVintage"
  );

  const drawn = saveData.drawnBingoBalls || [];
  if (drawn.length > 0) {
    const currentLast = drawn[drawn.length - 1];
    const ballType = typeOfBingo(currentLast);
    const letter = typeOfBingoLetter(currentLast);

    if (saveData.bingoStyle === "ball") {
      bigBall.classList.add(ballType);
    } else {
      bigBall.classList.add("bigBingoBallVintage");
    }
    bigLetter.innerHTML = letter;
    bigNumber.innerHTML = currentLast;
  } else {
    bigLetter.innerHTML = "&nbsp;";
    bigNumber.innerHTML = "&nbsp;";
  }
}

function updateBallStats() {
  const drawn = saveData.drawnBingoBalls ? saveData.drawnBingoBalls.length : 0;
  const remaining = 75 - drawn;
  const drawnNumEl = document.getElementById("ballsDrawnNum");
  const remainingNumEl = document.getElementById("ballsRemainingNum");
  if (drawnNumEl) drawnNumEl.innerText = drawn;
  if (remainingNumEl) remainingNumEl.innerText = remaining;
}

function updateUndoButton() {
  const undoBtn = document.getElementById("undoButton");
  if (!undoBtn) return;
  if (!saveData.drawnBingoBalls || saveData.drawnBingoBalls.length === 0) {
    undoBtn.classList.add("disabled");
  } else {
    undoBtn.classList.remove("disabled");
  }
}

function updateHistoryDisplay() {
  const container = document.getElementById("recentHistoryList");
  if (!container) return;
  if (!saveData.drawnBingoBalls || saveData.drawnBingoBalls.length === 0) {
    container.innerHTML = `<span class="historyEmpty">Sin registros</span>`;
    return;
  }
  const last5 = saveData.drawnBingoBalls.slice(-5).reverse();
  const html = last5
    .map((num, idx) => {
      const formatted = formatBallNumber(num);
      const isLatest = idx === 0;
      return `<span class="historyBall ${
        isLatest ? "historyBallLatest" : ""
      }">${formatted}</span>`;
    })
    .join('<span class="historySeparator"> · </span>');

  container.innerHTML = html;
}

function toggleBallsDrawnRemaining(renderOrToggle) {
  if (renderOrToggle === "toggle") {
    if (saveData.ballsDrawnRemaining === "drawn") {
      document.getElementById("ballsDrawn").style.display = "none";
      document.getElementById("ballsRemaining").style.display = "flex";
      saveData.ballsDrawnRemaining = "remaining";
    } else {
      document.getElementById("ballsRemaining").style.display = "none";
      document.getElementById("ballsDrawn").style.display = "flex";
      saveData.ballsDrawnRemaining = "drawn";
    }
    if (window.CopafaSync) {
      window.CopafaSync.updateState({ ballsDrawnRemaining: saveData.ballsDrawnRemaining });
    }
  } else if (renderOrToggle === "render") {
    document.getElementById("ballsDrawnRemaining").style.visibility = "visible";
    if (saveData.ballsDrawnRemaining === "remaining") {
      document.getElementById("ballsDrawn").style.display = "none";
      document.getElementById("ballsRemaining").style.display = "flex";
    } else {
      document.getElementById("ballsRemaining").style.display = "none";
      document.getElementById("ballsDrawn").style.display = "flex";
    }
  }
}

function renderBingoStyle() {
  if (saveData.bingoStyle === "ball") {
    for (let i = 0; i < 75; i += 1) {
      const el = document.getElementById(i + 1 + "bingo");
      if (el) {
        el.classList.remove("bingoBallVintage");
        el.classList.add("bingoBallBall");
      }
    }
  } else {
    for (let i = 0; i < 75; i += 1) {
      const el = document.getElementById(i + 1 + "bingo");
      if (el) {
        el.classList.remove("bingoBallBall");
        el.classList.add("bingoBallVintage");
      }
    }
  }
}

function changeBingoStyle(theStyle) {
  saveData.bingoStyle = theStyle;
  if (window.CopafaSync) {
    window.CopafaSync.updateState({ bingoStyle: theStyle });
  }
  renderBingoStyle();
  renderBoardFromState(saveData);
  updateBigBingoBall();
  setUpSettings();
}

function setUpMasterBoard() {
  renderBingoStyle();
  renderBoardFromState(saveData);
  updateBigBingoBall();
  toggleBallsDrawnRemaining("render");
  updateBallStats();
  updateUndoButton();
  updateHistoryDisplay();
  populateGameDataUI(saveData);
  renderMiniPatternCard();
}

function setUpSettings() {
  document.getElementById("classic").style.backgroundColor = "";
  document.getElementById("red").style.backgroundColor = "";
  document.getElementById("green").style.backgroundColor = "";
  document.getElementById("blue").style.backgroundColor = "";
  document.getElementById("purple").style.backgroundColor = "";
  document.getElementById("bingoStyleBall").style.backgroundColor = "";
  document.getElementById("bingoStyleVintage").style.backgroundColor = "";
  if (saveData.themeColor === "classic") {
    document.getElementById("classic").style.backgroundColor = "rgba(148,138,84,0.28)";
  } else if (saveData.themeColor === "red") {
    document.getElementById("red").style.backgroundColor = "rgba(255,0,0,0.2)";
  } else if (saveData.themeColor === "green") {
    document.getElementById("green").style.backgroundColor = "rgba(0,128,0,0.2)";
  } else if (saveData.themeColor === "blue") {
    document.getElementById("blue").style.backgroundColor = "rgba(51,102,255,0.2)";
  } else if (saveData.themeColor === "purple") {
    document.getElementById("purple").style.backgroundColor = "rgba(164,70,153,0.2)";
  }
  if (saveData.bingoStyle === "ball") {
    document.getElementById("bingoStyleBall").style.backgroundColor = "rgba(0,0,0,0.15)";
  } else if (saveData.bingoStyle === "vintage") {
    document.getElementById("bingoStyleVintage").style.backgroundColor = "rgba(0,0,0,0.15)";
  }
}

function changeBackgroundColor(theColor) {
  saveData.themeColor = theColor;
  changeBG(theColor);
  if (window.CopafaSync) {
    window.CopafaSync.updateState({ themeColor: theColor });
  }
  setUpSettings();
}

/* ==========================================================================
   UTILIDADES BINGO
   ========================================================================== */

function typeOfBingoLetter(num) {
  if (window.CopafaSync) return window.CopafaSync.typeOfBingoLetter(num);
  if (num <= 15) return "B";
  if (num <= 30) return "I";
  if (num <= 45) return "N";
  if (num <= 60) return "G";
  return "O";
}

function typeOfBingo(num) {
  if (window.CopafaSync) return window.CopafaSync.typeOfBingo(num, saveData.bingoStyle);
  if (saveData.bingoStyle === "vintage") return "bingoBallVintageActive";
  if (num <= 15) return "bingoBallBallActiveB";
  if (num <= 30) return "bingoBallBallActiveI";
  if (num <= 45) return "bingoBallBallActiveN";
  if (num <= 60) return "bingoBallBallActiveG";
  return "bingoBallBallActiveO";
}

function formatBallNumber(num) {
  if (window.CopafaSync) return window.CopafaSync.formatBallNumber(num);
  const letter = typeOfBingoLetter(num);
  const formattedNum = num < 10 ? "0" + num : "" + num;
  return letter + "-" + formattedNum;
}
