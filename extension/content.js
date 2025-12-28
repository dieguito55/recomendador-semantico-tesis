// content.js - Nexus Academic AI v3.1 (Multi-Repo + API Compatibility Edition)
// Autor: Tu Experto en IA & UX

// =====================================================
// ✅ API BASE (configurable)
// =====================================================
const API_DEFAULT = "http://localhost:8000";
let API = API_DEFAULT;

// Cargar API desde storage si existe
try {
  chrome.storage?.local?.get(["nexusApiBase"], (r) => {
    if (r?.nexusApiBase && typeof r.nexusApiBase === "string") {
      API = r.nexusApiBase.replace(/\/+$/, "");
      console.log("[NEXUS] API base set from storage:", API);
    }
  });
} catch (_) { /* ignore */ }

let panelOpen = false;
let currentInferredTopicId = null;
let welcomeShown = false;

// Configuración de Colores y Estilos
const NEXUS_THEME = {
  primary: "#18212B",
  secondary: "#A50000",       // Rojo UNAP
  secondary_alt: "#5D101D",   // Guinda UNSA
  accent: "#D1CC76",
  highlight: "#F2E205",
  light: "#FFFFFF",
  dark: "#0F1419",
  muted: "#6C7382",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  border: "#DDE0E8"
};

// Estado Global
let currentQueryContext = {
  mode: "manual",
  source_uuid: null,
  source_title: null,
  source_url: null,
  query_text: "",
  timestamp: null
};

// Iconografía SVG Optimizada
const ICONS = {
  logo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  magic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3L9.5 12L3 12L10 17L7.5 21L12 16.5L16.5 21L14 17L21 12L14.5 12L12 3Z"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  compare: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
  link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>`,
  stats: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>`,
  filter: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>`
};

// =====================================================
// --- Inyección de Estilos Dinámicos (Badges) ---
// =====================================================
function injectCustomStyles() {
  const styleId = "nexus-styles-injected";
  if (document.getElementById(styleId)) return;

  const css = `
    .nexus-uni-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 800;
      color: #fff;
      margin-right: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      line-height: 1.2;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      white-space: nowrap;
    }
    .nexus-badge-unap { background-color: ${NEXUS_THEME.secondary}; border: 1px solid #800000; }
    .nexus-badge-unsa { background-color: ${NEXUS_THEME.secondary_alt}; border: 1px solid #3d0a12; }

    .nexus-stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin: 15px 0;
      text-align: center;
    }
    .nexus-stat-box {
      background: #f8fafc;
      padding: 10px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .nexus-stat-number {
      font-weight: 800;
      font-size: 1.2rem;
      color: ${NEXUS_THEME.primary};
      display: block;
    }
    .nexus-stat-label {
      font-size: 0.75rem;
      color: ${NEXUS_THEME.muted};
      text-transform: uppercase;
    }
  `;
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = css;
  document.head.appendChild(style);
}

// =====================================================
// --- Utilidades ---
// =====================================================
function esc(s) {
  if (!s) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function getUUID(url) {
  const m = String(url || "").match(/\/items\/([0-9a-fA-F-]{36})/);
  return m ? m[1] : null;
}

function detectUniversityFromHost(hostname) {
  const h = (hostname || "").toLowerCase();
  if (h.includes("unsa")) return "UNSA";
  if (h.includes("unap")) return "UNAP";
  return null;
}

function getUniBadgeHTML(uni) {
  const u = (uni || "").toString().trim() || "UNAP";
  const upper = u.toUpperCase();
  const isUNSA = upper.includes("UNSA");
  const cls = isUNSA ? "nexus-badge-unsa" : "nexus-badge-unap";
  const label = isUNSA ? "UNSA" : "UNAP";
  return `<span class="nexus-uni-badge ${cls}" title="Fuente: ${esc(u)}">${label}</span>`;
}

// -----------------------------------------------------
// ✅ Fetch con timeout + JSON seguro
// -----------------------------------------------------
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function safeJson(res) {
  try { return await res.json(); } catch (_) { return null; }
}

// -----------------------------------------------------
// ✅ API helper (tolerante a cambios del backend)
// -----------------------------------------------------
async function apiPost(path, payload) {
  const url = `${API}${path}`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  }, 20000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await safeJson(res);
  if (!data) throw new Error("Respuesta inválida (no JSON)");
  return data;
}

async function apiGet(path) {
  const url = `${API}${path}`;
  const res = await fetchWithTimeout(url, { method: "GET" }, 20000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await safeJson(res);
  if (!data) throw new Error("Respuesta inválida (no JSON)");
  return data;
}

// =====================================================
// ✅ fetchMeta multi-repo (UNAP / UNSA / fallback)
// =====================================================
async function fetchMeta(uuid) {
  const origin = location.origin; // usa el mismo dominio del repo actual
  const uniGuess = detectUniversityFromHost(location.hostname) || "UNAP";

  const candidates = [
    `${origin}/server/api/core/items/${uuid}`,                         // el actual
    `https://repositorio.unap.edu.pe/server/api/core/items/${uuid}`,   // fallback UNAP
    `https://repositorio.unsa.edu.pe/server/api/core/items/${uuid}`    // fallback UNSA (si existe en tu caso)
  ];

  for (const url of candidates) {
    try {
      const r = await fetchWithTimeout(url, {
        credentials: "omit",
        headers: { "Accept": "application/json" }
      }, 15000);

      if (!r.ok) continue;
      const d = await safeJson(r);
      if (!d) continue;

      const m = d.metadata || {};
      const title = m["dc.title"]?.[0]?.value || "Sin título";
      const abstract = m["dc.description.abstract"]?.[0]?.value || m["dc.description"]?.[0]?.value || "Sin resumen disponible";
      const author = m["dc.contributor.author"]?.[0]?.value || "Autor desconocido";
      const date = m["dc.date.issued"]?.[0]?.value || "Fecha desconocida";

      const hostUni = detectUniversityFromHost(new URL(url).hostname) || uniGuess;

      return { title, abstract, author, date, university: hostUni };
    } catch (e) {
      // intenta el siguiente candidato
      continue;
    }
  }

  console.error("Error fetching metadata: no candidates worked");
  return { title: "", abstract: "", author: "", date: "", university: uniGuess };
}

