/**
 * COPAFA Bingo - Motor de Control y Tablero Maestro
 * Basado en Bingo Master Board v3.0.1 (c) 2011-2018 Timothy Hsu (Games by Tim)
 * Distribuido bajo la Licencia MIT (ver archivo LICENSE)
 *
 * Adaptación funcional Fase 1: Registro manual exclusivo, eliminación de sorteo digital,
 * protección contra borrados accidentales, función Deshacer último, confirmación de reset
 * e historial visual de balotas registradas.
 */

const fixedWidth = document.getElementById("area").offsetWidth;
const fixedHeight = document.getElementById("area").offsetHeight;
let isFullScreen = false;
let loadedMasterBoard = false;
let keyPressed = false;

let saveData = {
  drawnBingoBalls: [],
  themeColor: "classic",
  bingoStyle: "ball",
  ballsDrawnRemaining: "drawn",
  firstRun: 0
};

function loadSavedData() {
  if (supportsLocalStorage && localStorage.getItem("bingoMasterBoardSaveData")) {
    try {
      const parsedData = JSON.parse(localStorage.getItem("bingoMasterBoardSaveData"));
      if (parsedData && typeof parsedData === "object") {
        if (Array.isArray(parsedData.drawnBingoBalls)) {
          saveData.drawnBingoBalls = parsedData.drawnBingoBalls;
        }
        if (parsedData.themeColor) {
          saveData.themeColor = parsedData.themeColor;
        }
        if (parsedData.bingoStyle) {
          saveData.bingoStyle = parsedData.bingoStyle;
        }
        if (parsedData.ballsDrawnRemaining) {
          saveData.ballsDrawnRemaining = parsedData.ballsDrawnRemaining;
        }
        if (parsedData.firstRun !== undefined) {
          saveData.firstRun = parsedData.firstRun;
        }
      }
    } catch (err) {
      console.error("Error al leer datos desde localStorage:", err);
    }
  }
}

loadSavedData();

function save() {
  if (supportsLocalStorage) {
    localStorage.setItem("bingoMasterBoardSaveData", JSON.stringify(saveData));
  }
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
  fader.classList.add("notransition");
  fader.style.opacity = "1";

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
        } else if (e.keyCode === 84) {
          // 't' -> Themes
          e.preventDefault();
          hide("masterBoardSlide");
          show("settingsSlide", "grid");
        } else if (e.keyCode === 86) {
          // 'v' -> Alternar balotas jugadas / restantes
          e.preventDefault();
          toggleBallsDrawnRemaining("toggle");
        } else if (e.keyCode === 72) {
          // 'h' -> Home / Título
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
    setUpSettings();
    document.onkeydown = function (e) {
      if (!keyPressed) {
        keyPressed = true;
        if (e.keyCode === 84 || e.keyCode === 13) {
          e.preventDefault();
          hide("settingsSlide");
          show("masterBoardSlide", "grid");
        } else if (e.keyCode === 70) {
          e.preventDefault();
          toggleFullScreen();
        }
      }
    };
  } else if (elementName === "titleSlide") {
    document.onkeydown = function (e) {
      if (!keyPressed) {
        keyPressed = true;
        if (e.keyCode === 13) {
          e.preventDefault();
          hide("titleSlide");
          show("masterBoardSlide", "grid");
        } else if (e.keyCode === 70) {
          e.preventDefault();
          toggleFullScreen();
        }
      }
    };
  }

  setTimeout(() => {
    fader.classList.remove("notransition");
    fader.style.opacity = "0";
  }, 50);
}

function hide(elementName) {
  const targetEl = document.getElementById(elementName);
  if (targetEl) {
    targetEl.style.display = "none";
  }
  if (elementName === "masterBoardSlide") {
    changeBG();
    document.getElementById("fullScreenToggle").classList.remove("fullScreenToggleSmall");
    document.getElementById("homeButton").style.display = "none";
  }
}

