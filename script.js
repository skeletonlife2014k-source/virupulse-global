/**
 * ViroWatch Atlas — Main Application Script
 * ============================================================
 * Handles: map rendering, sidebar, virus selection, chart,
 * filters, search, dark/light mode, animations.
 *
 * API INTEGRATION POINTS are marked with: // [API] ...
 */

/* ─────────────────────────────────────────────
   STATE
───────────────────────────────────────────── */
const state = {
  selectedVirus: null,
  isDark: true,
  filter: {
    category: "ALL",
    risk: "ALL",
    continent: "ALL",
    transmission: "ALL",
  },
  alertMode: false,
  map: null,
  markersLayer: null,
  heatLayer: null,
  chart: null,
  sidebarOpen: true,
};

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  renderSidebar();
  bindEvents();
  selectVirus(VIRUSES[4]); // default: SARS-CoV-2
  checkMobile();

  // Animate alerts badge
  animateAlertBadge();
});

window.addEventListener("resize", checkMobile);

/* ─────────────────────────────────────────────
   MAP SETUP
───────────────────────────────────────────── */
function initMap() {
  state.map = L.map("map", {
    center: [20, 0],
    zoom: 2,
    minZoom: 1.5,
    maxZoom: 10,
    zoomControl: false,
    attributionControl: false,
  });

  // Dark tile layer (CartoDB Dark Matter)
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }
  ).addTo(state.map);

  // Light tile layer (added/removed on theme toggle)
  state.lightTile = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }
  );

  state.darkTile = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }
  );

  // Custom zoom control
  L.control.zoom({ position: "bottomright" }).addTo(state.map);

  // Attribution
  L.control.attribution({ position: "bottomleft", prefix: false })
    .addAttribution('© <a href="https://carto.com/">CARTO</a> | ViroWatch Atlas — Demo Data Only')
    .addTo(state.map);

  state.markersLayer = L.layerGroup().addTo(state.map);
}

/* ─────────────────────────────────────────────
   SIDEBAR RENDER
───────────────────────────────────────────── */
function renderSidebar(filterText = "") {
  const container = document.getElementById("virus-list");
  if (!container) return;

  container.innerHTML = "";

  const grouped = {};
  const cats = Object.keys(VIRUS_CATEGORIES);
  cats.forEach((c) => (grouped[c] = []));

  const query = filterText.toLowerCase().trim();

  let filtered = VIRUSES;

  // Apply search
  if (query) {
    filtered = VIRUSES.filter(
      (v) =>
        v.name.toLowerCase().includes(query) ||
        v.category.toLowerCase().includes(query) ||
        v.transmission.some((t) => t.toLowerCase().includes(query))
    );
  }

  // Apply category filter
  if (state.filter.category !== "ALL") {
    filtered = filtered.filter((v) => v.category === state.filter.category);
  }

  // Apply risk filter
  if (state.filter.risk !== "ALL") {
    filtered = filtered.filter((v) =>
      v.whoRisk.toLowerCase().includes(state.filter.risk.toLowerCase())
    );
  }

  // Group into categories
  filtered.forEach((v) => {
    if (grouped[v.category]) grouped[v.category].push(v);
  });

  const catOrder = ["HEMORRHAGIC", "RESPIRATORY", "VECTOR", "GASTRO", "NEUROLOGICAL", "SYSTEMIC"];

  catOrder.forEach((cat) => {
    const viruses = grouped[cat];
    if (!viruses || viruses.length === 0) return;

    const catInfo = VIRUS_CATEGORIES[cat];

    // Category header
    const header = document.createElement("div");
    header.className = "category-header";
    header.innerHTML = `<span class="cat-icon">${catInfo.emoji}</span> ${catInfo.label}`;
    header.style.color = catInfo.color;
    container.appendChild(header);

    viruses.forEach((virus) => {
      const item = document.createElement("div");
      item.className = "virus-item";
      item.dataset.id = virus.id;

      if (state.selectedVirus && state.selectedVirus.id === virus.id) {
        item.classList.add("active");
      }

      const riskClass = getRiskClass(virus.whoRisk);
      const trendIcon = virus.trend7d > 0 ? "▲" : virus.trend7d < 0 ? "▼" : "–";
      const trendColor = virus.trend7d > 10 ? "#ef4444" : virus.trend7d > 0 ? "#f59e0b" : "#10b981";

      item.innerHTML = `
        <span class="virus-dot" style="background:${catInfo.color}"></span>
        <div class="virus-item-info">
          <span class="virus-item-name">${virus.name}</span>
          <span class="virus-item-meta">
            <span class="risk-badge ${riskClass}">${virus.whoRisk}</span>
          </span>
        </div>
        <span class="virus-trend" style="color:${trendColor}">${trendIcon} ${Math.abs(virus.trend7d)}%</span>
      `;

      item.addEventListener("click", () => selectVirus(virus));
      container.appendChild(item);
    });
  });

  if (container.children.length === 0) {
    container.innerHTML = `<div class="no-results">No viruses match your search.</div>`;
  }
}