// =====================================================
// Tokenize / Highlight
// =====================================================
function tokenize(text) {
  const stopWords = new Set([
    "de","la","el","y","en","a","los","las","un","una","para","por","con","del","al","que","se","es",
    "su","como","más","pero","sus","le","ha","me","si","sin","sobre","este","ya","entre","cuando",
    "todo","esta","ser","son","tesis","universidad","unap","puno","peru","perú","facultad","escuela",
    "profesional","investigacion","investigación","estudio","analisis","análisis","resultados","conclusiones",
    "arequipa","unsa","agustin"
  ]);

  return (text || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

function highlight(text, matchSet) {
  if (!text || !matchSet.size) return esc(text);

  const words = text.split(/(\b)/);
  return words.map(w => {
    const clean = w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return (clean && matchSet.has(clean)) ? `<mark>${esc(w)}</mark>` : esc(w);
  }).join("");
}

// =====================================================
// --- Storage (Persistencia) ---
// =====================================================
async function getSaved() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["nexusSaved"], (result) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(Array.isArray(result.nexusSaved) ? result.nexusSaved : []);
    });
  });
}

async function setSaved(list) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ nexusSaved: list }, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(true);
    });
  });
}

function buildSaveContext(queryText) {
  const q = (queryText || "").trim();
  if (currentQueryContext.mode === "page" && currentQueryContext.source_title) {
    return {
      contextTitle: currentQueryContext.source_title,
      contextText: "",
      contextUrl: currentQueryContext.source_url,
      queryTextFull: q,
      mode: "page",
      timestamp: new Date().toISOString()
    };
  }
  const snippet = q.length > 1000 ? q.slice(0, 1000) + "…" : q;
  return {
    contextTitle: "Búsqueda Manual",
    contextText: snippet,
    contextUrl: null,
    queryTextFull: q,
    mode: "manual",
    timestamp: new Date().toISOString()
  };
}

async function toggleFav(item, queryText) {
  try {
    let list = await getSaved();
    const existingIndex = list.findIndex(x => x.uuid === item.uuid);

    if (existingIndex >= 0) {
      list.splice(existingIndex, 1);
      await setSaved(list);
      showNotification("Elemento eliminado de bibliografía", "info");
      updateSavedCount();
      return false;
    }

    const context = buildSaveContext(queryText);
    const itemAbs = (item.abstract_norm || item.abstract || "").trim();
    const itemTitle = (item.title || "").trim();

    list.unshift({
      uuid: item.uuid,
      title: itemTitle,
      url: item.url,
      label: item.label,
      score: item.score,
      author: item.author,
      date: item.date,
      university: item.university, // ✅ Guardamos la universidad

      contextTitle: context.contextTitle,
      contextText: context.contextText,
      contextUrl: context.contextUrl,

      queryTextFull: (context.queryTextFull || "").slice(0, 5000),
      itemTextFull: (itemAbs || itemTitle).slice(0, 5000),

      savedDate: new Date().toISOString(),
      tags: []
    });

    await setSaved(list);
    showNotification("Guardado en bibliografía", "success");
    updateSavedCount();
    return true;
  } catch (error) {
    console.error("Error en toggleFav:", error);
    showNotification("Error al guardar elemento", "error");
    return false;
  }
}

async function removeSavedByUUID(uuid) {
  try {
    const all = await getSaved();
    const newList = all.filter(x => x.uuid !== uuid);
    await setSaved(newList);
    showNotification("Elemento eliminado", "info");
    updateSavedCount();
  } catch (error) {
    console.error("Error removing saved item:", error);
  }
}

