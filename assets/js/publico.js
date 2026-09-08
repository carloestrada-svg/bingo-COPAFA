/**
 * COPAFA Bingo - Lógica Exclusiva de la Vista Pública / Proyector
 * Versión 3 (Sprint Final): Modalidades de Juego, Patrón 5x5, Datos de Evento Reutilizables.
 *
 * Características:
 * - 100% Solo Lectura (cero manipulación de juego).
 * - Sincronizada en tiempo real mediante CopafaSync (<5ms).
 * - Auto-escalado responsive 16:9 proporcional (1920x1080 nativo).
 * - Visualización destacada de modalidad con tarjeta miniatura 5x5.
 * - Libre de dependencias externas.
 */

(function () {
  "use strict";

  const BASE_WIDTH = 1280;
  const BASE_HEIGHT = 720;
  let isFullScreen = false;
  let patternGridInitialized = false;

  function initPublicView() {
    initPatternGrid();
    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("fullscreenchange", onFullScreenChange, false);
    document.addEventListener("webkitfullscreenchange", onFullScreenChange, false);

    // Botón de pantalla completa
    const fsBtn = document.getElementById("publicFullscreenBtn");
    if (fsBtn) {
      fsBtn.addEventListener("click", toggleFullScreen);
    }

    // Atajo 'f' para alternar pantalla completa
    document.addEventListener("keydown", function (e) {
      if (e.key === "f" || e.key === "F" || e.keyCode === 70) {
        e.preventDefault();
        toggleFullScreen();
      }
    });

    // Suscribirse a los cambios en el motor de sincronización CopafaSync
    if (window.CopafaSync) {
      window.CopafaSync.subscribe(function (state) {
        renderState(state);
      });

      // Render inicial
      renderState(window.CopafaSync.getState());
    } else {
      console.error("CopafaSync no fue cargado en publico.html");
    }
  }

  /**
   * Escalado matemático 16:9 proporcional al viewport
   */
  function resize() {
    const area = document.getElementById("publicArea");
    if (!area) return;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const scale = Math.min(windowWidth / BASE_WIDTH, windowHeight / BASE_HEIGHT);

    area.style.transform = "scale(" + scale + ")";
  }

  /**
   * Aplica el tema de color sincronizado con Bingo Master Board
   */
  function renderTheme(themeColor) {
    const area = document.getElementById("publicArea");
    if (!area) return;
    const theme = (themeColor || "classic").toLowerCase();
    area.classList.remove("theme-classic", "theme-red", "theme-green", "theme-blue", "theme-purple");
    area.classList.add("theme-" + theme);
  }

  /**
   * Renderiza el estado completo en la pantalla pública
   */
  function renderState(state) {
    if (!state) return;

    renderTheme(state.themeColor);
    renderGameInfo(state);
    renderPattern(state);
    renderBoard(state.drawnBingoBalls || []);
    renderBigBall(state.drawnBingoBalls || []);
    renderCounter(state.drawnBingoBalls || []);
    renderRecentHistory(state.drawnBingoBalls || []);
  }

  /**
   * Renderiza la información institucional, partida, premio y patrocinador
   */
  function renderGameInfo(state) {
    const eventEl = document.getElementById("publicEventTitle");
    const dividerEl = document.getElementById("publicBrandDivider");
    const gameCard = document.getElementById("publicGameCard");
    const titleEl = document.getElementById("publicGameTitle");
    const prizeEl = document.getElementById("publicPrizeTitle");
    const sponsorEl = document.getElementById("publicSponsor");

    // Título de Evento (dinámico, sin fallback a 2026)
    if (eventEl) {
      if (state.eventTitle && state.eventTitle.trim() !== "") {
        eventEl.innerText = state.eventTitle.trim();
        if (dividerEl) dividerEl.classList.remove("hidden");
      } else {
        eventEl.innerText = "";
        if (dividerEl) dividerEl.classList.add("hidden");
      }
    }

    // Tarjeta de Partida y Premio (se oculta elegantemente si no hay datos)
    const hasGame = !!(state.gameTitle && state.gameTitle.trim() !== "");
    const hasPrize = !!(state.prizeTitle && state.prizeTitle.trim() !== "");
    const hasSponsor = !!(state.sponsor && state.sponsor.trim() !== "");

    if (gameCard) {
      if (!hasGame && !hasPrize && !hasSponsor) {
        gameCard.classList.add("hidden");
      } else {
        gameCard.classList.remove("hidden");
      }
    }

    if (titleEl) {
      if (hasGame) {
        titleEl.innerText = state.gameTitle.trim();
        titleEl.classList.remove("hidden");
      } else {
        titleEl.innerText = "";
        titleEl.classList.add("hidden");
      }
    }

    if (prizeEl) {
      if (hasPrize) {
        const prizeText = state.prizeTitle.trim();
        prizeEl.innerText = !/^premio/i.test(prizeText) ? "PREMIO: " + prizeText : prizeText;
        prizeEl.classList.remove("hidden");
      } else {
        prizeEl.innerText = "";
        prizeEl.classList.add("hidden");
      }
    }

    if (sponsorEl) {
      if (hasSponsor) {
        sponsorEl.innerText = "Auspiciado por: " + state.sponsor.trim();
        sponsorEl.classList.remove("hidden");
      } else {
        sponsorEl.innerText = "";
        sponsorEl.classList.add("hidden");
      }
    }
  }

  /**
   * Inicializa la estructura del patrón 5x5 en la pantalla pública
   */
  function initPatternGrid() {
    const container = document.getElementById("publicPatternGrid");
    if (!container || patternGridInitialized) return;
    container.innerHTML = "";

    // 5 encabezados B-I-N-G-O
    const headers = ["B", "I", "N", "G", "O"];
    headers.forEach(function (letter) {
      const h = document.createElement("div");
      h.className = "pubPatternHeaderCell";
      h.innerText = letter;
      container.appendChild(h);
    });

    // 25 celdas organizadas por filas para visualización CSS Grid:
    // Fila 1: B1, I6, N11, G16, O21
    // Fila 2: B2, I7, N12, G17, O22
    // etc.
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const cellNum = c * 5 + r + 1;
        const cell = document.createElement("div");
        cell.className = "pubPatternCell";
        cell.id = "pubPatternCell" + cellNum;
        container.appendChild(cell);
      }
    }
    patternGridInitialized = true;
  }

  /**
   * Renderiza el patrón 5x5 y nombre de modalidad
   */
  function renderPattern(state) {
    const patternBox = document.getElementById("publicPatternBox");
    const pType = state.patternType;
    const hasPattern = pType && pType !== "none" && state.patternName && state.patternName.trim() !== "";

    if (patternBox) {
      if (!hasPattern) {
        patternBox.classList.add("hidden");
        return; // Ocultar bloque si no hay modalidad configurada
      } else {
        patternBox.classList.remove("hidden");
      }
    }

    if (!patternGridInitialized) {
      initPatternGrid();
    }

    const nameEl = document.getElementById("publicPatternName");
    if (nameEl) {
      nameEl.innerText = state.patternName.toUpperCase();
    }

    const pattern = state.customPattern || [];
    for (let i = 1; i <= 25; i++) {
      const cellEl = document.getElementById("pubPatternCell" + i);
      if (cellEl) {
        if (pattern.indexOf(i) !== -1) {
          cellEl.className = "pubPatternCell pubPatternCellActive";
        } else {
          cellEl.className = "pubPatternCell";
        }
      }
    }
  }

  /**
   * Resalta en el tablero visual únicamente los números registrados
   */
  function renderBoard(drawnBalls) {
    for (let i = 1; i <= 75; i++) {
      const ballEl = document.getElementById("pubBall" + i);
      if (!ballEl) continue;

      const isDrawn = drawnBalls.indexOf(i) !== -1;
      ballEl.className = "publicBall";

      if (isDrawn) {
        const letter = window.CopafaSync ? window.CopafaSync.typeOfBingoLetter(i) : getLetter(i);
        ballEl.classList.add("active" + letter);
      }
    }
  }

  /**
   * Muestra de manera prominente el último número registrado
   */
  function renderBigBall(drawnBalls) {
    const ballEl = document.getElementById("publicBigBall");
    const letterEl = document.getElementById("publicBigBallLetter");
    const numEl = document.getElementById("publicBigBallNumber");
    if (!ballEl || !letterEl || !numEl) return;

    ballEl.className = "publicBigBall";

    if (drawnBalls && drawnBalls.length > 0) {
      const lastNum = drawnBalls[drawnBalls.length - 1];
      const letter = window.CopafaSync ? window.CopafaSync.typeOfBingoLetter(lastNum) : getLetter(lastNum);

      letterEl.innerText = letter;
      numEl.innerText = lastNum;
      ballEl.classList.add("active");
      ballEl.classList.add("active" + letter);
    } else {
      letterEl.innerHTML = "&nbsp;";
      numEl.innerHTML = "&nbsp;";
    }
  }

  /**
   * Contador de bolillas registradas
   */
  function renderCounter(drawnBalls) {
    const counterEl = document.getElementById("publicCounterNum");
    if (counterEl) {
      counterEl.innerText = drawnBalls ? drawnBalls.length : 0;
    }
  }

  /**
   * Muestra los últimos 5 números con formato de bolilla
   */
  function renderRecentHistory(drawnBalls) {
    const container = document.getElementById("publicHistoryList");
    if (!container) return;

    if (!drawnBalls || drawnBalls.length === 0) {
      container.innerHTML = '<span class="publicHistoryEmpty">Sin números registrados</span>';
      return;
    }

    const last5 = drawnBalls.slice(-5).reverse();
    const html = last5
      .map(function (num, idx) {
        const letter = window.CopafaSync ? window.CopafaSync.typeOfBingoLetter(num) : getLetter(num);
        const formatted = window.CopafaSync ? window.CopafaSync.formatBallNumber(num) : (letter + "-" + (num < 10 ? "0" + num : num));
        const isLatest = idx === 0;
        return (
          '<span class="publicHistoryBall ball' + letter + (isLatest ? " isLatest" : "") + '">' +
          formatted +
          "</span>"
        );
      })
      .join('<span class="publicHistorySep">·</span>');

    container.innerHTML = html;
  }

  function getLetter(num) {
    if (num <= 15) return "B";
    if (num <= 30) return "I";
    if (num <= 45) return "N";
    if (num <= 60) return "G";
    return "O";
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

  function onFullScreenChange() {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    isFullScreen = fsEl !== null && fsEl !== undefined;
    const fsBtn = document.getElementById("publicFullscreenBtn");
    if (fsBtn) {
      if (isFullScreen) {
        fsBtn.classList.add("isFullScreen");
      } else {
        fsBtn.classList.remove("isFullScreen");
      }
    }
  }

  // Inicializar al cargar el DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPublicView);
  } else {
    initPublicView();
  }
})();