/* ─────────────────────────────────────────────
   VIRUS SELECTION
───────────────────────────────────────────── */
function selectVirus(virus) {
  state.selectedVirus = virus;

  // Animate out
  const panel = document.getElementById("detail-panel");
  panel.classList.add("panel-fade-out");

  setTimeout(() => {
    updateDetailPanel(virus);
    updateMap(virus);
    highlightSidebarItem(virus.id);
    panel.classList.remove("panel-fade-out");
    panel.classList.add("panel-fade-in");
    setTimeout(() => panel.classList.remove("panel-fade-in"), 400);
  }, 200);
}

function highlightSidebarItem(id) {
  document.querySelectorAll(".virus-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.id === id);
  });
}

/* ─────────────────────────────────────────────
   MAP UPDATE
───────────────────────────────────────────── */
function updateMap(virus) {
  // Clear previous layers
  state.markersLayer.clearLayers();
  if (state.heatLayer) {
    state.map.removeLayer(state.heatLayer);
    state.heatLayer = null;
  }

  if (!virus.outbreaks || virus.outbreaks.length === 0) return;

  const catColor = VIRUS_CATEGORIES[virus.category]?.color || "#ef4444";

  // Build heatmap points: [lat, lng, intensity]
  const heatPoints = virus.outbreaks.map((o) => [o.lat, o.lng, o.risk || 0.5]);

  // Leaflet.heat plugin (loaded via CDN if available), fallback to circle markers
  if (typeof L.heatLayer !== "undefined") {
    state.heatLayer = L.heatLayer(heatPoints, {
      radius: 45,
      blur: 35,
      maxZoom: 6,
      gradient: { 0.2: "#3b82f6", 0.5: "#f59e0b", 0.8: "#ef4444", 1.0: "#ff0000" },
    }).addTo(state.map);
  }

  // Add circle markers for each outbreak
  virus.outbreaks.forEach((outbreak) => {
    const radius = Math.max(6, Math.min(28, Math.log10(outbreak.cases + 1) * 5));

    const circle = L.circleMarker([outbreak.lat, outbreak.lng], {
      radius: radius,
      fillColor: catColor,
      color: "#fff",
      weight: 1.5,
      opacity: 0.9,
      fillOpacity: 0.75,
    });

    // Popup content
    const fatalRate = outbreak.cases > 0
      ? ((outbreak.deaths / outbreak.cases) * 100).toFixed(1)
      : "—";

    const popupHtml = `
      <div class="map-popup">
        <div class="popup-country">${outbreak.country}</div>
        <div class="popup-virus">${virus.name}</div>
        <div class="popup-stats">
          <div class="popup-stat">
            <span class="popup-label">Confirmed</span>
            <span class="popup-value">${formatNum(outbreak.cases)}</span>
          </div>
          <div class="popup-stat">
            <span class="popup-label">Deaths</span>
            <span class="popup-value deaths-val">${formatNum(outbreak.deaths)}</span>
          </div>
          <div class="popup-stat">
            <span class="popup-label">Fatality</span>
            <span class="popup-value">${fatalRate}%</span>
          </div>
        </div>
        <div class="popup-risk">WHO Risk: <strong>${virus.whoRisk}</strong></div>
      </div>
    `;

    circle.bindPopup(popupHtml, {
      className: "custom-popup",
      maxWidth: 240,
    });

    circle.on("mouseover", function () { this.openPopup(); });
    circle.addTo(state.markersLayer);
  });

  // Fly to the region with most outbreaks
  const mainOutbreak = [...virus.outbreaks].sort((a, b) => b.cases - a.cases)[0];
  state.map.flyTo([mainOutbreak.lat, mainOutbreak.lng], 3, {
    animate: true,
    duration: 1.2,
  });
}