// ✅ Esto faltaba en tu archivo (lo usas en varios lados)
async function updateSavedCount() {
  try {
    const saved = await getSaved();
    const el = document.getElementById("savedCount");
    if (el) el.textContent = String(saved.length || 0);
  } catch (_) { /* ignore */ }
}

// =====================================================
// --- UI Components ---
// =====================================================
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `unap-notification unap-notification-${type}`;
  notification.innerHTML = `<div class="unap-notification-content"><span>${esc(message)}</span></div>`;
  document.body.appendChild(notification);

  setTimeout(() => notification.classList.add("unap-notification-show"), 10);
  setTimeout(() => {
    notification.classList.remove("unap-notification-show");
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function showDeleteModal(onConfirm) {
  const overlay = document.createElement("div");
  overlay.className = "unap-modal-overlay";
  overlay.innerHTML = `
    <div class="unap-modal">
      <div class="unap-modal-header">
        <h2 class="unap-modal-title">Eliminar Referencia</h2>
        <p class="unap-modal-description">¿Estás seguro de eliminar este elemento?</p>
      </div>
      <div class="unap-modal-body"><p class="unap-modal-content">Esta acción no se puede deshacer.</p></div>
      <div class="unap-modal-actions">
        <button class="unap-modal-action-btn unap-modal-action-cancel" id="modalCancel">Cancelar</button>
        <button class="unap-modal-action-btn unap-modal-action-delete" id="modalDelete">Eliminar</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  document.getElementById("modalCancel").onclick = () => overlay.remove();
  document.getElementById("modalDelete").onclick = () => { overlay.remove(); onConfirm(); };
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

function showStatsModal() {
  getSaved().then(saved => {
    const overlay = document.createElement("div");
    overlay.className = "unap-modal-overlay";

    const avgScore = saved.length > 0
      ? Math.round((saved.reduce((sum, item) => sum + (item.score || 0), 0) / saved.length) * 100)
      : 0;

    const countUnap = saved.filter(i => (!i.university || i.university === "UNAP")).length;
    const countUnsa = saved.filter(i => (i.university || "").toUpperCase().includes("UNSA")).length;

    overlay.innerHTML = `
      <div class="unap-stats-modal">
        <div class="unap-stats-header">
          <h2 class="unap-stats-title">📊 Estadísticas del Sistema</h2>
        </div>

        <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
          <h4 style="margin-bottom:10px; color:#666;">Base de Conocimiento (Indexado)</h4>
          <div class="nexus-stats-grid">
            <div class="nexus-stat-box">
              <span class="nexus-stat-number">16,761</span>
              <span class="nexus-stat-label">UNAP (Puno)</span>
            </div>
            <div class="nexus-stat-box">
              <span class="nexus-stat-number">19,856</span>
              <span class="nexus-stat-label">UNSA (Arequipa)</span>
            </div>
          </div>
          <div style="text-align:center; font-size:0.9rem; font-weight:bold; color:#18212B;">
            Total: 36,617 Tesis Disponibles
          </div>
        </div>

        <h4 style="margin-bottom:10px; color:#666;">Tu Bibliografía</h4>
        <div class="unap-stats-grid">
          <div class="unap-stat-item">
            <div class="unap-stat-value">${saved.length}</div>
            <div class="unap-stat-label">Guardados</div>
          </div>
          <div class="unap-stat-item">
            <div class="unap-stat-value">${avgScore}%</div>
            <div class="unap-stat-label">Relevancia Media</div>
          </div>
          <div class="unap-stat-item">
            <div class="unap-stat-value">${countUnap}</div>
            <div class="unap-stat-label">De UNAP</div>
          </div>
          <div class="unap-stat-item">
            <div class="unap-stat-value">${countUnsa}</div>
            <div class="unap-stat-label">De UNSA</div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 20px;">
          <button class="btn btn-primary" id="closeStats" style="width: 100%;">Cerrar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.getElementById("closeStats").onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  });
}

