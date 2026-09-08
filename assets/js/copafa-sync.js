/**
 * COPAFA Bingo - Módulo Compartido de Estado, Persistencia y Sincronización
 * Fase 2A: Sincronización en tiempo real entre Vista Operador y Vista Pública.
 *
 * Características:
 * - Persistencia centralizada en localStorage (clave: 'copafaBingoState').
 * - Migración automática y segura desde Fase 1 ('bingoMasterBoardSaveData').
 * - Sincronización de latencia cero vía BroadcastChannel ('copafa_bingo').
 * - Fallback automático mediante el evento nativo 'storage' si BroadcastChannel no está disponible.
 * - Prevención de bucles de eco o escrituras redundantes.
 * - 100% estático, offline y compatible con Vercel.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CopafaSync = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STORAGE_KEY = "copafaBingoState";
  const LEGACY_STORAGE_KEY = "bingoMasterBoardSaveData";
  const CHANNEL_NAME = "copafa_bingo";

  const DEFAULT_STATE = {
    version: 2,
    gameTitle: "",
    prizeTitle: "",
    sponsor: "",
    drawnBingoBalls: [],
    themeColor: "classic",
    ballsDrawnRemaining: "drawn",
    updatedAt: 0
  };

  let currentState = Object.assign({}, DEFAULT_STATE);
  const subscribers = new Set();
  let broadcastChannel = null;
  let hasBroadcastSupport = typeof BroadcastChannel !== "undefined";

  // Inicializar BroadcastChannel si está soportado
  if (hasBroadcastSupport) {
    try {
      broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
      broadcastChannel.onmessage = function (event) {
        if (event && event.data && typeof event.data === "object") {
          handleIncomingMessage(event.data);
        }
      };
    } catch (err) {
      console.warn("BroadcastChannel no pudo inicializarse, usando fallback storage:", err);
      hasBroadcastSupport = false;
      broadcastChannel = null;
    }
  }

  // Fallback nativo: evento 'storage' (se dispara en otras pestañas/ventanas)
  if (typeof window !== "undefined") {
    window.addEventListener("storage", function (event) {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const remoteState = JSON.parse(event.newValue);
          if (remoteState && typeof remoteState === "object") {
            applyRemoteState(remoteState, "storage-event");
          }
        } catch (e) {
          console.error("Error al parsear estado desde evento storage:", e);
        }
      }
    });
  }

  /**
   * Procesa mensajes recibidos desde BroadcastChannel
   */
  function handleIncomingMessage(msg) {
    if (msg && msg.state) {
      applyRemoteState(msg.state, "broadcast-channel");
    }
  }

  /**
   * Aplica un estado remoto verificando que sea más reciente o diferente
   */
  function applyRemoteState(incomingState, source) {
    if (!incomingState || typeof incomingState !== "object") return;

    // Si el estado remoto es igual al actual, evitar trabajo innecesario
    const incomingTime = incomingState.updatedAt || 0;
    const currentLocalTime = currentState.updatedAt || 0;

    // Si recibimos un estado remoto válido, sincronizamos
    if (incomingTime >= currentLocalTime || incomingTime === 0) {
      currentState = normalizeState(incomingState);
      notifySubscribers({ source: source, state: currentState });
    }
  }

  /**
   * Valida y normaliza la estructura del estado
   */
  function normalizeState(raw) {
    const s = Object.assign({}, DEFAULT_STATE);
    if (!raw || typeof raw !== "object") return s;

    s.version = 2;
    s.gameTitle = typeof raw.gameTitle === "string" ? raw.gameTitle : "";
    s.prizeTitle = typeof raw.prizeTitle === "string" ? raw.prizeTitle : "";
    s.sponsor = typeof raw.sponsor === "string" ? raw.sponsor : "";
    s.drawnBingoBalls = Array.isArray(raw.drawnBingoBalls) ? raw.drawnBingoBalls.slice() : [];
    s.themeColor = typeof raw.themeColor === "string" ? raw.themeColor : "classic";
    s.ballsDrawnRemaining = typeof raw.ballsDrawnRemaining === "string" ? raw.ballsDrawnRemaining : "drawn";
    s.updatedAt = typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now();
    return s;
  }

  /**
   * Migración segura desde Fase 1 si existe
   */
  function migrateLegacyData(legacy) {
    const migrated = Object.assign({}, DEFAULT_STATE);
    if (legacy && typeof legacy === "object") {
      if (Array.isArray(legacy.drawnBingoBalls)) {
        migrated.drawnBingoBalls = legacy.drawnBingoBalls.slice();
      }
      if (typeof legacy.themeColor === "string") {
        migrated.themeColor = legacy.themeColor;
      }
      if (typeof legacy.ballsDrawnRemaining === "string") {
        migrated.ballsDrawnRemaining = legacy.ballsDrawnRemaining;
      }
    }
    migrated.version = 2;
    migrated.updatedAt = Date.now();
    return migrated;
  }

  /**
   * Carga inicial desde localStorage (con migración si aplica)
   */
  function loadInitialState() {
    if (typeof localStorage === "undefined") {
      return Object.assign({}, DEFAULT_STATE);
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return normalizeState(parsed);
      }

      // Si no existe la nueva clave, verificar la clave legacy de Fase 1
      const legacyStored = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyStored) {
        const parsedLegacy = JSON.parse(legacyStored);
        const migrated = migrateLegacyData(parsedLegacy);
        // Guardar la migración en la nueva clave sin borrar la antigua
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    } catch (err) {
      console.error("Error al cargar estado inicial de COPAFA Bingo:", err);
    }

    return Object.assign({}, DEFAULT_STATE);
  }

  // Cargar estado inicial al instanciar el módulo
  currentState = loadInitialState();

  /**
   * Guarda el estado en localStorage y lo transmite a otras ventanas
   */
  function persistAndBroadcast(state, meta) {
    state.updatedAt = Date.now();
    currentState = state;

    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (err) {
        console.error("Error al guardar estado en localStorage:", err);
      }
    }

    // Transmitir vía BroadcastChannel
    if (hasBroadcastSupport && broadcastChannel) {
      try {
        broadcastChannel.postMessage({
          type: "STATE_UPDATED",
          state: state,
          meta: meta || {}
        });
      } catch (err) {
        console.error("Error al enviar mensaje por BroadcastChannel:", err);
      }
    }

    notifySubscribers({ source: "local", state: state, meta: meta });
  }

  function notifySubscribers(payload) {
    subscribers.forEach(function (callback) {
      try {
        callback(currentState, payload);
      } catch (err) {
        console.error("Error en subscriber de CopafaSync:", err);
      }
    });
  }

  /* ==========================================================================
     UTILITARIOS BINGO (Derivación de Letras, Colores y Formatos)
     ========================================================================== */

  function typeOfBingoLetter(num) {
    if (num <= 15) return "B";
    if (num <= 30) return "I";
    if (num <= 45) return "N";
    if (num <= 60) return "G";
    return "O";
  }

  function typeOfBingo(num, style) {
    if (style === "vintage") {
      return "bingoBallVintageActive";
    }
    if (num <= 15) return "bingoBallBallActiveB";
    if (num <= 30) return "bingoBallBallActiveI";
    if (num <= 45) return "bingoBallBallActiveN";
    if (num <= 60) return "bingoBallBallActiveG";
    return "bingoBallBallActiveO";
  }

  function formatBallNumber(num) {
    const letter = typeOfBingoLetter(num);
    const formattedNum = num < 10 ? "0" + num : "" + num;
    return letter + "-" + formattedNum;
  }

  /* ==========================================================================
     API PÚBLICA DE COPAFA SYNC
     ========================================================================== */

  return {
    /**
     * Retorna una copia inmutable del estado actual
     */
    getState: function () {
      return Object.assign({}, currentState, {
        drawnBingoBalls: currentState.drawnBingoBalls.slice()
      });
    },

    /**
     * Guarda un estado completo
     */
    saveState: function (newState, meta) {
      const normalized = normalizeState(newState);
      persistAndBroadcast(normalized, meta);
      return this.getState();
    },

    /**
     * Actualiza parcialmente el estado
     */
    updateState: function (partial, meta) {
      const merged = Object.assign({}, currentState, partial);
      return this.saveState(merged, meta);
    },

    /**
     * Registra manualmente una balota (si no está registrada)
     */
    addBall: function (num) {
      const n = parseInt(num, 10);
      if (isNaN(n) || n < 1 || n > 75) return false;
      if (currentState.drawnBingoBalls.indexOf(n) !== -1) {
        return false; // Protección contra duplicados y clics accidentales
      }

      const nextBalls = currentState.drawnBingoBalls.slice();
      nextBalls.push(n);

      this.updateState(
        { drawnBingoBalls: nextBalls },
        { action: "ADD_BALL", ball: n }
      );
      return true;
    },

    /**
     * Deshace únicamente la última balota registrada
     */
    undoLastBall: function () {
      if (!currentState.drawnBingoBalls || currentState.drawnBingoBalls.length === 0) {
        return null;
      }

      const nextBalls = currentState.drawnBingoBalls.slice();
      const removed = nextBalls.pop();

      this.updateState(
        { drawnBingoBalls: nextBalls },
        { action: "UNDO_BALL", ball: removed }
      );
      return removed;
    },

    /**
     * Limpia únicamente las balotas jugadas (conserva datos de partida y premio)
     */
    resetDrawnBalls: function () {
      this.updateState(
        { drawnBingoBalls: [] },
        { action: "RESET_BALLS" }
      );
      return true;
    },

    /**
     * Actualiza la información descriptiva de la partida
     */
    setGameInfo: function (gameTitle, prizeTitle, sponsor) {
      this.updateState(
        {
          gameTitle: typeof gameTitle === "string" ? gameTitle.trim() : "",
          prizeTitle: typeof prizeTitle === "string" ? prizeTitle.trim() : "",
          sponsor: typeof sponsor === "string" ? sponsor.trim() : ""
        },
        { action: "UPDATE_GAME_INFO" }
      );
      return true;
    },

    /**
     * Suscribe una función para recibir actualizaciones de estado
     */
    subscribe: function (callback) {
      if (typeof callback === "function") {
        subscribers.add(callback);
        return function () {
          subscribers.delete(callback);
        };
      }
      return function () {};
    },

    /**
     * Helpers de derivación y formato
     */
    typeOfBingoLetter: typeOfBingoLetter,
    typeOfBingo: typeOfBingo,
    formatBallNumber: formatBallNumber,
    hasBroadcastSupport: function () {
      return hasBroadcastSupport;
    },
    STORAGE_KEY: STORAGE_KEY,
    CHANNEL_NAME: CHANNEL_NAME
  };
});