/* ─────────────────────────────────────────────
   DETAIL PANEL UPDATE
───────────────────────────────────────────── */
function updateDetailPanel(virus) {
  const catInfo = VIRUS_CATEGORIES[virus.category];

  // Header
  document.getElementById("detail-virus-name").textContent = virus.name;
  document.getElementById("detail-category").textContent = catInfo.label;
  document.getElementById("detail-category").style.color = catInfo.color;
  document.getElementById("detail-description").textContent = virus.description;
  document.getElementById("detail-icon").textContent = catInfo.emoji;

  // Stats
  document.getElementById("stat-cases").textContent = formatNum(virus.cases);
  document.getElementById("stat-deaths").textContent = formatNum(virus.deaths);
  document.getElementById("stat-fatality").textContent = virus.fatalityRate.toFixed(1) + "%";

  // 7-day trend
  const trendEl = document.getElementById("stat-trend");
  const arrow = virus.trend7d > 0 ? "▲" : virus.trend7d < 0 ? "▼" : "—";
  const trendColor = virus.trend7d > 10 ? "#ef4444" : virus.trend7d > 0 ? "#f59e0b" : virus.trend7d < 0 ? "#10b981" : "#94a3b8";
  trendEl.innerHTML = `<span style="color:${trendColor}">${arrow} ${Math.abs(virus.trend7d)}%</span>`;

  // Transmission tags
  const transContainer = document.getElementById("detail-transmission");
  transContainer.innerHTML = virus.transmission
    .map((t) => `<span class="trans-tag">${t}</span>`)
    .join("");

  // WHO Risk
  const riskEl = document.getElementById("detail-who-risk");
  const riskClass = getRiskClass(virus.whoRisk);
  riskEl.innerHTML = `<span class="risk-badge large ${riskClass}">${virus.whoRisk}</span>`;

  // Active countries
  const countriesEl = document.getElementById("detail-countries");
  countriesEl.innerHTML = virus.outbreaks
    .sort((a, b) => b.cases - a.cases)
    .slice(0, 5)
    .map(
      (o) => `
      <div class="country-row">
        <span class="country-name">${o.country}</span>
        <span class="country-cases">${formatNum(o.cases)} cases</span>
        <div class="country-bar-wrap">
          <div class="country-bar" style="width:${Math.min(100, (o.risk || 0.5) * 100)}%; background:${catInfo.color}"></div>
        </div>
      </div>`
    )
    .join("");

  // Render trend chart
  renderChart(virus);
}

/* ─────────────────────────────────────────────
   CHART (Chart.js)
───────────────────────────────────────────── */
function renderChart(virus) {
  const ctx = document.getElementById("trend-chart");
  if (!ctx) return;

  if (state.chart) {
    state.chart.destroy();
    state.chart = null;
  }

  const catColor = VIRUS_CATEGORIES[virus.category]?.color || "#ef4444";

  const gradient = ctx.getContext("2d").createLinearGradient(0, 0, 0, 130);
  gradient.addColorStop(0, catColor + "88");
  gradient.addColorStop(1, catColor + "00");

  // [API] Replace virus.trendData with live fetch data here
  state.chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: MONTH_LABELS,
      datasets: [
        {
          label: "Monthly Cases",
          data: virus.trendData,
          borderColor: catColor,
          borderWidth: 2,
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: catColor,
          pointBorderColor: "#0f172a",
          pointBorderWidth: 1.5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: "easeInOutQuart" },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e293b",
          titleColor: "#e2e8f0",
          bodyColor: "#94a3b8",
          borderColor: "#334155",
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => ` ${formatNum(ctx.raw)} cases`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: "#1e293b" },
          ticks: { color: "#64748b", font: { size: 10 } },
        },
        y: {
          grid: { color: "#1e293b" },
          ticks: {
            color: "#64748b",
            font: { size: 10 },
            callback: (v) => formatShort(v),
          },
        },
      },
    },
  });
}

/* ─────────────────────────────────────────────
   EVENTS & FILTERS
───────────────────────────────────────────── */
function bindEvents() {
  // Search
  const searchInput = document.getElementById("virus-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => renderSidebar(e.target.value));
  }

  // Sidebar toggle (mobile)
  const sidebarToggle = document.getElementById("sidebar-toggle");
  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", toggleSidebar);
  }

  // Dark/light toggle
  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
  }

  // Alert mode
  const alertBtn = document.getElementById("alert-mode-btn");
  if (alertBtn) {
    alertBtn.addEventListener("click", toggleAlertMode);
  }

  // Global overview
  const overviewBtn = document.getElementById("overview-btn");
  if (overviewBtn) {
    overviewBtn.addEventListener("click", showGlobalOverview);
  }

  // Filter controls
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.filterType;
      const value = btn.dataset.filterValue;
      state.filter[type] = value;

      // Update active state in filter group
      document.querySelectorAll(`.filter-btn[data-filter-type="${type}"]`).forEach((b) => {
        b.classList.toggle("active", b.dataset.filterValue === value);
      });

      renderSidebar(document.getElementById("virus-search")?.value || "");
    });
  });

  // Map click outside markers (to deselect popup)
  if (state.map) {
    state.map.on("click", () => {
      state.map.closePopup();
    });
  }
}