function buildPanel() {
  if (document.getElementById("unapRecoPanel")) document.getElementById("unapRecoPanel").remove();

  injectCustomStyles();

  const panel = document.createElement("div");
  panel.id = "unapRecoPanel";
  panel.innerHTML = `
    <div class="unap-overlay" id="unapOverlay"></div>

    <div class="unap-welcome ${welcomeShown ? 'hidden' : ''}" id="unapWelcome">
      <div class="unap-welcome-logo">${ICONS.logo}</div>
      <h2 class="unap-welcome-title">Nexus Academic AI</h2>
      <p class="unap-welcome-subtitle">Conectando Inteligencia de UNAP & UNSA</p>

      <div style="background: #f1f5f9; padding: 10px; border-radius: 8px; margin: 15px 0; text-align: center;">
        <p style="margin:0; font-size: 0.9rem; color: #475569;">
          Acceso a <strong style="color: #0f172a;">36,617</strong> tesis doctorales y de maestría.
        </p>
        <div style="display:flex; justify-content:center; gap:15px; margin-top:5px; font-size:0.8rem; color:#64748b;">
          <span>🔴 UNAP: 16,761</span>
          <span>🟤 UNSA: 19,856</span>
        </div>
      </div>

      <div class="unap-features">
        <div class="unap-feature">
          <div class="unap-feature-icon">${ICONS.magic}</div>
          <div class="unap-feature-content"><h4>Búsqueda Semántica</h4><p>Encuentra por significado, no solo palabras</p></div>
        </div>
        <div class="unap-feature">
          <div class="unap-feature-icon">${ICONS.compare}</div>
          <div class="unap-feature-content"><h4>Multi-Repositorio</h4><p>Resultados unificados de Puno y Arequipa</p></div>
        </div>
        <div class="unap-feature">
          <div class="unap-feature-icon">${ICONS.heart}</div>
          <div class="unap-feature-content"><h4>Bibliografía</h4><p>Gestiona referencias cruzadas fácilmente</p></div>
        </div>
      </div>

      <div class="unap-welcome-actions">
        <button class="btn btn-primary" id="btnSkipTutorial">Explorar Repositorios</button>
      </div>
    </div>

    <div class="unap-container">
      <header class="unap-header">
        <div class="unap-header-brand">
          <div class="unap-logo">${ICONS.logo}</div>
          <div class="unap-header-text">
            <h1 class="unap-title">Nexus Academic AI</h1>
            <p class="unap-subtitle">Inteligencia Sur Andina</p>
          </div>
        </div>
        <div class="unap-header-actions">
          <button class="unap-header-btn" id="btnExport" title="Exportar CSV">${ICONS.download}</button>
          <button class="unap-header-btn" id="btnStats" title="Estadísticas">${ICONS.stats}</button>
          <button class="unap-header-btn" id="unapClose" title="Cerrar">${ICONS.close}</button>
        </div>
      </header>

      <nav class="unap-nav">
        <div class="unap-nav-tabs">
          <button class="unap-nav-tab active" data-view="search">
            <span class="unap-nav-icon">${ICONS.search}</span><span class="unap-nav-text">Buscador</span>
          </button>
          <button class="unap-nav-tab" data-view="topics">
            <span class="unap-nav-icon">${ICONS.magic}</span><span class="unap-nav-text">Temas</span>
          </button>
          <button class="unap-nav-tab" data-view="bibliography">
            <span class="unap-nav-icon">${ICONS.heart}</span><span class="unap-nav-text">Bibliografía</span>
            <span class="unap-nav-badge" id="savedCount">0</span>
          </button>
        </div>
      </nav>

      <main class="unap-main">
        <div class="unap-view active" id="viewSearch">
          <div class="unap-search-container">
            <div class="unap-search-header">
              <h2 class="unap-view-title">Búsqueda Semántica Unificada</h2>
              <p class="unap-view-subtitle">Analizando 36k+ tesis de UNAP y UNSA</p>
            </div>

            <div class="unap-input-group">
              <div class="unap-input-label">
                <label for="queryText">Describe tu investigación</label>
                <div class="unap-input-actions">
                  <button class="btn btn-sm btn-secondary" id="btnAutoDetect">${ICONS.magic} Auto-contexto</button>
                  <button class="btn btn-sm btn-secondary" id="btnClear">Limpiar</button>
                </div>
              </div>
              <textarea id="queryText" class="unap-textarea" placeholder="Ej: Algoritmos de visión artificial para seguridad ciudadana en zonas altoandinas..." rows="6"></textarea>
              <div class="unap-input-footer">
                <div class="unap-char-count" id="charCount">0 caracteres</div>
                <button class="btn btn-primary" id="btnSearch">${ICONS.search} Buscar</button>
              </div>
            </div>
            <div class="unap-context-info" id="contextInfo"></div>
          </div>

          <div class="unap-results-container">
            <div class="unap-results-header">
              <h3 class="unap-results-title">Resultados</h3>
              <div class="unap-results-filter">
                <select id="filterSort" class="unap-select">
                  <option value="relevance">Mayor relevancia</option>
                  <option value="date">Más recientes</option>
                  <option value="title">A-Z</option>
                </select>
                <select id="filterCount" class="unap-select">
                  <option value="10">10 resultados</option>
                  <option value="20">20 resultados</option>
                  <option value="50">50 resultados</option>
                </select>
              </div>
            </div>
            <div id="resultsList" class="unap-results-list"></div>
          </div>
        </div>

        <div class="unap-view" id="viewTopics">
          <div class="unap-topics-container">
            <div class="unap-topics-header">
              <h2 class="unap-view-title">Mapa de Conocimiento</h2>
              <p class="unap-view-subtitle">Agrupación inteligente por áreas de investigación</p>
            </div>
            <div class="unap-topics-controls">
              <input type="text" id="topicSearch" class="unap-search-input" placeholder="Filtrar temas...">
              <select id="topicFilter" class="unap-select">
                <option value="all">Todos</option>
                <option value="popular">Más densos</option>
              </select>
            </div>
            <div id="topicsGrid" class="unap-topics-grid"></div>
            <div id="topicDetailView" class="unap-topic-detail" style="display: none;">
              <div class="unap-topic-detail-header">
                <button class="btn btn-secondary" id="btnBackTopics">${ICONS.back} Volver</button>
                <h3 id="topicDetailTitle" class="unap-topic-detail-title"></h3>
              </div>
              <div id="topicItemsList" class="unap-topic-items"></div>
            </div>
          </div>
        </div>

        <div class="unap-view" id="viewBibliography">
          <div class="unap-bibliography-container">
            <div class="unap-bibliography-header">
              <h2 class="unap-view-title">Mi Bibliografía</h2>
              <p class="unap-view-subtitle">Referencias guardadas de ambas universidades</p>
            </div>
            <div class="unap-bibliography-controls">
              <div class="unap-search-group">
                <input type="text" id="biblioSearch" class="unap-search-input" placeholder="Buscar en guardados...">
                ${ICONS.search}
              </div>
              <div class="unap-bibliography-actions">
                <button class="btn btn-secondary" id="btnExportBiblio">${ICONS.download} CSV</button>
                <button class="btn btn-danger" id="btnClearBiblio">${ICONS.trash} Vaciar</button>
              </div>
            </div>
            <div id="savedItemsList" class="unap-bibliography-list"></div>
            <div class="unap-empty-state" id="emptyBibliography" style="display: none;">
              <div class="unap-empty-icon">${ICONS.heart}</div>
              <h3>Bibliografía vacía</h3>
              <p>Guarda tesis relevantes para exportarlas después.</p>
            </div>
          </div>
        </div>
      </main>

      <footer class="unap-footer">
        <div class="unap-footer-info">
          <span class="unap-footer-text">Nexus AI v3.1 Premium</span>
          <span class="unap-footer-separator">•</span>
          <span class="unap-footer-text">UNAP & UNSA Linked</span>
        </div>
        <div class="unap-footer-actions">
          <button class="unap-footer-btn" id="btnHelp">Ayuda</button>
        </div>
      </footer>
    </div>
  `;

  document.body.appendChild(panel);
  panelOpen = true;

  initializeEvents();
  updateSavedCount();

  return panel;
}

