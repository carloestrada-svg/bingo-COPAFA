/**
 * COPAFA Bingo - Módulo Compartido de Estado, Persistencia y Sincronización
 * Versión 3 (Sprint Final): Plataforma Reutilizable COPAFA Bingo.
 *
 * Características:
 * - Persistencia centralizada en localStorage (clave: 'copafaBingoState').
 * - Defaults 100% neutrales (plataforma reutilizable para cualquier año o actividad).
 * - Migración limpia y segura desde Versión 2 y desde Fase 1 ('bingoMasterBoardSaveData').
 * - Presets de eventos editables (Fiesta Familiar SSCC 2026) configurables como opciones rápidas.
 * - Sincronización en tiempo real vía BroadcastChannel ('copafa_bingo') con latencia < 5ms.
 * - Fallback automático mediante el evento nativo 'storage'.
 * - 100% estático, sin dependencias npm, compatible con Vercel.
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

  /**
   * Catálogo de Modalidades de Juego (Patrones 5x5)
   * Los números 1 al 25 representan las celdas ordenadas por columnas B-I-N-G-O:
   * Col B: 1..5, Col I: 6..10, Col N: 11..15, Col G: 16..20, Col O: 21..25
   */
  const PATTERN_PRESETS = {
    "none": {
      id: "none",
      name: "Sin modalidad",
      cells: []
    },
    "line_h": {
      id: "line_h",
      name: "Línea Horizontal",
      cells: [3, 8, 13, 18, 23]
    },
    "line_v": {
      id: "line_v",
      name: "Línea Vertical",
      cells: [11, 12, 13, 14, 15]
    },
    "diagonal": {
      id: "diagonal",
      name: "Diagonal",
      cells: [1, 7, 13, 19, 25]
    },
    "four_corners": {
      id: "four_corners",
      name: "Cuatro Esquinas",
      cells: [1, 5, 21, 25]
    },
    "letter_l": {
      id: "letter_l",
      name: "Letra L",
      cells: [1, 2, 3, 4, 5, 10, 15, 20, 25]
    },
    "letter_u": {
      id: "letter_u",
      name: "Letra U",
      cells: [1, 2, 3, 4, 5, 10, 15, 20, 21, 22, 23, 24, 25]
    },
    "letter_x": {
      id: "letter_x",
      name: "Letra X",
      cells: [1, 5, 7, 9, 13, 17, 19, 21, 25]
    },
    "letter_t": {
      id: "letter_t",
      name: "Letra T",
      cells: [1, 6, 11, 12, 13, 14, 15, 16, 21]
    },
    "letter_h": {
      id: "letter_h",
      name: "Letra H",
      cells: [1, 2, 3, 4, 5, 8, 13, 18, 21, 22, 23, 24, 25]
    },
    "blackout": {
      id: "blackout",
      name: "Apagón",
      cells: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]
    },
    "custom": {
      id: "custom",
      name: "Personalizado",
      cells: []
    }
  };

  /**
   * Presets del evento Fiesta Familiar SSCC 2026 (opciones rápidas editables, NO defaults)
   */
  const EVENT_PRESETS = [
    {
      id: "preset1",
      label: "Preset 1",
      sublabel: "1er Juego · Letra L · S/ 500",
      eventTitle: "Fiesta Familiar SSCC 2026",
      gameTitle: "1er Juego",
      patternType: "letter_l",
      patternName: "Letra L",
      customPattern: [1, 2, 3, 4, 5, 10, 15, 20, 25],
      prizeTitle: "S/ 500"
    },
    {
      id: "preset2",
      label: "Preset 2",
      sublabel: "2do Juego · Letra U · S/ 1,000",
      eventTitle: "Fiesta Familiar SSCC 2026",
      gameTitle: "2do Juego",
      patternType: "letter_u",
      patternName: "Letra U",
      customPattern: [1, 2, 3, 4, 5, 10, 15, 20, 21, 22, 23, 24, 25],
      prizeTitle: "S/ 1,000"
    },
    {
      id: "preset3",
      label: "Preset 3",
      sublabel: "3er Juego · Apagón · S/ 1,500",
      eventTitle: "Fiesta Familiar SSCC 2026",
      gameTitle: "3er Juego",
      patternType: "blackout",
      patternName: "Apagón",
      customPattern: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
      prizeTitle: "S/ 1,500"
    }
  ];

  /**
   * Estado default neutral del sistema (sin datos hardcodeados de un año o modalidad fija)
   */
  const DEFAULT_STATE = {
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

    const incomingTime = incomingState.updatedAt || 0;
    const currentLocalTime = currentState.updatedAt || 0;

    // Si recibimos un estado remoto válido, sincronizamos
    if (incomingTime >= currentLocalTime || incomingTime === 0) {
      currentState = normalizeState(incomingState);
      notifySubscribers({ source: source, state: currentState });
    }
  }

  /**
   * Valida y normaliza la estructura del estado v3 de manera neutral
   */
  function normalizeState(raw) {
    const s = Object.assign({}, DEFAULT_STATE);
    if (!raw || typeof raw !== "object") return s;

    s.version = 3;
    s.eventTitle = typeof raw.eventTitle === "string" ? raw.eventTitle : "";
    s.gameTitle = typeof raw.gameTitle === "string" ? raw.gameTitle : "";
    s.prizeTitle = typeof raw.prizeTitle === "string" ? raw.prizeTitle : "";
    s.sponsor = typeof raw.sponsor === "string" ? raw.sponsor : "";

    // Normalizar modalidad (por defecto "none" / "Sin modalidad" si no se especificó)
    const pType = typeof raw.patternType === "string" && raw.patternType ? raw.patternType : "none";
    s.patternType = pType;

    const defaultPreset = PATTERN_PRESETS[pType];
    s.patternName = typeof raw.patternName === "string" && raw.patternName
      ? raw.patternName
      : (defaultPreset ? defaultPreset.name : (pType === "none" ? "Sin modalidad" : "Personalizado"));

    // Normalizar casillas del patrón (1..25)
    if (Array.isArray(raw.customPattern) && (pType === "custom" || raw.customPattern.length > 0)) {
      s.customPattern = raw.customPattern.map(Number).filter(function (n) {
        return !isNaN(n) && n >= 1 && n <= 25;
      });
    } else if (defaultPreset && defaultPreset.cells) {
      s.customPattern = defaultPreset.cells.slice();
    } else {
      s.customPattern = [];
    }

    s.drawnBingoBalls = Array.isArray(raw.drawnBingoBalls)
      ? raw.drawnBingoBalls.map(Number).filter(function (n) { return !isNaN(n) && n >= 1 && n <= 75; })
      : [];

    s.themeColor = typeof raw.themeColor === "string" ? raw.themeColor : "classic";
    s.ballsDrawnRemaining = typeof raw.ballsDrawnRemaining === "string" ? raw.ballsDrawnRemaining : "drawn";
    s.updatedAt = typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now();
    return s;
  }

  /**
   * Migración neutral desde Versión 2 o Fase 1
   * NO inserta eventos ni modalidades obligatorias si no venían en los datos.
   */
  function migrateLegacyData(legacy) {
    const migrated = Object.assign({}, DEFAULT_STATE);
    if (legacy && typeof legacy === "object") {
      if (Array.isArray(legacy.drawnBingoBalls)) {
        migrated.drawnBingoBalls = legacy.drawnBingoBalls.map(Number);
      }
      if (typeof legacy.gameTitle === "string") {
        migrated.gameTitle = legacy.gameTitle;
      }
      if (typeof legacy.prizeTitle === "string") {
        migrated.prizeTitle = legacy.prizeTitle;
      }
      if (typeof legacy.sponsor === "string") {
        migrated.sponsor = legacy.sponsor;
      }
      if (typeof legacy.eventTitle === "string") {
        migrated.eventTitle = legacy.eventTitle;
      } else {
        migrated.eventTitle = "";
      }
      if (typeof legacy.themeColor === "string") {
        migrated.themeColor = legacy.themeColor;
      }
      if (typeof legacy.ballsDrawnRemaining === "string") {
        migrated.ballsDrawnRemaining = legacy.ballsDrawnRemaining;
      }
      // Reutilizar winningPattern original de TimTree si existía realmente
      if (Array.isArray(legacy.winningPattern) && legacy.winningPattern.length > 0) {
        migrated.patternType = "custom";
        migrated.patternName = "Personalizado";
        migrated.customPattern = legacy.winningPattern.map(Number);
      } else if (legacy.patternType && legacy.patternType !== "none") {
        migrated.patternType = legacy.patternType;
        migrated.patternName = legacy.patternName || (PATTERN_PRESETS[legacy.patternType] ? PATTERN_PRESETS[legacy.patternType].name : "Personalizado");
        migrated.customPattern = Array.isArray(legacy.customPattern) ? legacy.customPattern.slice() : [];
      } else {
        migrated.patternType = "none";
        migrated.patternName = "Sin modalidad";
        migrated.customPattern = [];
      }
    }
    migrated.version = 3;
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
        if (parsed && typeof parsed === "object") {
          // Si era versión 2 o inferior, normalizar a v3 neutralmente
          return normalizeState(parsed);
        }
      }

      // Si no existe la nueva clave, verificar la clave legacy de Fase 1
      const legacyStored = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyStored) {
        const parsedLegacy = JSON.parse(legacyStored);
        const migrated = migrateLegacyData(parsedLegacy);
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
    PATTERN_PRESETS: PATTERN_PRESETS,
    EVENT_PRESETS: EVENT_PRESETS,

    /**
     * Retorna una copia inmutable del estado actual
     */
    getState: function () {
      return Object.assign({}, currentState, {
        drawnBingoBalls: currentState.drawnBingoBalls.slice(),
        customPattern: currentState.customPattern ? currentState.customPattern.slice() : []
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
     * Limpia únicamente las balotas jugadas (conserva evento, partida, premio, modalidad y patrocinador)
     */
    resetDrawnBalls: function () {
      this.updateState(
        { drawnBingoBalls: [] },
        { action: "RESET_BALLS" }
      );
      return true;
    },

    /**
     * Actualiza la información del evento y partida
     */
    setGameInfo: function (info) {
      if (!info || typeof info !== "object") return false;
      const patch = {};
      if (typeof info.eventTitle === "string") patch.eventTitle = info.eventTitle.trim();
      if (typeof info.gameTitle === "string") patch.gameTitle = info.gameTitle.trim();
      if (typeof info.prizeTitle === "string") patch.prizeTitle = info.prizeTitle.trim();
      if (typeof info.sponsor === "string") patch.sponsor = info.sponsor.trim();

      if (info.patternType) {
        patch.patternType = info.patternType;
        if (info.patternName) {
          patch.patternName = info.patternName;
        } else if (PATTERN_PRESETS[info.patternType]) {
          patch.patternName = PATTERN_PRESETS[info.patternType].name;
        }
      }
      if (Array.isArray(info.customPattern)) {
        patch.customPattern = info.customPattern.slice();
      }

      this.updateState(patch, { action: "UPDATE_GAME_INFO" });
      return true;
    },

    /**
     * Actualiza la modalidad y el patrón de juego
     */
    setPattern: function (patternType, customPattern) {
      if (!patternType || patternType === "none") {
        this.updateState({
          patternType: "none",
          patternName: "Sin modalidad",
          customPattern: []
        }, { action: "SET_PATTERN" });
        return true;
      }

      const preset = PATTERN_PRESETS[patternType];
      let name = "Personalizado";
      let cells = [];

      if (preset && patternType !== "custom") {
        name = preset.name;
        cells = preset.cells.slice();
      } else {
        patternType = "custom";
        name = "Personalizado";
        if (Array.isArray(customPattern)) {
          cells = customPattern.slice();
        }
      }

      this.updateState({
        patternType: patternType,
        patternName: name,
        customPattern: cells
      }, { action: "SET_PATTERN" });
      return true;
    },

    /**
     * Carga un preset rápido de evento (Preset 1, 2 o 3)
     */
    applyEventPreset: function (indexOrId) {
      let preset = null;
      if (typeof indexOrId === "number") {
        preset = EVENT_PRESETS[indexOrId];
      } else {
        preset = EVENT_PRESETS.find(function (p) { return p.id === indexOrId; });
      }

      if (!preset) return false;

      this.updateState({
        eventTitle: preset.eventTitle,
        gameTitle: preset.gameTitle,
        prizeTitle: preset.prizeTitle,
        patternType: preset.patternType,
        patternName: preset.patternName,
        customPattern: preset.customPattern.slice()
      }, { action: "APPLY_EVENT_PRESET", presetId: preset.id });
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