function toggleSidebar() {
  state.sidebarOpen = !state.sidebarOpen;
  const sidebar = document.getElementById("sidebar");
  const toggle = document.getElementById("sidebar-toggle");
  sidebar.classList.toggle("collapsed", !state.sidebarOpen);
  toggle.textContent = state.sidebarOpen ? "◀" : "▶";
}

function toggleTheme() {
  state.isDark = !state.isDark;
  document.documentElement.classList.toggle("light-mode", !state.isDark);
  const btn = document.getElementById("theme-toggle");
  btn.textContent = state.isDark ? "☀️" : "🌙";

  // Swap map tiles
  if (state.isDark) {
    if (state.map.hasLayer(state.lightTile)) state.map.removeLayer(state.lightTile);
    state.darkTile.addTo(state.map);
  } else {
    if (state.map.hasLayer(state.darkTile)) state.map.removeLayer(state.darkTile);
    state.lightTile.addTo(state.map);
  }
}

function toggleAlertMode() {
  state.alertMode = !state.alertMode;
  const btn = document.getElementById("alert-mode-btn");
  btn.classList.toggle("alert-active", state.alertMode);

  if (state.alertMode) {
    // Filter to rapidly rising viruses
    const rapidRise = VIRUSES.filter((v) => v.trend7d > 20)
      .sort((a, b) => b.trend7d - a.trend7d);
    showToast(`⚠️ Alert Mode: ${rapidRise.length} outbreaks with rapid spread detected`);
    highlightAlertViruses(rapidRise.map((v) => v.id));
  } else {
    clearAlertHighlights();
    showToast("Alert mode deactivated");
  }
}

function highlightAlertViruses(ids) {
  document.querySelectorAll(".virus-item").forEach((el) => {
    el.classList.toggle("alert-highlight", ids.includes(el.dataset.id));
  });
}

function clearAlertHighlights() {
  document.querySelectorAll(".virus-item").forEach((el) => {
    el.classList.remove("alert-highlight");
  });
}

function showGlobalOverview() {
  // [API] In a real app, fetch global stats here
  state.map.flyTo([20, 0], 2, { animate: true, duration: 1.5 });

  state.markersLayer.clearLayers();
  if (state.heatLayer) { state.map.removeLayer(state.heatLayer); state.heatLayer = null; }

  // Show all outbreak locations as tiny dots
  VIRUSES.forEach((virus) => {
    const catColor = VIRUS_CATEGORIES[virus.category]?.color || "#ef4444";
    (virus.outbreaks || []).forEach((o) => {
      L.circleMarker([o.lat, o.lng], {
        radius: 4,
        fillColor: catColor,
        color: "transparent",
        fillOpacity: 0.6,
      })
        .bindPopup(`<b>${virus.name}</b><br>${o.country}: ${formatNum(o.cases)} cases`)
        .addTo(state.markersLayer);
    });
  });

  showToast("🌍 Global Overview — All tracked pathogens");
}

/* ─────────────────────────────────────────────
   TOAST NOTIFICATIONS
───────────────────────────────────────────── */
function showToast(message, duration = 3500) {
  const existing = document.getElementById("toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "toast";
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("toast-visible");
    setTimeout(() => {
      toast.classList.remove("toast-visible");
      setTimeout(() => toast.remove(), 400);
    }, duration);
  });
}

/* ─────────────────────────────────────────────
   ALERT BADGE ANIMATION
───────────────────────────────────────────── */
function animateAlertBadge() {
  const count = VIRUSES.filter((v) => v.trend7d > 20).length;
  const badge = document.getElementById("alert-badge");
  if (badge) badge.textContent = count;
}

/* ─────────────────────────────────────────────
   MOBILE CHECK
───────────────────────────────────────────── */
function checkMobile() {
  const isMobile = window.innerWidth < 768;
  const sidebar = document.getElementById("sidebar");

  if (isMobile && state.sidebarOpen) {
    sidebar.classList.add("collapsed");
    state.sidebarOpen = false;
    document.getElementById("sidebar-toggle").textContent = "▶";
  } else if (!isMobile && !state.sidebarOpen) {
    sidebar.classList.remove("collapsed");
    state.sidebarOpen = true;
    document.getElementById("sidebar-toggle").textContent = "◀";
  }
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function formatNum(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toLocaleString();
}

function formatShort(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return n;
}

function getRiskClass(risk) {
  const r = risk.toLowerCase();
  if (r.includes("very high")) return "risk-very-high";
  if (r.includes("high")) return "risk-high";
  if (r.includes("medium")) return "risk-medium";
  if (r.includes("low")) return "risk-low";
  return "risk-unknown";
}