function closePanel() {
  document.getElementById("unapRecoPanel")?.remove();
  panelOpen = false;
}

function initializeEvents() {
  const panel = document.getElementById("unapRecoPanel");
  document.getElementById("unapClose").onclick = closePanel;
  document.getElementById("unapOverlay").onclick = closePanel;

  // ESC para cerrar (no molesta nada)
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panelOpen) closePanel();
  }, { once: true });

  document.getElementById("btnSkipTutorial")?.addEventListener("click", () => {
    document.getElementById("unapWelcome").classList.add("hidden");
    welcomeShown = true;
  });

  const tabs = panel.querySelectorAll(".unap-nav-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      document.querySelectorAll(".unap-view").forEach(v => v.classList.remove("active"));
      const viewName = "view" + tab.dataset.view.charAt(0).toUpperCase() + tab.dataset.view.slice(1);
      document.getElementById(viewName)?.classList.add("active");
      if (tab.dataset.view === "topics") loadTopics();
      if (tab.dataset.view === "bibliography") loadBibliography();
    });
  });

  document.getElementById("btnAutoDetect").onclick = runAutoDetect;
  document.getElementById("btnClear").onclick = () => {
    document.getElementById("queryText").value = "";
    document.getElementById("charCount").textContent = "0 caracteres";
    document.getElementById("resultsList").innerHTML = "";
    document.getElementById("contextInfo").innerHTML = "";
    currentQueryContext = {
      mode: "manual",
      source_uuid: null,
      source_title: null,
      source_url: null,
      query_text: "",
      timestamp: null
    };
  };
  document.getElementById("btnSearch").onclick = runSearch;

  const textarea = document.getElementById("queryText");
  textarea.addEventListener("input", () => {
    document.getElementById("charCount").textContent = `${textarea.value.length} caracteres`;
  });

  document.getElementById("btnExport").onclick = exportBibliographyCSV;
  document.getElementById("btnExportBiblio").onclick = exportBibliographyCSV;
  document.getElementById("btnClearBiblio").onclick = clearBibliography;
  document.getElementById("btnStats").onclick = showStatsModal;

  document.getElementById("biblioSearch")?.addEventListener("input", loadBibliography);
  document.getElementById("topicSearch")?.addEventListener("input", loadTopics);
  document.getElementById("btnHelp").onclick = showHelp;
}

