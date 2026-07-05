// content.js - Recomendador Semantico de Tesis v1.0.0 (Multi-Repo + API Compatibility Edition)
// Autor: Tu Experto en IA & UX

// =====================================================
// ✅ API BASE (configurable)
// =====================================================
// Cambia aquí la URL por la de tu backend local
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

// Configuración de Colores Premium y Estilos
const NEXUS_THEME = {
  primary: "#03045e",           // Premium Deep Blue
  secondary: "#0077b6",         // Premium Ocean
  accent: "#00b4d8",            // Premium Cyan
  highlight: "#90e0ef",         // Premium Sky Blue
  light: "#caf0f8",             // Premium Light Cyan
  dark: "#020338",
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
  filter: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>`,
  mendeley: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>`,
  folder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  folderPlus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>`,
  database: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  bookmark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
  percent: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`,
  university: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M3 10h18"/><path d="M5 6l7-3 7 3"/><path d="M4 10v11"/><path d="M20 10v11"/><path d="M8 14v3"/><path d="M12 14v3"/><path d="M16 14v3"/></svg>`
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
      padding: 3px 10px;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 800;
      color: #fff;
      margin-right: 8px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      line-height: 1.2;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2);
      white-space: nowrap;
      border: 1px solid rgba(255, 255, 255, 0.3);
      background: linear-gradient(135deg, var(--bg-start), var(--bg-end));
      transition: all 0.3s ease;
    }
    .nexus-uni-badge:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    }
    .nexus-badge-unap { 
      --bg-start: #0077b6;
      --bg-end: #00b4d8;
    }
    .nexus-badge-unsa { 
      --bg-start: #5D101D;
      --bg-end: #8B1A1A;
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
  }, 60000);  // ✅ Aumentado a 60 segundos
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

// ⚡ Sistema de Carpetas para Bibliografía
async function getFolders() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["nexusFolders"], (result) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else {
        const folders = Array.isArray(result.nexusFolders) ? result.nexusFolders : [
          { id: "default", name: "Sin carpeta", color: "#0077b6", createdAt: new Date().toISOString() }
        ];
        resolve(folders);
      }
    });
  });
}

async function setFolders(list) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ nexusFolders: list }, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(true);
    });
  });
}

