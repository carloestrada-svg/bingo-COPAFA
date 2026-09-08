/**
 * COPAFA Bingo - Lógica Exclusiva de la Vista Pública / Proyector
 * Fase 2A: Pantalla pasiva de alta visibilidad para público.
 *
 * Características:
 * - 100% Solo Lectura (cero manipulación de juego).
 * - Sincronizada en tiempo real mediante CopafaSync.
 * - Auto-escalado responsive 16:9 (1920x1080 nativo).
 * - Libre de dependencias externas.
 */

(function () {
  "use strict";

  const BASE_WIDTH = 1280;
  const BASE_HEIGHT = 720;
  let isFullScreen = false;

  function initPublicView() {
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

    // Suscribirse a los cambios en el motor de sincronización
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
   * Renderiza el estado completo en la pantalla pública
   */
  function renderState(state) {
    if (!state) return;

    renderGameInfo(state);
    renderBoard(state.drawnBingoBalls || []);
    renderBigBall(state.drawnBingoBalls || []);
    renderCounter(state.drawnBingoBalls || []);
    renderRecentHistory(state.drawnBingoBalls || []);
  }

  /**
   * Renderiza la información de la partida, premio y patrocinador
   */
  function renderGameInfo(state) {
    const titleEl = document.getElementById("publicGameTitle");
    const prizeEl = document.getElementById("publicPrizeTitle");
    const sponsorEl = document.getElementById("publicSponsor");

    if (titleEl) {
      titleEl.innerText = state.gameTitle && state.gameTitle.trim() !== ""
        ? state.gameTitle
        : "PARTIDA EN CURSO";
    }

    if (prizeEl) {
      prizeEl.innerText = state.prizeTitle && state.prizeTitle.trim() !== ""
        ? state.prizeTitle
        : "PREMIO EN JUEGO";
    }

    if (sponsorEl) {
      if (state.sponsor && state.sponsor.trim() !== "") {
        sponsorEl.innerText = "Auspiciado por: " + state.sponsor.trim();
        sponsorEl.classList.remove("hidden");
      } else {
        sponsorEl.innerText = "";
        sponsorEl.classList.add("hidden");
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
   * Muestra el total de bolillas registradas
   */
  function renderCounter(drawnBalls) {
    const numEl = document.getElementById("publicCounterNum");
    if (numEl) {
      numEl.innerText = drawnBalls ? drawnBalls.length : 0;
    }
  }

  /**
   * Muestra la franja de los últimos 5 números registrados
   */
  function renderRecentHistory(drawnBalls) {
    const listEl = document.getElementById("publicHistoryList");
    if (!listEl) return;

    if (!drawnBalls || drawnBalls.length === 0) {
      listEl.innerHTML = '<span class="publicHistoryEmpty">Sin números registrados</span>';
      return;
    }

    const last5 = drawnBalls.slice(-5).reverse();
    const html = last5
      .map(function (num, idx) {
        const formatted = window.CopafaSync
          ? window.CopafaSync.formatBallNumber(num)
          : num;
        const isLatest = idx === 0;
        return '<span class="pubHistBall ' + (isLatest ? "pubHistBallLatest" : "") + '">' + formatted + '</span>';
      })
      .join('<span class="pubHistSep"> · </span>');

    listEl.innerHTML = html;
  }

  function getLetter(num) {
    if (num <= 15) return "B";
    if (num <= 30) return "I";
    if (num <= 45) return "N";
    if (num <= 60) return "G";
    return "O";
  }

  function toggleFullScreen() {
    const doc = document.documentElement;
    if (!isFullScreen) {
      if (doc.requestFullscreen) {
        doc.requestFullscreen();
      } else if (doc.webkitRequestFullscreen) {
        doc.webkitRequestFullscreen();
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
  }

  function onFullScreenChange() {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    isFullScreen = !!fsEl;
  }

  // Inicializar al cargar el DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPublicView);
  } else {
    initPublicView();
  }
})();