// =====================================================
// --- Lógica Principal (Auto-contexto + Search) ---
// =====================================================
async function runAutoDetect() {
  try {
    const uuid = getUUID(location.href);
    if (!uuid) throw new Error("No se encontró UUID en URL");

    const meta = await fetchMeta(uuid);

    currentQueryContext = {
      mode: "page",
      source_uuid: uuid,
      source_title: meta.title,
      source_url: location.href,
      query_text: meta.abstract,
      timestamp: new Date().toISOString()
    };

    document.getElementById("queryText").value = meta.abstract;
    document.getElementById("charCount").textContent = `${meta.abstract.length} caracteres`;
    document.getElementById("contextInfo").innerHTML = `
      <div class="unap-context-card">
        <div class="unap-context-title">Contexto Actual:</div>
        <div class="unap-context-content">
          <strong>${esc(meta.title)}</strong>
          <div class="unap-context-meta"><span>${esc(meta.author)}</span></div>
        </div>
      </div>`;

    await runSearch();
  } catch (error) {
    showNotification(`No se pudo detectar contexto: ${error.message}`, "error");
  }
}

/**
 * ✅ Compatibilidad backend "nuevo":
 * - request: enviamos campos extra sin romper el viejo
 * - response: tolera results/items, inferred_topic/topic, etc.
 */
async function runSearch() {
  const queryText = document.getElementById("queryText").value.trim();
  if (!queryText) return showNotification("Ingresa texto para buscar", "warning");

  const resultsList = document.getElementById("resultsList");
  resultsList.innerHTML = `<div class="unap-loading"><div class="unap-loading-spinner"></div><p>Analizando vectores semánticos...</p></div>`;

  try {
    const k = parseInt(document.getElementById("filterCount").value) || 10;

    // payload compatible viejo + nuevo
    const payload = {
      text: queryText,
      k,
      include_abstract: true,
      include_metadata: true,

      // 🆕 “lo nuevo” (si tu API lo soporta lo toma; si no, lo ignora)
      repo: "all",
      mode: currentQueryContext.mode || "manual",
      context: {
        source_uuid: currentQueryContext.source_uuid,
        source_url: currentQueryContext.source_url,
        source_title: currentQueryContext.source_title
      }
    };

    const data = await apiPost("/recommend", payload);

    // response compatible (nuevo/viejo)
    const inferred = data.inferred_topic || data.topic || data.inferred || null;
    if (inferred?.cluster_id != null) currentInferredTopicId = inferred.cluster_id;

    const results = data.results || data.items || data.data || [];
    currentQueryContext.query_text = queryText;

    await renderResults(results, queryText);
  } catch (error) {
    console.error("Search error:", error);
    resultsList.innerHTML = `<div class="unap-error"><h4>Error de conexión</h4><p>${esc(error.message)}</p></div>`;
  }
}

async function renderResults(results, queryText) {
  const resultsList = document.getElementById("resultsList");
  const savedItems = await getSaved();
  const savedUUIDs = new Set(savedItems.map(item => item.uuid));

  if (!results?.length) {
    resultsList.innerHTML = `<div class="unap-empty-state"><div class="unap-empty-icon">${ICONS.search}</div><h3>Sin coincidencias</h3><p>Intenta variar tu texto de búsqueda</p></div>`;
    return;
  }

  // normalizar resultados para tolerar cambios del backend
  const normalized = results.map((x) => {
    const uni = x.university || x.repo || x.source || detectUniversityFromHost(location.hostname) || "UNAP";
    return {
      uuid: x.uuid || x.id || x.item_id || "",
      title: x.title || x.dc_title || "Sin título",
      abstract_norm: x.abstract_norm || x.abstract || x.summary || "",
      label: x.label || x.topic_label || "",
      score: (typeof x.score === "number") ? x.score : (typeof x.similarity === "number" ? x.similarity : 0),
      url: x.url || x.link || x.handle_url || "",
      author: x.author || x.dc_contributor_author || "",
      date: x.date || x.date_issued || "",
      university: (typeof uni === "string" ? uni : "UNAP")
    };
  });

  const sortBy = document.getElementById("filterSort").value;
  if (sortBy === "date") normalized.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  else if (sortBy === "title") normalized.sort((a, b) => (a.title || "").localeCompare(b.title || ""));

  resultsList.innerHTML = normalized.map((item, index) => {
    const scorePercent = Math.round((item.score || 0) * 100);
    const isSaved = savedUUIDs.has(item.uuid);
    const badgeHTML = getUniBadgeHTML(item.university);

    return `
      <div class="unap-result-card ${isSaved ? 'saved' : ''}" data-uuid="${esc(item.uuid)}">
        <div class="unap-result-header">
          <div class="unap-result-rank">#${index + 1}</div>
          ${badgeHTML}
          <div class="unap-result-score">
            <div class="unap-score-bar"><div class="unap-score-fill" style="width: ${scorePercent}%"></div></div>
            <span class="unap-score-text">${scorePercent}%</span>
          </div>
          <button class="unap-save-btn ${isSaved ? 'active' : ''}">${ICONS.heart}</button>
        </div>
        <h3 class="unap-result-title">${esc(item.title)}</h3>
        ${item.label ? `<div class="unap-result-tags"><span class="unap-tag">${ICONS.magic} ${esc(item.label)}</span></div>` : ''}
        ${item.abstract_norm ? `<div class="unap-result-abstract"><p>${esc(item.abstract_norm.substring(0, 200))}...</p></div>` : ''}
        <div class="unap-result-actions">
          <button class="btn btn-sm btn-secondary unap-analyze-btn">${ICONS.compare} Analizar</button>
          ${item.url ? `<a href="${esc(item.url)}" target="_blank" class="btn btn-sm btn-primary">${ICONS.link} Ver Tesis</a>` : ''}
        </div>
        <div class="unap-analysis-panel" style="display: none;">${renderAnalysisPanel(queryText, item.abstract_norm || item.title || "")}</div>
      </div>
    `;
  }).join("");

  resultsList.querySelectorAll(".unap-result-card").forEach((card, index) => {
    const item = normalized[index];
    card.querySelector(".unap-save-btn").onclick = async () => {
      await toggleFav(item, queryText);
      await renderResults(normalized, queryText);
    };
    card.querySelector(".unap-analyze-btn").onclick = () => {
      const p = card.querySelector(".unap-analysis-panel");
      p.style.display = p.style.display === "none" ? "block" : "none";
    };
  });
}