function toggleFullScreen() {
  const canvas = document.body;
  if (isFullScreen === false) {
    if (canvas.requestFullscreen) {
      canvas.requestFullscreen();
    } else if (canvas.webkitRequestFullscreen) {
      canvas.webkitRequestFullscreen();
    }
    isFullScreen = true;
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
    isFullScreen = false;
  }
  changeFullScreenImg();
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

function changeBG(color) {
  let newColor;
  if (color === "classic") {
    newColor = "#d1cc85";
  } else if (color === "red") {
    newColor = "rgb(253, 166, 166)";
  } else if (color === "green") {
    newColor = "rgb(150, 206, 129)";
  } else if (color === "blue") {
    newColor = "rgb(139, 199, 226)";
  } else if (color === "purple") {
    newColor = "rgb(189, 176, 216)";
  } else {
    newColor = "radial-gradient(#f7eaab, #bfbb73)";
  }
  document.getElementById("area").style.background = newColor;
  document.getElementById("fader").style.background = newColor;
}

function typeOfBingo(num) {
  if (saveData.bingoStyle === "vintage") {
    return "bingoBallVintageActive";
  } else {
    if (num <= 15) {
      return "bingoBallBallActiveB";
    } else if (num <= 30) {
      return "bingoBallBallActiveI";
    } else if (num <= 45) {
      return "bingoBallBallActiveN";
    } else if (num <= 60) {
      return "bingoBallBallActiveG";
    } else {
      return "bingoBallBallActiveO";
    }
  }
}

function typeOfBingoLetter(num) {
  if (num <= 15) {
    return "B";
  } else if (num <= 30) {
    return "I";
  } else if (num <= 45) {
    return "N";
  } else if (num <= 60) {
    return "G";
  } else {
    return "O";
  }
}

function formatBallNumber(num) {
  const letter = typeOfBingoLetter(num);
  const formattedNum = num < 10 ? "0" + num : "" + num;
  return `${letter}-${formattedNum}`;
}

/**
 * Registro manual de balota al hacer clic sobre el número del tablero.
 * PROTECCIÓN: Si el número ya fue registrado, un segundo clic NO hace nada.
 */
function activateBingoBall(bingoIDNum) {
  if (saveData.drawnBingoBalls.indexOf(bingoIDNum) !== -1) {
    return; // Ya registrado; no borrar accidentalmente
  }

  const typeOfBingoBall = typeOfBingo(bingoIDNum);
  const typeOfBingoBallLetter = typeOfBingoLetter(bingoIDNum);
  const bingoID = bingoIDNum + "bingo";
  const ballEl = document.getElementById(bingoID);
  if (ballEl) {
    ballEl.classList.add(typeOfBingoBall);
  }

  const bigBall = document.getElementById("bigBingoBall");
  bigBall.classList.remove(
    "bingoBallBallActiveB",
    "bingoBallBallActiveI",
    "bingoBallBallActiveN",
    "bingoBallBallActiveG",
    "bingoBallBallActiveO",
    "bigBingoBallVintage"
  );
  if (saveData.bingoStyle === "ball") {
    bigBall.classList.add(typeOfBingoBall);
  } else {
    bigBall.classList.add("bigBingoBallVintage");
  }

  const bigLetter = document.getElementById("bigBingoLetter");
  const bigNumber = document.getElementById("bigBingoNumber");
  bigLetter.innerHTML = typeOfBingoBallLetter;
  bigNumber.innerHTML = bingoIDNum;
  bigNumber.style.fontSize = "104px";
  setTimeout(() => {
    bigNumber.style.fontSize = "95px";
  }, 100);

  saveData.drawnBingoBalls.push(bingoIDNum);
  save();

  updateBallStats();
  updateUndoButton();
  updateHistoryDisplay();
}

/**
 * Deshace únicamente el último número registrado.
 */
function undoLastBall() {
  if (!saveData.drawnBingoBalls || saveData.drawnBingoBalls.length === 0) {
    return;
  }

  const lastNum = saveData.drawnBingoBalls.pop();
  const bingoID = lastNum + "bingo";
  const ballEl = document.getElementById(bingoID);
  if (ballEl) {
    ballEl.classList.remove(
      "bingoBallBallActiveB",
      "bingoBallBallActiveI",
      "bingoBallBallActiveN",
      "bingoBallBallActiveG",
      "bingoBallBallActiveO",
      "bingoBallVintageActive"
    );
  }

  updateBigBingoBall();
  save();

  updateBallStats();
  updateUndoButton();
  updateHistoryDisplay();
}

/**
 * Sincroniza la balota grande con el último número registrado en el historial.
 */
function updateBigBingoBall() {
  const bigBall = document.getElementById("bigBingoBall");
  const bigLetter = document.getElementById("bigBingoLetter");
  const bigNumber = document.getElementById("bigBingoNumber");

  bigBall.classList.remove(
    "bingoBallBallActiveB",
    "bingoBallBallActiveI",
    "bingoBallBallActiveN",
    "bingoBallBallActiveG",
    "bingoBallBallActiveO",
    "bigBingoBallVintage"
  );

  if (saveData.drawnBingoBalls.length > 0) {
    const currentLast = saveData.drawnBingoBalls[saveData.drawnBingoBalls.length - 1];
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

function loadBingoBall(bingoIDNum) {
  const typeOfBingoBall = typeOfBingo(bingoIDNum);
  const bingoID = bingoIDNum + "bingo";
  const ballEl = document.getElementById(bingoID);
  if (ballEl) {
    ballEl.classList.add(typeOfBingoBall);
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
  save();
  renderBingoStyle();
  for (let i = 0; i < saveData.drawnBingoBalls.length; i += 1) {
    loadBingoBall(saveData.drawnBingoBalls[i]);
  }
  updateBigBingoBall();
  setUpSettings();
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
      save();
    } else {
      document.getElementById("ballsRemaining").style.display = "none";
      document.getElementById("ballsDrawn").style.display = "flex";
      saveData.ballsDrawnRemaining = "drawn";
      save();
    }
  } else if (renderOrToggle === "render") {
    document.getElementById("ballsDrawnRemaining").style.visibility = "visible";
    if (saveData.ballsDrawnRemaining === "remaining") {
      document.getElementById("ballsDrawn").style.display = "none";
      document.getElementById("ballsRemaining").style.display = "flex";
    } else {
      document.getElementById("ballsRemaining").style.display = "none";
      document.getElementById("ballsDrawn").style.display = "flex";
      saveData.ballsDrawnRemaining = "drawn";
    }
  }
}

/**
 * Pide confirmación al usuario antes de reiniciar una partida.
 */
function confirmResetBoard() {
  const confirmed = window.confirm(
    "¿Seguro que deseas iniciar una nueva partida? Se borrarán todos los números registrados."
  );
  if (confirmed) {
    resetBoard();
  }
}

function resetBoard() {
  for (let i = 0; i < 75; i += 1) {
    const ballEl = document.getElementById(i + 1 + "bingo");
    if (ballEl) {
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

  saveData.drawnBingoBalls = [];
  save();

  updateBigBingoBall();

  const bingoBallsClass = document.querySelectorAll(".bingoBalls");
  for (let i = 0; i < bingoBallsClass.length; i += 1) {
    bingoBallsClass[i].classList.add("notransition");
    bingoBallsClass[i].style.opacity = 0;
    setTimeout(() => {
      bingoBallsClass[i].classList.remove("notransition");
      bingoBallsClass[i].style.opacity = 1;
    }, 100);
  }

  updateBallStats();
  updateUndoButton();
  updateHistoryDisplay();
}

function setUpMasterBoard() {
  renderBingoStyle();
  for (let i = 0; i < saveData.drawnBingoBalls.length; i += 1) {
    loadBingoBall(saveData.drawnBingoBalls[i]);
  }
  updateBigBingoBall();
  toggleBallsDrawnRemaining("render");
  updateBallStats();
  updateUndoButton();
  updateHistoryDisplay();
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
  save();
  setUpSettings();
}