async function createFolder(name, color) {
  const folders = await getFolders();
  const newFolder = {
    id: `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name.trim(),
    color: color || "#00b4d8",
    createdAt: new Date().toISOString()
  };
  folders.push(newFolder);
  await setFolders(folders);
  return newFolder;
}

async function deleteFolder(folderId) {
  const folders = await getFolders();
  const updated = folders.filter(f => f.id !== folderId);
  await setFolders(updated);
  
  // Mover items de esa carpeta a "default"
  const saved = await getSaved();
  const movedItems = saved.map(item => {
    if (item.folderId === folderId) {
      return { ...item, folderId: "default" };
    }
    return item;
  });
  await setSaved(movedItems);
}

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
      showNotification("❌ Elemento eliminado de bibliografía", "info");
      updateSavedCount();
      return false;
    }

    // ⚡ Mostrar modal de selección de carpeta
    const selectedFolder = await showFolderSelectionModal();
    if (!selectedFolder) return false; // Usuario canceló

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
      university: item.university,
      folderId: selectedFolder.id,
      folderName: selectedFolder.name,

      // Contexto de búsqueda
      contextTitle: context.contextTitle,
      contextText: context.contextText,
      contextUrl: context.contextUrl,

      // Proyecto original (de donde viene la búsqueda)
      originalProject: context.contextTitle || "Búsqueda manual",
      originalProjectUrl: context.contextUrl || "",
      
      // Proyecto guardado (este antecedente)
      savedProject: itemTitle,
      savedProjectUrl: item.url || "",

      queryTextFull: (context.queryTextFull || "").slice(0, 5000),
      itemTextFull: (itemAbs || itemTitle).slice(0, 5000),

      savedDate: new Date().toISOString(),
      tags: []
    });

    await setSaved(list);
    showNotification(`✅ Guardado en "${selectedFolder.name}"`, "success");
    updateSavedCount();
    return true;
  } catch (error) {
    console.error("Error en toggleFav:", error);
    showNotification("⚠️ Error al guardar elemento", "error");
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
function showNotification(message, type = "info", duration = 3000) {
  const notification = document.createElement("div");
  notification.className = `unap-notification unap-notification-${type}`;
  notification.innerHTML = `<div class="unap-notification-content"><span>${esc(message)}</span></div>`;
  document.body.appendChild(notification);

  setTimeout(() => notification.classList.add("unap-notification-show"), 10);
  setTimeout(() => {
    notification.classList.remove("unap-notification-show");
    setTimeout(() => notification.remove(), 300);
  }, duration);
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

// Modal bonito para crear carpeta nueva
function showCreateFolderModal() {
  const overlay = document.createElement("div");
  overlay.className = "unap-modal-overlay";
  
  const colors = [
    { color: '#0077b6', name: 'Azul Océano' },
    { color: '#00b4d8', name: 'Azul Cielo' },
    { color: '#10B981', name: 'Verde' },
    { color: '#F59E0B', name: 'Ámbar' },
    { color: '#EF4444', name: 'Rojo' },
    { color: '#8B5CF6', name: 'Púrpura' },
    { color: '#EC4899', name: 'Rosa' },
    { color: '#6366F1', name: 'Índigo' }
  ];
  
  overlay.innerHTML = `
    <div class="unap-modal unap-folder-modal" style="max-width:400px;">
      <div class="unap-modal-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg, #0077b6, #00b4d8);display:flex;align-items:center;justify-content:center;color:white;">
            ${ICONS.folderPlus}
          </div>
          <div>
            <h2 class="unap-modal-title" style="font-size:18px;margin:0;">Nueva Carpeta</h2>
            <p style="font-size:12px;color:#6B7280;margin:2px 0 0 0;">Organiza tu bibliografía</p>
          </div>
        </div>
      </div>
      
      <div class="unap-modal-body" style="padding:20px 0;">
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:8px;">
            📝 Nombre de la carpeta
          </label>
          <input 
            type="text" 
            id="newFolderName" 
            placeholder="Ej: Antecedentes, Marco Teórico, Tesis principales..." 
            style="width:100%;padding:12px;border:2px solid #E5E7EB;border-radius:10px;font-size:14px;transition:all 0.2s;"
            autocomplete="off"
          >
        </div>
        
        <div style="margin-bottom:20px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:10px;">
            🎨 Selecciona un color
          </label>
          <div id="colorGrid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
            ${colors.map(c => `
              <div class="color-option" data-color="${c.color}" style="display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;padding:8px;border-radius:10px;transition:all 0.2s;border:2px solid transparent;">
                <div style="width:40px;height:40px;border-radius:10px;background:${c.color};box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:all 0.2s;"></div>
                <span style="font-size:10px;color:#6B7280;text-align:center;">${c.name}</span>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div id="folderPreview" style="display:none;padding:14px;background:#F9FAFB;border:2px dashed #D1D5DB;border-radius:12px;margin-bottom:16px;">
          <div style="font-size:12px;color:#6B7280;margin-bottom:8px;">Vista previa:</div>
          <div style="display:flex;align-items:center;gap:10px;">
            <div id="previewIcon" style="width:32px;height:32px;border-radius:10px;background:#0077b6;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;">
              ${ICONS.folder}
            </div>
            <div>
              <div id="previewName" style="font-weight:700;font-size:14px;color:#03045e;">Mi Carpeta</div>
              <div style="font-size:11px;color:#6B7280;">0 referencias</div>
            </div>
          </div>
        </div>
        
        <button class="btn btn-primary" id="btnCreateFolderConfirm" disabled style="width:100%;padding:14px;font-size:14px;font-weight:600;opacity:0.5;cursor:not-allowed;">
          ${ICONS.folderPlus} Crear Carpeta
        </button>
      </div>
      
      <div class="unap-modal-actions">
        <button class="unap-modal-action-btn unap-modal-action-cancel" id="closeCreateFolder">Cancelar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  let selectedColor = '#0077b6';
  const nameInput = document.getElementById('newFolderName');
  const createBtn = document.getElementById('btnCreateFolderConfirm');
  const preview = document.getElementById('folderPreview');
  const previewIcon = document.getElementById('previewIcon');
  const previewName = document.getElementById('previewName');
  
  // Focus en input
  setTimeout(() => nameInput.focus(), 100);
  
  // Selección de color
  overlay.querySelectorAll('.color-option').forEach(option => {
    option.onclick = () => {
      overlay.querySelectorAll('.color-option').forEach(o => {
        o.style.borderColor = 'transparent';
        o.style.background = 'transparent';
        o.querySelector('div').style.transform = 'scale(1)';
      });
      option.style.borderColor = option.dataset.color;
      option.style.background = `${option.dataset.color}10`;
      option.querySelector('div').style.transform = 'scale(1.1)';
      selectedColor = option.dataset.color;
      
      // Actualizar preview
      previewIcon.style.background = selectedColor;
      updatePreview();
    };
  });
  
  // Seleccionar primer color por defecto
  overlay.querySelector('.color-option').click();
  
  // Actualizar preview mientras escribe
  nameInput.addEventListener('input', () => {
    updatePreview();
  });
  
  // Enter para crear
  nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && nameInput.value.trim()) {
      createBtn.click();
    }
  });
  
  function updatePreview() {
    const name = nameInput.value.trim();
    if (name) {
      preview.style.display = 'block';
      previewName.textContent = name;
      createBtn.disabled = false;
      createBtn.style.opacity = '1';
      createBtn.style.cursor = 'pointer';
    } else {
      preview.style.display = 'none';
      createBtn.disabled = true;
      createBtn.style.opacity = '0.5';
      createBtn.style.cursor = 'not-allowed';
    }
  }
  
  // Crear carpeta
  createBtn.onclick = async () => {
    const name = nameInput.value.trim();
    if (!name) return;
    
    try {
      createBtn.disabled = true;
      createBtn.innerHTML = `
        <div class="unap-loading-spinner" style="width:16px;height:16px;border-width:2px;"></div>
        Creando...
      `;
      
      await createFolder(name, selectedColor);
      showNotification(`✅ Carpeta "${name}" creada exitosamente`, "success");
      loadBibliography();
      overlay.remove();
    } catch (e) {
      showNotification("❌ Error al crear carpeta", "error");
      createBtn.disabled = false;
      createBtn.innerHTML = `${ICONS.folderPlus} Crear Carpeta`;
    }
  };
  
  // Cerrar
  document.getElementById('closeCreateFolder').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

// ⚡ Modal de Selección de Carpeta con opción de crear nueva
function showFolderSelectionModal() {
  return new Promise(async (resolve) => {
    const folders = await getFolders();
    const overlay = document.createElement("div");
    overlay.className = "unap-modal-overlay";
    
    const folderOptions = folders.map(f => `
      <div class="folder-option" data-id="${esc(f.id)}" style="display:flex;align-items:center;gap:10px;padding:12px;border:2px solid transparent;border-radius:12px;cursor:pointer;transition:all 0.3s ease;margin-bottom:8px;">
        <div style="width:24px;height:24px;border-radius:8px;background:${esc(f.color)};box-shadow:0 2px 8px rgba(0,0,0,0.15);"></div>
        <div style="flex:1;">
          <div style="font-weight:600;color:#03045e;font-size:13px;">${esc(f.name)}</div>
          <div style="font-size:10px;color:#6C7382;">Creada: ${new Date(f.createdAt).toLocaleDateString()}</div>
        </div>
        <div>${ICONS.link}</div>
      </div>
    `).join("");

    overlay.innerHTML = `
      <div class="unap-modal unap-folder-modal" style="max-width:360px;">
        <div class="unap-modal-header">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg, #0077b6, #00b4d8);display:flex;align-items:center;justify-content:center;color:white;">
              ${ICONS.folder}
            </div>
            <div>
              <h2 class="unap-modal-title" style="font-size:16px;margin:0;">Guardar en Carpeta</h2>
              <p style="font-size:11px;color:#6B7280;margin:2px 0 0 0;">Organiza tu bibliografía</p>
            </div>
          </div>
        </div>
        <div class="unap-modal-body" style="max-height:320px;overflow-y:auto;">
          <div id="folderList" style="display:flex;flex-direction:column;gap:8px;">${folderOptions}</div>
          
          <div style="margin-top:12px;padding-top:12px;border-top:1px solid #E5E7EB;">
            <button class="btn btn-secondary" id="btnCreateFolder" style="width:100%;font-size:13px;padding:8px;">
              ${ICONS.folderPlus} Nueva Carpeta
            </button>
          </div>

          <div id="createFolderForm" style="display:none;margin-top:12px;padding:12px;background:#F3F4F6;border-radius:10px;">
            <input type="text" id="folderNameInput" placeholder="Nombre..." style="width:100%;padding:8px;border:1px solid #D1D5DB;border-radius:8px;margin-bottom:8px;font-size:12px;">
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px;">
              ${['#0077b6', '#00b4d8', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'].map(c => 
                `<div class="color-swatch" data-color="${c}" style="width:100%;aspect-ratio:1;border-radius:8px;background:${c};cursor:pointer;border:2px solid transparent;transition:all 0.2s;"></div>`
              ).join('')}
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-secondary" id="btnCancelCreate" style="flex:1;font-size:12px;padding:6px;">Cancelar</button>
              <button class="btn btn-primary" id="btnConfirmCreate" style="flex:1;font-size:12px;padding:6px;">Crear</button>
            </div>
          </div>
        </div>
        <div class="unap-modal-actions">
          <button class="unap-modal-action-btn unap-modal-action-cancel" id="modalCancelFolder" style="font-size:12px;padding:8px;">Cancelar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    
    let selectedColor = "#00b4d8";

    // Seleccionar carpeta existente
    overlay.querySelectorAll(".folder-option").forEach(opt => {
      opt.onclick = () => {
        const folderId = opt.dataset.id;
        const folder = folders.find(f => f.id === folderId);
        overlay.remove();
        resolve(folder);
      };
      opt.onmouseenter = () => opt.style.borderColor = "#00b4d8";
      opt.onmouseleave = () => opt.style.borderColor = "transparent";
    });

    // Mostrar formulario de creación
    document.getElementById("btnCreateFolder").onclick = () => {
      document.getElementById("createFolderForm").style.display = "block";
      document.getElementById("folderNameInput").focus();
    };

    document.getElementById("btnCancelCreate").onclick = () => {
      document.getElementById("createFolderForm").style.display = "none";
      document.getElementById("folderNameInput").value = "";
    };

    // Selección de color
    overlay.querySelectorAll(".color-swatch").forEach(swatch => {
      swatch.onclick = () => {
        overlay.querySelectorAll(".color-swatch").forEach(s => s.style.borderColor = "transparent");
        swatch.style.borderColor = "#fff";
        swatch.style.boxShadow = "0 0 0 2px #03045e";
        selectedColor = swatch.dataset.color;
      };
    });

    // Confirmar creación
    document.getElementById("btnConfirmCreate").onclick = async () => {
      const name = document.getElementById("folderNameInput").value.trim();
      if (!name) {
        showNotification("Ingresa un nombre para la carpeta", "warning");
        return;
      }
      const newFolder = await createFolder(name, selectedColor);
      overlay.remove();
      resolve(newFolder);
    };

    document.getElementById("modalCancelFolder").onclick = () => {
      overlay.remove();
      resolve(null);
    };

    overlay.onclick = (e) => { 
      if (e.target === overlay) {
        overlay.remove();
        resolve(null);
      }
    };
  });
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
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg, #0077b6, #00b4d8);display:flex;align-items:center;justify-content:center;color:white;">
              ${ICONS.stats}
            </div>
            <div>
              <h2 class="unap-stats-title">Estadísticas del Sistema</h2>
              <p style="font-size:12px;color:#6B7280;margin:2px 0 0 0;">Análisis completo de tu investigación</p>
            </div>
          </div>
        </div>

        <div class="stats-section">
          <div class="stats-section-header">
            <div class="stats-section-icon">${ICONS.database}</div>
            <h4 class="stats-section-title">Base de Conocimiento</h4>
          </div>
          <div class="nexus-stats-grid">
            <div class="nexus-stat-box">
              <div class="nexus-stat-icon" style="color:#0077b6;">${ICONS.university}</div>
              <span class="nexus-stat-number">16,761</span>
              <span class="nexus-stat-label">UNAP (Puno)</span>
            </div>
            <div class="nexus-stat-box">
              <div class="nexus-stat-icon" style="color:#00b4d8;">${ICONS.university}</div>
              <span class="nexus-stat-number">19,856</span>
              <span class="nexus-stat-label">UNSA (Arequipa)</span>
            </div>
          </div>
          <div class="stats-total">
            Total: <strong>36,617</strong> Tesis Disponibles
          </div>
        </div>

        <div class="stats-section">
          <div class="stats-section-header">
            <div class="stats-section-icon">${ICONS.bookmark}</div>
            <h4 class="stats-section-title">Tu Bibliografía</h4>
          </div>
          <div class="unap-stats-grid">
            <div class="unap-stat-item">
              <div class="stat-icon-wrapper" style="background:rgba(0, 119, 182, 0.1);color:#0077b6;">${ICONS.heart}</div>
              <div class="unap-stat-value">${saved.length}</div>
              <div class="unap-stat-label">Guardados</div>
            </div>
            <div class="unap-stat-item">
              <div class="stat-icon-wrapper" style="background:rgba(16, 185, 129, 0.1);color:#10B981;">${ICONS.percent}</div>
              <div class="unap-stat-value">${avgScore}%</div>
              <div class="unap-stat-label">Relevancia</div>
            </div>
            <div class="unap-stat-item">
              <div class="stat-icon-wrapper" style="background:rgba(0, 119, 182, 0.1);color:#0077b6;">${ICONS.university}</div>
              <div class="unap-stat-value">${countUnap}</div>
              <div class="unap-stat-label">UNAP</div>
            </div>
            <div class="unap-stat-item">
              <div class="stat-icon-wrapper" style="background:rgba(0, 180, 216, 0.1);color:#00b4d8;">${ICONS.university}</div>
              <div class="unap-stat-value">${countUnsa}</div>
              <div class="unap-stat-label">UNSA</div>
            </div>
          </div>
        </div>

        <div style="margin-top: 20px;">
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
      <h2 class="unap-welcome-title">Recomendador Semantico de Tesis</h2>
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
            <h1 class="unap-title">Recomendador Semantico de Tesis</h1>
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
                <button class="btn btn-primary" id="btnCreateNewFolder" title="Crear nueva carpeta">${ICONS.folderPlus} Nueva Carpeta</button>
                <button class="btn btn-secondary" id="btnExportMendeley" title="Exportar todo a Mendeley">${ICONS.mendeley} Mendeley</button>
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
          <span class="unap-footer-text">Recomendador Semantico v1.0.0</span>
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
  document.getElementById("btnExportMendeley").onclick = exportToMendeley;
  document.getElementById("btnClearBiblio").onclick = clearBibliography;
  document.getElementById("btnStats").onclick = showStatsModal;
  
  // Botón crear carpeta en bibliografía
  document.getElementById("btnCreateNewFolder")?.addEventListener("click", () => {
    showCreateFolderModal();
  });

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

  // Organizar por carpetas
  const folders = await getFolders();
  const itemsByFolder = {};
  
  folders.forEach(folder => {
    itemsByFolder[folder.id] = { folder, items: [] };
  });

  filtered.forEach(item => {
    const folderId = item.folderId || "default";
    if (itemsByFolder[folderId]) {
      itemsByFolder[folderId].items.push(item);
    } else {
      // Si la carpeta ya no existe, mover a default
      itemsByFolder["default"].items.push(item);
    }
  });

  // Renderizar por carpetas colapsables
  const html = Object.values(itemsByFolder)
    .filter(group => group.items.length > 0)
    .map(({ folder, items }) => `
      <div class="folder-group" style="margin-bottom:20px;" data-folder-id="${folder.id}">
        <div class="folder-header" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:linear-gradient(135deg, rgba(${hexToRgb(folder.color)}, 0.12), rgba(${hexToRgb(folder.color)}, 0.06));border-radius:12px;border-left:4px solid ${folder.color};cursor:pointer;transition:all 0.2s;">
          <button class="folder-toggle" style="background:none;border:none;color:${folder.color};cursor:pointer;padding:4px;display:flex;align-items:center;">
            <svg class="folder-toggle-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform 0.2s;">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          <div style="width:28px;height:28px;border-radius:8px;background:${folder.color};display:flex;align-items:center;justify-content:center;color:white;font-size:14px;">
            ${ICONS.folder}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:14px;color:#03045e;">${esc(folder.name)}</div>
            <div style="font-size:10px;color:#6B7280;">${items.length} referencia${items.length !== 1 ? 's' : ''}</div>
          </div>
          <button class="btn btn-sm btn-secondary export-folder-mendeley" data-folder-id="${folder.id}" title="Exportar carpeta" style="padding:4px 8px;" onclick="event.stopPropagation();">
            ${ICONS.mendeley}
          </button>
          ${folder.id !== "default" ? `
            <button class="btn btn-sm btn-danger delete-folder-btn" data-folder-id="${folder.id}" title="Eliminar carpeta" style="padding:4px 8px;" onclick="event.stopPropagation();">
              ${ICONS.trash}
            </button>
          ` : ''}
        </div>
        <div class="folder-items" style="padding-left:8px;margin-top:8px;">
          ${items.map(item => `
            <div class="unap-biblio-card" data-uuid="${esc(item.uuid)}" style="margin-bottom:10px;padding:12px;">
              <div class="unap-biblio-header">
                <div class="unap-biblio-meta">
                  ${getUniBadgeHTML(item.university)}
                  <span class="unap-biblio-date">${new Date(item.savedDate).toLocaleDateString()}</span>
                </div>
                <button class="unap-biblio-delete">${ICONS.trash}</button>
              </div>
              <h4 class="unap-biblio-title">${esc(item.title)}</h4>
              ${item.originalProject ? `
                <div style="margin-top:8px;padding:8px;background:#F3F4F6;border-radius:8px;font-size:11px;">
                  <div style="color:#6B7280;margin-bottom:4px;font-weight:600;">📌 Referencia para:</div>
                  <div style="color:#374151;font-weight:500;">${esc(item.originalProject)}</div>
                </div>
              ` : ''}
              <div class="unap-biblio-actions-bottom" style="margin-top:10px;">
                ${item.url ? `<a href="${esc(item.url)}" target="_blank" class="btn btn-sm btn-primary">Ver</a>` : ''}
                <button class="btn btn-sm btn-secondary export-item-mendeley" data-uuid="${esc(item.uuid)}" title="Exportar">
                  ${ICONS.mendeley}
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

  list.innerHTML = html;

  // Event listeners para colapsar/expandir carpetas
  list.querySelectorAll(".folder-header").forEach(header => {
    header.onclick = (e) => {
      if (e.target.closest('.btn')) return; // No colapsar si se clickea un botón
      const folderGroup = header.closest('.folder-group');
      const folderItems = folderGroup.querySelector('.folder-items');
      const toggleIcon = header.querySelector('.folder-toggle-icon');
      
      if (folderItems.style.display === 'none') {
        folderItems.style.display = 'block';
        toggleIcon.style.transform = 'rotate(0deg)';
      } else {
        folderItems.style.display = 'none';
        toggleIcon.style.transform = 'rotate(-90deg)';
      }
    };
  });

  // Event listeners para eliminar items
  list.querySelectorAll(".unap-biblio-card").forEach(card => {
    card.querySelector(".unap-biblio-delete").onclick = () => showDeleteModal(async () => {
      await removeSavedByUUID(card.dataset.uuid);
      loadBibliography();
      updateSavedCount();
    });
  });

  // Event listeners para eliminar carpetas
  list.querySelectorAll(".delete-folder-btn").forEach(btn => {
    btn.onclick = () => {
      const folderId = btn.dataset.folderId;
      const folder = folders.find(f => f.id === folderId);
      if (!folder) return;
      
      showDeleteModal(async () => {
        await deleteFolder(folderId);
        showNotification(`Carpeta "${folder.name}" eliminada`, "info");
        loadBibliography();
      });
    };
  });

  // Event listeners para exportar carpeta a Mendeley
  list.querySelectorAll(".export-folder-mendeley").forEach(btn => {
    btn.onclick = async () => {
      const folderId = btn.dataset.folderId;
      const folder = folders.find(f => f.id === folderId);
      await exportFolderToMendeley(folderId, folder?.name);
    };
  });

  // Event listeners para exportar item individual a Mendeley
  list.querySelectorAll(".export-item-mendeley").forEach(btn => {
    btn.onclick = async () => {
      const uuid = btn.dataset.uuid;
      await exportItemToMendeley(uuid);
    };
  });
}

// Helper para convertir hex a rgb
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 119, 182';
}

// =====================================================
// --- Exportación CSV + Mendeley (RIS) ---
// =====================================================
async function exportBibliographyCSV() {
  try {
    const saved = await getSaved();
    if (!saved.length) return showNotification("Nada para exportar", "warning");

    const headers = ["Universidad", "Título", "Autor", "Fecha", "Score", "Tema", "Link", "Carpeta", "Proyecto Original", "Guardado el"];
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
        escape(i.folderName || "Sin carpeta"),
        escape(i.originalProject || "Búsqueda manual"),
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

    showNotification("✅ CSV exportado exitosamente", "success");
  } catch (e) {
    showNotification("❌ Error exportando", "error");
  }
}

async function exportToMendeley() {
  try {
    const saved = await getSaved();
    if (!saved.length) return showNotification("Nada para exportar", "warning");

    await addToMendeleyDirect(saved, `${saved.length} referencias`);
  } catch (e) {
    console.error("Error exportando RIS:", e);
    showNotification("❌ Error exportando para Mendeley", "error");
  }
}

async function exportFolderToMendeley(folderId, folderName) {
  try {
    const saved = await getSaved();
    const items = saved.filter(item => (item.folderId || "default") === folderId);
    
    if (!items.length) return showNotification("Carpeta vacía", "warning");

    await addToMendeleyDirect(items, `${items.length} referencias de "${folderName}"`);
  } catch (e) {
    console.error("Error exportando carpeta:", e);
    showNotification("❌ Error exportando carpeta", "error");
  }
}

async function exportItemToMendeley(uuid) {
  try {
    const saved = await getSaved();
    const item = saved.find(i => i.uuid === uuid);
    
    if (!item) return showNotification("Tesis no encontrada", "warning");

    await addToMendeleyDirect([item], `"${item.title.slice(0, 40)}..."`);
  } catch (e) {
    console.error("Error exportando item:", e);
    showNotification("❌ Error exportando", "error");
  }
}

function generateRISContent(items) {
  return items.map(item => {
    return `TY  - THES
TI  - ${item.title || "Sin título"}
AU  - ${item.author || "Autor desconocido"}
PY  - ${item.date ? new Date(item.date).getFullYear() : ""}
AB  - ${item.itemTextFull || ""}
UR  - ${item.url || ""}
KW  - ${item.label || ""}
N1  - Universidad: ${item.university || "UNAP"}
N1  - Carpeta: ${item.folderName || "Sin carpeta"}
N1  - Proyecto Original: ${item.originalProject || "N/A"}
N1  - Referencia para: ${item.originalProject || "Búsqueda manual"}
N1  - Score: ${Math.round((item.score || 0) * 100)}%
ER  - 

`;
  }).join("");
}

// Función para agregar referencias directamente a Mendeley
async function addToMendeleyDirect(items, description) {
  // Mostrar modal con opciones simples y efectivas
  showMendeleyImportModal(items, description);
}

// Modal de opciones para importar a Mendeley
function showMendeleyImportModal(items, description) {
  const risContent = generateRISContent(items);
  const overlay = document.createElement('div');
  overlay.className = 'unap-modal-overlay';
  
  overlay.innerHTML = `
    <div class="unap-modal" style="max-width:480px;">
      <div class="unap-modal-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:40px;height:40px;border-radius:12px;background:#dc2626;display:flex;align-items:center;justify-content:center;color:white;">
            ${ICONS.mendeley}
          </div>
          <div>
            <h2 class="unap-modal-title" style="font-size:18px;margin:0;">Importar a Mendeley</h2>
            <p style="font-size:12px;color:#6B7280;margin:2px 0 0 0;">${description}</p>
          </div>
        </div>
      </div>
      <div class="unap-modal-body" style="padding:20px 0;">
        <div style="background:#FEF3C7;border:2px solid #FCD34D;border-radius:12px;padding:16px;margin-bottom:16px;">
          <div style="font-size:14px;color:#92400E;font-weight:700;margin-bottom:10px;">📋 Pasos para importar:</div>
          <ol style="font-size:13px;color:#78350F;margin:0;padding-left:20px;line-height:1.8;">
            <li>Haz clic en <strong>"Descargar Referencias"</strong> abajo</li>
            <li>Ve a <strong>Mendeley Web</strong> o <strong>Desktop</strong></li>
            <li>En Mendeley Web: <strong>File → Import → Choose File</strong></li>
            <li>Selecciona el archivo <code style="background:#FDE68A;padding:2px 6px;border-radius:4px;">nexus-mendeley.ris</code></li>
            <li>¡Listo! Tus referencias aparecerán en tu biblioteca</li>
          </ol>
        </div>
        
        <button class="btn btn-primary" id="downloadMendeley" style="width:100%;justify-content:center;padding:16px;font-size:15px;font-weight:700;">
          ${ICONS.download} Descargar Referencias (.ris)
        </button>
        
        <div style="margin-top:12px;display:flex;gap:8px;">
          <a href="https://www.mendeley.com/reference-manager/library/all-references" target="_blank" class="btn btn-secondary" style="flex:1;text-align:center;text-decoration:none;padding:10px;font-size:13px;">
            Abrir Mendeley Web
          </a>
          <button class="btn btn-secondary" id="copyInstructions" style="flex:1;font-size:13px;padding:10px;">
            Copiar Instrucciones
          </button>
        </div>
        
        <div style="margin-top:16px;padding:12px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;">
          <div style="font-size:12px;color:#1E40AF;">
            <strong>💡 Tip:</strong> En Mendeley Desktop puedes hacer doble clic en el archivo .ris descargado para importarlo automáticamente.
          </div>
        </div>
      </div>
      <div class="unap-modal-actions">
        <button class="unap-modal-action-btn unap-modal-action-cancel" id="closeModal">Cerrar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Descargar archivo RIS
  document.getElementById('downloadMendeley').onclick = () => {
    downloadRISFile(risContent, 'nexus-mendeley.ris');
    showNotification('✓ Archivo descargado. Sigue los pasos para importarlo en Mendeley', 'success', 5000);
    
    // Cambiar el botón a "Descargado ✓"
    const btn = document.getElementById('downloadMendeley');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" style="margin-right:8px;">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Descargado ✓ (Click para descargar de nuevo)
    `;
    btn.style.background = '#10B981';
  };
  
  // Copiar instrucciones
  document.getElementById('copyInstructions').onclick = () => {
    const instructions = `Pasos para importar referencias a Mendeley:

1. Abre Mendeley Web (https://www.mendeley.com/reference-manager/) o Mendeley Desktop
2. Ve a File → Import (o haz clic en el botón "Import")
3. Selecciona el archivo: nexus-mendeley.ris
4. ¡Listo! Tus ${items.length} referencias aparecerán en tu biblioteca

Alternativa en Desktop: Haz doble clic en el archivo .ris descargado.`;
    
    navigator.clipboard.writeText(instructions).then(() => {
      showNotification('✓ Instrucciones copiadas al portapapeles', 'success');
    }).catch(() => {
      showNotification('❌ No se pudo copiar. Usa Ctrl+C manualmente', 'error');
    });
  };
  
  // Cerrar modal
  document.getElementById('closeModal').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

function downloadRISFile(content, filename) {
  const blob = new Blob([content], { type: "application/x-research-info-systems;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