function renderAnalysisPanel(queryText, docText) {
  const queryTokens = tokenize(queryText);
  const docTokens = tokenize(docText);
  const commonTokens = new Set(queryTokens.filter(token => docTokens.includes(token)));
  return `
    <div class="unap-analysis-container">
      <div class="unap-analysis-header"><h4>Similitud Léxica</h4><span class="unap-stat"><strong>${commonTokens.size}</strong> términos clave</span></div>
      <div class="unap-analysis-content">
        <div class="unap-analysis-column"><h5>Tu Texto</h5><div class="unap-analysis-text">${highlight(queryText, commonTokens)}</div></div>
        <div class="unap-analysis-column"><h5>Documento</h5><div class="unap-analysis-text">${highlight(docText, commonTokens)}</div></div>
      </div>
    </div>`;
}

// =====================================================
// --- Lógica Temas (compatibilidad API nueva) ---
// =====================================================
async function loadTopics() {
  const grid = document.getElementById("topicsGrid");
  if (!grid) return;
  grid.innerHTML = `<div class="unap-loading"><div class="unap-loading-spinner"></div><p>Cargando mapa de temas...</p></div>`;

  try {
    // tolerante: si tu API nueva necesita repo=all, lo toma
    let topics = await apiGet(`/topics/top?n=50&repo=all`);

    // compatibilidad: si viniera envuelto
    if (topics?.topics) topics = topics.topics;

    const term = document.getElementById("topicSearch")?.value.toLowerCase();
    if (term) topics = (topics || []).filter(t => (t.label || "").toLowerCase().includes(term));

    if (!topics?.length) {
      grid.innerHTML = `<div class="unap-empty-state"><div class="unap-empty-icon">${ICONS.magic}</div><h3>Sin datos</h3></div>`;
      return;
    }

    grid.innerHTML = topics.map(t => `
      <div class="unap-topic-card ${currentInferredTopicId === t.cluster_id ? 'highlighted' : ''}" data-cid="${t.cluster_id}">
        <div class="unap-topic-header"><h4 class="unap-topic-title">${esc(t.label)}</h4><span class="unap-topic-count">${t.size}</span></div>
        <button class="unap-topic-explore">Ver Tesis</button>
      </div>
    `).join("");

    grid.querySelectorAll(".unap-topic-card").forEach(c => {
      c.onclick = () => loadTopicDetail(c.dataset.cid, c.querySelector(".unap-topic-title").textContent);
    });
  } catch (e) {
    grid.innerHTML = `<div class="unap-error"><p>${esc(e.message)}</p></div>`;
  }
}

async function loadTopicDetail(cid, title) {
  const grid = document.getElementById("topicsGrid");
  const detail = document.getElementById("topicDetailView");
  grid.style.display = "none";
  detail.style.display = "block";
  document.getElementById("topicDetailTitle").textContent = title;

  const list = document.getElementById("topicItemsList");
  list.innerHTML = `<div class="unap-loading"><div class="unap-loading-spinner"></div><p>Obteniendo documentos...</p></div>`;

  try {
    let items = await apiGet(`/topics/${cid}?limit=20&repo=all`);
    if (items?.items) items = items.items;

    const savedItems = await getSaved();
    const savedUUIDs = new Set(savedItems.map(i => i.uuid));

    const normalized = (items || []).map(x => ({
      uuid: x.uuid || x.id || x.item_id || "",
      title: x.title || x.dc_title || "Sin título",
      url: x.url || x.link || "",
      university: x.university || x.repo || x.source || detectUniversityFromHost(location.hostname) || "UNAP",
      abstract_norm: x.abstract_norm || x.abstract || "",
      label: x.label || "",
      score: x.score || 0
    }));

    list.innerHTML = normalized.map(item => `
      <div class="unap-topic-item ${savedUUIDs.has(item.uuid) ? 'saved' : ''}">
        <div class="unap-topic-item-header">
          <div style="display:flex;align-items:center;gap:8px;">${getUniBadgeHTML(item.university)}<h4>${esc(item.title)}</h4></div>
          <button class="unap-save-btn ${savedUUIDs.has(item.uuid) ? 'active' : ''}">${ICONS.heart}</button>
        </div>
        ${item.url ? `<a href="${esc(item.url)}" target="_blank" class="btn btn-sm btn-primary">${ICONS.link} Abrir</a>` : ''}
      </div>
    `).join("");

    list.querySelectorAll(".unap-topic-item").forEach((el, idx) => {
      el.querySelector(".unap-save-btn").onclick = async () => {
        await toggleFav(normalized[idx], `Tema: ${title}`);
        loadTopicDetail(cid, title);
      };
    });
  } catch (e) {
    list.innerHTML = `<div class="unap-error"><p>${esc(e.message)}</p></div>`;
  }

  document.getElementById("btnBackTopics").onclick = () => {
    detail.style.display = "none";
    grid.style.display = "grid";
  };
}

// =====================================================
// --- Lógica Bibliografía ---
// =====================================================
async function loadBibliography() {
  const list = document.getElementById("savedItemsList");
  const empty = document.getElementById("emptyBibliography");
  const saved = await getSaved();

  if (!saved.length) { list.style.display = "none"; empty.style.display = "block"; return; }
  list.style.display = "block"; empty.style.display = "none";

  const term = document.getElementById("biblioSearch")?.value.toLowerCase();
  const filtered = term ? saved.filter(i => (i.title || "").toLowerCase().includes(term)) : saved;

  list.innerHTML = filtered.map(item => `
    <div class="unap-biblio-card" data-uuid="${esc(item.uuid)}">
      <div class="unap-biblio-header">
        <div class="unap-biblio-meta">
          ${getUniBadgeHTML(item.university)}
          <span class="unap-biblio-date">${new Date(item.savedDate).toLocaleDateString()}</span>
        </div>
        <button class="unap-biblio-delete">${ICONS.trash}</button>
      </div>
      <h4 class="unap-biblio-title">${esc(item.title)}</h4>
      <div class="unap-biblio-actions-bottom">
        ${item.url ? `<a href="${esc(item.url)}" target="_blank" class="btn btn-sm btn-primary">Ver</a>` : ''}
      </div>
    </div>
  `).join("");

  list.querySelectorAll(".unap-biblio-card").forEach(card => {
    card.querySelector(".unap-biblio-delete").onclick = () => showDeleteModal(async () => {
      await removeSavedByUUID(card.dataset.uuid);
      loadBibliography();
      updateSavedCount();
    });
  });
}

// =====================================================
// --- Exportación CSV ---
// =====================================================
async function exportBibliographyCSV() {
  try {
    const saved = await getSaved();
    if (!saved.length) return showNotification("Nada para exportar", "warning");

    const headers = ["Universidad", "Título", "Autor", "Fecha", "Score", "Tema", "Link", "Guardado el"];
    const csvRows = saved.map(i => {
      const escape = (v) => `"${String(v || "").replace(/"/g, '""')}"`;
      return [
        escape(i.university || "UNAP"),
        escape(i.title),
        escape(i.author),
        escape(i.date),
        Math.round((i.score || 0) * 100),
        escape(i.label),
        escape(i.url),
        escape(i.savedDate)
      ].join(",");
    });

    const blob = new Blob(["\uFEFF" + headers.join(",") + "\n" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `nexus-research-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification("CSV exportado exitosamente", "success");
  } catch (e) {
    showNotification("Error exportando", "error");
  }
}

async function clearBibliography() {
  const s = await getSaved();
  if (!s.length) return;
  showDeleteModal(async () => {
    await setSaved([]);
    loadBibliography();
    updateSavedCount();
  });
}

function showHelp() {
  showNotification("🔍 Usa Auto-contexto en páginas de tesis para buscar similares automáticamente.", "info");
}

// =====================================================
// --- Chrome Messages ---
// =====================================================
chrome.runtime.onMessage.addListener((m, s, r) => {
  if (m?.type === "UNAP_PING") r({ status: "ready" });

  if (m?.type === "UNAP_TOGGLE_PANEL") {
    if (panelOpen) closePanel();
    else buildPanel();
    r({ status: "toggled", panelOpen });
  }

  // ✅ actualizar API base en caliente
  if (m?.type === "NEXUS_SET_API" && typeof m?.api === "string") {
    API = m.api.replace(/\/+$/, "");
    try { chrome.storage.local.set({ nexusApiBase: API }); } catch (_) {}
    showNotification(`API actualizada: ${API}`, "success");
    r({ status: "ok", api: API });
  }
});

// Auto open (si lo usas)
if (location.search.includes("unap_auto_open")) setTimeout(() => buildPanel(), 1000);
