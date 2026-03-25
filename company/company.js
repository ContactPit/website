import "@phosphor-icons/web/fill";

const EMAIL_ICON_URL = new URL("../assets/ios/email.svg", import.meta.url).href;
const PHONE_ICON_URL = new URL("../assets/ios/phone.svg", import.meta.url).href;
const REGISTER_ICON_URL = new URL("../assets/ios/rik.png", import.meta.url).href;
const APPLE_MAPS_TOKEN = import.meta.env.VITE_APPLE_MAPS_TOKEN || "";
const MAP_MARKER_COLOR = "#9422db";

let appleMapKitPromise = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function chevronIcon(direction = "right") {
  const path = direction === "left" ? "m14 6-6 6 6 6" : "m10 6 6 6-6 6";
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="${path}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.6"/>
    </svg>
  `;
}

function currentSlug() {
  const segments = window.location.pathname.split("/").filter(Boolean);
  if (segments[0] !== "company" || !segments[1]) {
    return "";
  }
  return decodeURIComponent(segments[1]);
}

function renderState(markup) {
  const root = document.getElementById("company-detail-root");
  if (!root) return;
  root.innerHTML = markup;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function textOrNull(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function pickRecordValue(record, keys) {
  if (!record || typeof record !== "object") return null;
  for (const key of keys) {
    const value = textOrNull(record[key]);
    if (value) return value;
  }
  return null;
}

function normalizeEmtakCode(value) {
  const text = textOrNull(value);
  if (!text) return null;
  return text.replace(/\s+/g, "").replace(/\.0+$/, "");
}

function normalizeEmtakTree(nodes) {
  return safeArray(nodes).map((node) => ({
    code: normalizeEmtakCode(node?.Code || node?.code || node?.emtak_code || node?.emtakCode) || "",
    description:
      textOrNull(node?.DescriptionEn) ||
      textOrNull(node?.descriptionEn) ||
      textOrNull(node?.DescriptionEt) ||
      textOrNull(node?.descriptionEt) ||
      textOrNull(node?.description_en) ||
      textOrNull(node?.description_et) ||
      "",
    children: normalizeEmtakTree(node?.children || []),
  }));
}

function buildEmtakDescriptionIndex(currentNodes, oldNodes) {
  const currentTree = normalizeEmtakTree(currentNodes);
  const oldTree = normalizeEmtakTree(oldNodes);
  const exact = {};

  const insert = (nodes, overwrite) => {
    safeArray(nodes).forEach((node) => {
      if (!node || !node.code) return;
      if (overwrite || !exact[node.code]) {
        exact[node.code] = node.description;
      }
      insert(node.children, overwrite);
    });
  };

  insert(oldTree, false);
  insert(currentTree, true);

  return exact;
}

function findEmtakDescriptionInTree(code, nodes) {
  const normalizedCode = normalizeEmtakCode(code);
  if (!normalizedCode) return null;

  for (const node of safeArray(nodes)) {
    if (!node || typeof node !== "object") continue;
    const nodeCode = normalizeEmtakCode(node.Code || node.code || node.emtak_code || node.emtakCode);
    const description =
      textOrNull(node.DescriptionEn) ||
      textOrNull(node.descriptionEn) ||
      textOrNull(node.DescriptionEt) ||
      textOrNull(node.descriptionEt);

    if (nodeCode === normalizedCode && description) {
      return description;
    }

    const nested = findEmtakDescriptionInTree(normalizedCode, node.children);
    if (nested) return nested;
  }

  return null;
}

function findEmtakDescription(code, descriptions) {
  const normalized = normalizeEmtakCode(code);
  if (!normalized) return null;
  if (descriptions[normalized]) return descriptions[normalized];

  for (let length = normalized.length - 1; length >= 1; length -= 1) {
    const prefix = normalized.slice(0, length);
    if (descriptions[prefix]) return descriptions[prefix];
  }

  return null;
}

function niceTickStep(rawStep) {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  if (normalized <= 1) return magnitude;
  if (normalized <= 1.5) return 1.5 * magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 2.5) return 2.5 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function chartTicks(values) {
  const series = safeArray(values).filter((value) => Number.isFinite(Number(value))).map(Number);
  if (!series.length) return [0, 1, 2, 3];
  const minValue = Math.min(...series);
  const maxValue = Math.max(...series);
  const range = Math.max(maxValue - minValue, 1);
  const step = niceTickStep(range / 3);
  const top = Math.ceil(maxValue / step) * step;
  return [top, top - step, top - step * 2, top - step * 3];
}

function statusMeta(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (normalized === "R") return { label: "Registered", tone: "positive" };
  if (normalized === "L") return { label: "In liquidation", tone: "warning" };
  if (normalized === "N") return { label: "Bankruptcy", tone: "danger" };
  if (normalized === "K") return { label: "Deleted", tone: "danger" };
  return { label: "Unknown", tone: "neutral" };
}

function formatInteger(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "No data";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatDecimal(value, maximumFractionDigits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "No data";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(Number(value));
}

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "No data";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: Math.abs(Number(value)) >= 100 ? 0 : 2,
  }).format(Number(value));
}

function formatCompactCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "No data";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value));
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "No data";
  return `${formatDecimal(value, 1)}%`;
}

function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "CP";
  return parts.map((part) => part[0].toUpperCase()).join("");
}

function buildSummary(company) {
  const bits = [
    textOrNull(company.legal_form),
    textOrNull(company.registration_date) ? `Registered ${company.registration_date}` : null,
    textOrNull(company.newest_address?.county),
  ].filter(Boolean);
  if (!bits.length) {
    return "Company intelligence profile built from registry, tax, ownership, and contact data.";
  }
  return `${bits.join(" • ")}. Company intelligence profile built from live ContactPit data.`;
}

function normalizeCoordinates(coordinates) {
  const latitude = numberOrNull(coordinates?.latitude ?? coordinates?.lat);
  const longitude = numberOrNull(coordinates?.longitude ?? coordinates?.lng ?? coordinates?.lon);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

function appleMapsHrefForLocation({ coordinates, address, label }) {
  const addressText = textOrNull(address);
  const title = textOrNull(label) || addressText || "Location";
  const params = new URLSearchParams();

  if (coordinates) {
    params.set("ll", `${coordinates.latitude},${coordinates.longitude}`);
    params.set("q", title);
  } else if (addressText) {
    params.set("q", addressText);
  }

  return params.size ? `https://maps.apple.com/?${params.toString()}` : null;
}

function loadAppleMapKit() {
  if (!APPLE_MAPS_TOKEN) {
    return Promise.reject(new Error("Missing Apple Maps token"));
  }
  if (window.mapkit?.Map) {
    return Promise.resolve(window.mapkit);
  }
  if (appleMapKitPromise) {
    return appleMapKitPromise;
  }

  appleMapKitPromise = new Promise((resolve, reject) => {
    const callbackName = `contactPitCompanyAppleMapKitInit${Math.random().toString(36).slice(2)}`;
    const timeoutId = window.setTimeout(() => {
      cleanup();
      appleMapKitPromise = null;
      reject(new Error("Timed out loading Apple MapKit JS"));
    }, 10000);
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      delete window[callbackName];
    };

    window[callbackName] = () => {
      cleanup();
      resolve(window.mapkit);
    };

    const script = document.createElement("script");
    script.src = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.core.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.callback = callbackName;
    script.dataset.libraries = "map,annotations";
    script.dataset.token = APPLE_MAPS_TOKEN;
    script.onerror = () => {
      cleanup();
      appleMapKitPromise = null;
      reject(new Error("Failed to load Apple MapKit JS"));
    };
    document.head.append(script);
  });

  return appleMapKitPromise;
}

function renderCompanyLocationMap(container) {
  if (!container || !window.mapkit?.Map) return;

  const latitude = numberOrNull(container.getAttribute("data-company-map-lat"));
  const longitude = numberOrNull(container.getAttribute("data-company-map-lng"));
  if (latitude === null || longitude === null) return;

  const title = textOrNull(container.getAttribute("data-company-map-title")) || "Company location";
  const subtitle = textOrNull(container.getAttribute("data-company-map-subtitle")) || "";
  const { mapkit } = window;
  const map = new mapkit.Map(container);
  map.mapType = mapkit.Map.MapTypes.Standard;
  map.colorScheme = mapkit.Map.ColorSchemes.Light;
  map.tintColor = "#7a1ce1";
  const annotation = new mapkit.MarkerAnnotation(new mapkit.Coordinate(latitude, longitude), {
    title,
    subtitle,
    color: MAP_MARKER_COLOR,
    glyphColor: "#ffffff",
  });

  map.showItems([annotation]);
  if (mapkit.CoordinateRegion && mapkit.CoordinateSpan) {
    map.region = new mapkit.CoordinateRegion(
      new mapkit.Coordinate(latitude, longitude),
      new mapkit.CoordinateSpan(0.08, 0.08)
    );
  }
}

function renderCompanyLocationFallback(container) {
  if (!container) return;
  container.innerHTML = '<div class="company-map-orb"><span></span><span></span><span></span></div>';
}

function iconSvg(name) {
  const icons = {
    register: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 3.75A2.25 2.25 0 0 0 2.75 6v12A2.25 2.25 0 0 0 5 20.25h14A2.25 2.25 0 0 0 21.25 18V9.31a2.25 2.25 0 0 0-.66-1.59L17.53 4.66A2.25 2.25 0 0 0 15.94 4H5Zm10.25 1.9 4.1 4.1h-2.6A1.5 1.5 0 0 1 15.25 8.25v-2.6ZM7.5 11h9a.75.75 0 0 1 0 1.5h-9a.75.75 0 0 1 0-1.5Zm0 3.5h9a.75.75 0 0 1 0 1.5h-9a.75.75 0 0 1 0-1.5Z" fill="currentColor"/>
      </svg>
    `,
    email: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 6A2.5 2.5 0 0 0 2 8.5v7A2.5 2.5 0 0 0 4.5 18h15a2.5 2.5 0 0 0 2.5-2.5v-7A2.5 2.5 0 0 0 19.5 6h-15Zm14.15 2-5.99 4.49a1.14 1.14 0 0 1-1.32 0L5.35 8h13.3Z" fill="currentColor"/>
      </svg>
    `,
    phone: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7.27 3.5h2.46c.51 0 .97.32 1.14.8l1.13 3.19c.15.45.04.94-.29 1.28L10.2 10.3a13.31 13.31 0 0 0 3.5 3.5l1.53-1.51c.34-.33.83-.45 1.28-.29l3.19 1.13c.48.17.8.63.8 1.14v2.46c0 .7-.57 1.27-1.27 1.27h-1.15C9.95 20 4 14.05 4 6.42V5.27C4 4.57 4.57 4 5.27 4Z" fill="currentColor"/>
      </svg>
    `,
    website: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.75a9.25 9.25 0 1 0 0 18.5 9.25 9.25 0 0 0 0-18.5Zm5.64 8.25h-2.58a14.8 14.8 0 0 0-1.18-4.36A7.77 7.77 0 0 1 17.64 11Zm-5.64 7.72c-.69-.79-1.62-2.53-2-5.22h4c-.38 2.69-1.31 4.43-2 5.22Zm-2.2-7.22c.38-2.69 1.31-4.43 2-5.22.69.79 1.62 2.53 2 5.22h-4Zm.32-4.86A14.8 14.8 0 0 0 8.94 11H6.36a7.77 7.77 0 0 1 3.76-4.36ZM6.36 13.5h2.58a14.8 14.8 0 0 0 1.18 4.36 7.77 7.77 0 0 1-3.76-4.36Zm7.52 4.36A14.8 14.8 0 0 0 15.06 13.5h2.58a7.77 7.77 0 0 1-3.76 4.36Z" fill="currentColor"/>
      </svg>
    `,
    eye: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9.75 12C9.75 10.7574 10.7574 9.75 12 9.75C13.2426 9.75 14.25 10.7574 14.25 12C14.25 13.2426 13.2426 14.25 12 14.25C10.7574 14.25 9.75 13.2426 9.75 12Z" fill="currentColor"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M2 12C2 13.6394 2.42496 14.1915 3.27489 15.2957C4.97196 17.5004 7.81811 20 12 20C16.1819 20 19.028 17.5004 20.7251 15.2957C21.575 14.1915 22 13.6394 22 12C22 10.3606 21.575 9.80853 20.7251 8.70433C19.028 6.49956 16.1819 4 12 4C7.81811 4 4.97196 6.49956 3.27489 8.70433C2.42496 9.80853 2 10.3606 2 12ZM12 8.25C9.92893 8.25 8.25 9.92893 8.25 12C8.25 14.0711 9.92893 15.75 12 15.75C14.0711 15.75 15.75 14.0711 15.75 12C15.75 9.92893 14.0711 8.25 12 8.25Z" fill="currentColor"/>
      </svg>
    `,
    heart: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2 9.1371C2 14 6.01943 16.5914 8.96173 18.9109C10 19.7294 11 20.5 12 20.5C13 20.5 14 19.7294 15.0383 18.9109C17.9806 16.5914 22 14 22 9.1371C22 4.27416 16.4998 0.825464 12 5.50063C7.50016 0.825464 2 4.27416 2 9.1371Z" fill="currentColor"/>
      </svg>
    `,
  };
  return icons[name] || "";
}

function firstContact(contacts, types) {
  const typeSet = new Set(types.map((type) => String(type).toUpperCase()));
  return safeArray(contacts).find((item) => typeSet.has(String(item?.type || "").toUpperCase()) && textOrNull(item?.value));
}

function normalizeUrl(value) {
  const raw = textOrNull(value);
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function rankMarkup(label, value) {
  if (value === null || value === undefined) return "";
  return `
    <div class="company-rank-pill">
      <span>${escapeHtml(label)}</span>
      <strong>#${escapeHtml(formatInteger(value))}</strong>
    </div>
  `;
}

function metricCard({ label, value, note, accent = "" }) {
  return `
    <article class="company-kpi-card${accent ? ` ${accent}` : ""}">
      <p class="company-kpi-label">${escapeHtml(label)}</p>
      <p class="company-kpi-value">${escapeHtml(value)}</p>
      <p class="company-kpi-note">${escapeHtml(note)}</p>
    </article>
  `;
}

function infoItem(label, value) {
  if (!textOrNull(value)) return "";
  return `
    <article class="company-info-item">
      <p class="company-info-label">${escapeHtml(label)}</p>
      <p class="company-info-value">${escapeHtml(value)}</p>
    </article>
  `;
}

function contactAction({ label, value, href, icon, external = false }) {
  if (!textOrNull(value) || !textOrNull(href)) return "";
  return `
    <a class="company-contact-action" href="${escapeHtml(href)}" ${external ? 'target="_blank" rel="noreferrer"' : ""}>
      <span class="company-contact-icon" aria-hidden="true">${iconSvg(icon)}</span>
      <span class="company-contact-copy">
        <span class="company-contact-label">${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </span>
    </a>
  `;
}

function floatingAction({ label, href, icon, external = false }) {
  if (!textOrNull(href)) return "";
  const iconMarkup =
    icon === "register"
      ? `<img src="${escapeHtml(REGISTER_ICON_URL)}" alt="" />`
      : icon === "email"
        ? `<img src="${escapeHtml(EMAIL_ICON_URL)}" alt="" />`
        : icon === "phone"
          ? `<img src="${escapeHtml(PHONE_ICON_URL)}" alt="" />`
          : '<i class="ph-fill ph-globe-simple"></i>';

  return `
    <a
      class="company-floating-action company-floating-action-${escapeHtml(icon)}"
      href="${escapeHtml(href)}"
      aria-label="${escapeHtml(label)}"
      title="${escapeHtml(label)}"
      ${external ? 'target="_blank" rel="noreferrer"' : ""}
    >
      <span class="company-floating-action-icon company-floating-action-icon-${escapeHtml(icon)}" aria-hidden="true">${iconMarkup}</span>
    </a>
  `;
}

function floatingStat({ label, value, icon }) {
  if (!textOrNull(value)) return "";
  return `
    <span class="company-floating-stat" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
      <span class="company-floating-stat-icon" aria-hidden="true">${iconSvg(icon)}</span>
      <span>${escapeHtml(value)}</span>
    </span>
  `;
}

function miniBars(title, points, formatter, scope) {
  const items = safeArray(points);
  if (!items.length) {
    return `
      <article class="company-chart-card">
        <div class="company-section-card-head">
          <div>
            <p class="company-card-eyebrow">${escapeHtml(scope)}</p>
            <h3>${escapeHtml(title)}</h3>
          </div>
        </div>
        <p class="company-empty-copy">No ${scope.toLowerCase()} history available yet.</p>
      </article>
    `;
  }

  const maxValue = Math.max(...items.map((item) => Number(item.value) || 0), 1);
  const bars = items
    .map((item) => {
      const value = Number(item.value) || 0;
      const height = Math.max(10, Math.round((value / maxValue) * 100));
      return `
        <div class="company-chart-bar-group">
          <span class="company-chart-bar" style="height:${height}%"></span>
          <span class="company-chart-period">${escapeHtml(item.period)}</span>
          <strong class="company-chart-value">${escapeHtml(formatter(value))}</strong>
        </div>
      `;
    })
    .join("");

  return `
    <article class="company-chart-card">
      <div class="company-section-card-head">
        <div>
          <p class="company-card-eyebrow">${escapeHtml(scope)}</p>
          <h3>${escapeHtml(title)}</h3>
        </div>
      </div>
      <div class="company-chart-bars">
        ${bars}
      </div>
    </article>
  `;
}

function normalizedSeriesBars(points, formatter) {
  const items = safeArray(points);
  if (!items.length) {
    return '<p class="company-empty-copy">No history available yet.</p>';
  }

  const values = items.map((item) => Number(item.value) || 0);
  const maxValue = Math.max(...values);

  return `
    <div class="company-trend-bars" style="grid-template-columns:repeat(${items.length}, minmax(0, 1fr))">
      ${items
        .map((item) => {
          const value = Number(item.value) || 0;
          const height = 28 + (Math.max(value, 0) / Math.max(maxValue, 1)) * 148;
          return `
            <div class="company-trend-bar-group">
              <div class="company-trend-rail">
                <span class="company-trend-bar" style="height:${Math.round(height)}px"></span>
              </div>
              <span class="company-trend-period">${escapeHtml(item.period)}</span>
              <strong class="company-trend-value">${escapeHtml(formatter(value))}</strong>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function smoothLinePath(points) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const previous = points[index - 1] || current;
    const afterNext = points[index + 2] || next;
    const control1x = current.x + (next.x - previous.x) / 6;
    const control1y = current.y + (next.y - previous.y) / 6;
    const control2x = next.x - (afterNext.x - current.x) / 6;
    const control2y = next.y - (afterNext.y - current.y) / 6;
    path += ` C ${control1x} ${control1y}, ${control2x} ${control2y}, ${next.x} ${next.y}`;
  }
  return path;
}

function smoothAreaPath(points, baselineY) {
  if (!points.length) return "";
  return `${smoothLinePath(points)} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;
}

function lineChartMarkup(chartId, mode, points, formatter) {
  const items = safeArray(points);
  if (!items.length) {
    return '<p class="company-empty-copy">No history available yet.</p>';
  }

  const values = items.map((item) => Number(item.value) || 0);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(maxValue - minValue, 1);
  const paddingX = 18;
  const width = 1000;
  const height = 240;
  const topPad = 18;
  const bottomPad = 28;
  const usableHeight = height - topPad - bottomPad;
  const baselineY = height - bottomPad;
  const stepX = items.length > 1 ? (width - paddingX * 2) / (items.length - 1) : 0;
  const pointsWithCoords = items.map((item, index) => {
    const x = paddingX + stepX * index;
    const y = topPad + (maxValue - (Number(item.value) || 0)) / range * usableHeight;
    return { ...item, x, y };
  });
  const linePath = smoothLinePath(pointsWithCoords);
  const areaPath = smoothAreaPath(pointsWithCoords, baselineY);
  const latest = items[items.length - 1];
  const dense = items.length > 8;
  const yTicks = chartTicks(values);
  const latestPoint = pointsWithCoords[pointsWithCoords.length - 1];
  const axisLabels = items.map((item, index) => {
    if (mode !== "quarterly") return { label: item.period, emphasized: true };
    const period = String(item.period || "");
    const [year, quarter] = period.split("/");
    const isFirstPoint = index === 0;
    if (quarter === "1" || isFirstPoint) {
      return { label: year || period, emphasized: true };
    }
    return { label: "", emphasized: false };
  });

  return `
    <div class="company-line-chart" data-line-chart="${escapeHtml(chartId)}" data-line-default-period="${escapeHtml(latest.period)}" data-line-default-value="${escapeHtml(formatter(latest.value))}">
      <div class="company-line-chart-canvas">
        <div class="company-line-chart-plot">
          <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="line-fill-${escapeHtml(chartId)}" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="rgba(122, 28, 225, 0.38)"></stop>
                <stop offset="100%" stop-color="rgba(122, 28, 225, 0.02)"></stop>
              </linearGradient>
            </defs>
            <line class="company-line-chart-guide" x1="${latestPoint.x}" x2="${latestPoint.x}" y1="${topPad}" y2="${baselineY}" data-line-guide hidden></line>
            <path class="company-line-chart-area" d="${escapeHtml(areaPath)}" fill="url(#line-fill-${escapeHtml(chartId)})"></path>
            <path class="company-line-chart-path" d="${escapeHtml(linePath)}"></path>
          </svg>
          ${pointsWithCoords
            .map(
              (point) => `
                <span
                  class="company-line-chart-marker"
                  aria-hidden="true"
                  style="left:${((point.x / width) * 100).toFixed(4)}%; top:${((point.y / height) * 100).toFixed(4)}%;"
                ></span>
              `
            )
            .join("")}
          ${pointsWithCoords
            .map(
              (point) => `
                <button
                  class="company-line-chart-hit"
                  type="button"
                  data-line-point="${escapeHtml(chartId)}"
                  data-line-period="${escapeHtml(point.period)}"
                  data-line-value="${escapeHtml(formatter(point.value))}"
                  data-line-x="${point.x}"
                  data-line-ratio="${(point.x / width).toFixed(6)}"
                  style="left:${((point.x / width) * 100).toFixed(4)}%; top:${((point.y / height) * 100).toFixed(4)}%;"
                  aria-label="${escapeHtml(`${point.period} ${formatter(point.value)}`)}"
                ></button>
              `
            )
            .join("")}
        </div>
        <div class="company-line-chart-y-axis">
          ${yTicks
            .map(
              (value) => `
                <span>${escapeHtml(formatter(value))}</span>
              `
            )
            .join("")}
        </div>
      </div>
      <div class="company-line-chart-axis${dense ? " is-dense" : ""}${mode === "quarterly" ? " is-quarterly" : ""}" style="grid-template-columns:repeat(${items.length}, minmax(0, 1fr))">
        ${axisLabels
          .map(
            (item) => `
              <div class="company-line-chart-tick${item.emphasized ? " has-label" : ""}${mode === "quarterly" ? " is-quarterly" : ""}">
                <span>${escapeHtml(item.label)}</span>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function historyChartMarkup(metricId, title, history, formatter) {
  const annualPoints = metricHistorySeries(history, "annual");
  const quarterlyPoints = metricHistorySeries(history, "quarterly");
  const defaultMode = annualPoints.length ? "annual" : "quarterly";
  const annualLatest = annualPoints[annualPoints.length - 1];
  const quarterlyLatest = quarterlyPoints[quarterlyPoints.length - 1];

  return `
    <article class="company-chart-card company-overview-chart-card" data-chart-shell="${escapeHtml(metricId)}" data-chart-mode="${escapeHtml(defaultMode)}">
      <div class="company-overview-chart-toolbar">
        <div class="company-overview-chart-summaries">
          <div class="company-line-chart-summary${defaultMode === "annual" ? " is-active" : ""}" data-chart-summary-panel="${escapeHtml(metricId)}" data-chart-summary-mode="annual" data-line-summary="${escapeHtml(`${metricId}-annual`)}">
            <strong data-line-summary-value>${escapeHtml(annualLatest ? formatter(annualLatest.value) : "No data")}</strong>
            <span data-line-summary-period>${escapeHtml(annualLatest?.period || "")}</span>
          </div>
          <div class="company-line-chart-summary${defaultMode === "quarterly" ? " is-active" : ""}" data-chart-summary-panel="${escapeHtml(metricId)}" data-chart-summary-mode="quarterly" data-line-summary="${escapeHtml(`${metricId}-quarterly`)}">
            <strong data-line-summary-value>${escapeHtml(quarterlyLatest ? formatter(quarterlyLatest.value) : "No data")}</strong>
            <span data-line-summary-period>${escapeHtml(quarterlyLatest?.period || "")}</span>
          </div>
        </div>
        <div class="company-toggle" role="tablist" aria-label="${escapeHtml(title)} history scope">
          <button class="company-toggle-button${defaultMode === "annual" ? " is-active" : ""}" type="button" data-chart-toggle="${escapeHtml(metricId)}" data-chart-mode="annual">Annual</button>
          <button class="company-toggle-button${defaultMode === "quarterly" ? " is-active" : ""}" type="button" data-chart-toggle="${escapeHtml(metricId)}" data-chart-mode="quarterly">Quarterly</button>
        </div>
      </div>
      <div class="company-chart-mode-panel${defaultMode === "annual" ? " is-active" : ""}" data-chart-panel="${escapeHtml(metricId)}" data-chart-panel-mode="annual">
        ${lineChartMarkup(`${metricId}-annual`, "annual", annualPoints, formatter)}
      </div>
      <div class="company-chart-mode-panel${defaultMode === "quarterly" ? " is-active" : ""}" data-chart-panel="${escapeHtml(metricId)}" data-chart-panel-mode="quarterly">
        ${lineChartMarkup(`${metricId}-quarterly`, "quarterly", quarterlyPoints, formatter)}
      </div>
    </article>
  `;
}

function metricHistorySeries(history, mode) {
  const items = safeArray(history?.[mode]);
  return items;
}

function personName(entry) {
  const fullName = [textOrNull(entry?.first_name), textOrNull(entry?.last_name)].filter(Boolean).join(" ");
  return fullName || textOrNull(entry?.full_name) || textOrNull(entry?.name) || "Unknown";
}

function companySlug(name, registryCode) {
  const normalizedName = String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const normalizedCode = String(registryCode || "").trim();
  return normalizedName && normalizedCode ? `${normalizedName}-${normalizedCode}` : null;
}

function personRole(entry) {
  return textOrNull(entry?.role_text) || textOrNull(entry?.role) || textOrNull(entry?.entity_type) || "Person";
}

function personDateRange(entry) {
  const start = textOrNull(entry?.start_date);
  const end = textOrNull(entry?.end_date);
  if (start && end) return `${start} - ${end}`;
  if (start) return `Since ${start}`;
  if (end) return `Until ${end}`;
  return null;
}

function countryFlagEmoji(value) {
  const code = String(value || "").trim().toUpperCase();
  const alpha3To2 = {
    EST: "EE",
    LTU: "LT",
    LVA: "LV",
    FIN: "FI",
    SWE: "SE",
    NOR: "NO",
    DEU: "DE",
    POL: "PL",
    GBR: "GB",
    USA: "US",
    UKR: "UA",
    RUS: "RU",
  };
  const alpha2 = code.length === 2 ? code : alpha3To2[code];
  if (!/^[A-Z]{2}$/.test(alpha2 || "")) return null;
  return Array.from(alpha2)
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}

function personFlag(entry) {
  const explicitFlag = countryFlagEmoji(entry?.country_code || entry?.foreign_country_code);
  if (explicitFlag) return explicitFlag;

  const entityType = String(entry?.entity_type || "").trim().toLowerCase();
  const personId = textOrNull(entry?.id_hash) || textOrNull(entry?.personal_id_hash);
  const registryCode = textOrNull(entry?.registry_code);

  if (entityType === "person" && personId) {
    return countryFlagEmoji("EST");
  }

  if (entityType === "company" && registryCode) {
    return countryFlagEmoji("EST");
  }

  return null;
}

function relationHref(entry) {
  const entityType = String(entry?.entity_type || "").trim().toLowerCase();
  const explicitSlug = textOrNull(entry?.slug);
  const countryCode = String(entry?.country_code || entry?.foreign_country_code || "").trim().toUpperCase();

  if (entityType === "person") {
    return explicitSlug ? `/person/${encodeURIComponent(explicitSlug)}` : null;
  }

  if (entityType === "company") {
    if (countryCode && countryCode !== "EST") return null;
    if (explicitSlug) return `/company/${encodeURIComponent(explicitSlug)}`;
    const fallbackSlug = companySlug(personName(entry), entry?.registry_code);
    return fallbackSlug ? `/company/${encodeURIComponent(fallbackSlug)}` : null;
  }

  return null;
}

function companyCardShell({ entry, content, href }) {
  if (href) {
    return `<a class="company-person-card is-navigable" href="${escapeHtml(href)}">${content}</a>`;
  }
  return `<article class="company-person-card">${content}</article>`;
}

function companyEntityCardMarkup({ entry, name, meta, href }) {
  return companyCardShell({
    entry,
    href,
    content: `
      <div class="company-person-avatar">${escapeHtml(initials(name))}</div>
      <div class="company-person-copy">
        <h3>${escapeHtml(name)}</h3>
        <p>${escapeHtml(meta)}</p>
      </div>
      ${href ? '<span class="company-person-chevron" aria-hidden="true">›</span>' : ""}
    `,
  });
}

function peopleListMarkup(items, emptyLabel) {
  const list = safeArray(items);
  if (!list.length) {
    return `<p class="company-empty-copy">${escapeHtml(emptyLabel)}</p>`;
  }

  return `
    <div class="company-people-list">
      ${list
        .map((entry) => {
          const flag = personFlag(entry);
          const meta = [flag, personDateRange(entry)]
            .filter(Boolean)
            .join(" • ");
          const href = relationHref(entry);

          return companyEntityCardMarkup({
            entry,
            name: personName(entry),
            meta: meta || "No additional detail",
            href,
          });
        })
        .join("")}
    </div>
  `;
}

function shareholderListMarkup(items) {
  const list = safeArray(items);
  if (!list.length) {
    return '<p class="company-empty-copy">No shareholder data is available for this company.</p>';
  }

  return `
    <div class="company-people-list">
      ${list
        .slice(0, 8)
        .map((entry) => {
          const name =
            textOrNull(entry?.full_name) ||
            [textOrNull(entry?.first_name), textOrNull(entry?.last_name)].filter(Boolean).join(" ") ||
            textOrNull(entry?.name) ||
            "Unknown";
          const parts = [];
          if (entry?.share_percent !== null && entry?.share_percent !== undefined) {
            parts.push(`${formatDecimal(entry.share_percent, 2)}% ownership`);
          }
          if (entry?.share_amount !== null && entry?.share_amount !== undefined) {
            parts.push(`${formatCurrency(entry.share_amount)} capital`);
          }
          if (textOrNull(entry?.entity_type)) {
            parts.push(String(entry.entity_type));
          }
          const href = relationHref(entry);
          return companyEntityCardMarkup({
            entry,
            name,
            meta: parts.join(" • ") || "Shareholder",
            href,
          });
        })
        .join("")}
    </div>
  `;
}

function tagList(items, formatter) {
  const list = safeArray(items);
  if (!list.length) return '<p class="company-empty-copy">No supporting records are available for this section.</p>';
  return `
    <div class="company-tag-grid">
      ${list.map((item) => `<article class="company-tag-card">${formatter(item)}</article>`).join("")}
    </div>
  `;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function localizedLegendTitle(entry) {
  if (!entry) return null;
  if (typeof entry === "string") return textOrNull(entry);
  if (typeof entry !== "object") return null;

  const pickFirst = (...values) => {
    for (const value of values) {
      const items = Array.isArray(value) ? value : [value];
      for (const item of items) {
        const text = textOrNull(item);
        if (text) return text;
      }
    }
    return null;
  };

  return pickFirst(
    entry.english,
    entry.en,
    entry.estonian,
    entry.et,
    entry.raw,
    entry.label,
    entry.title,
    entry.name
  );
}

function legendLookup(legendMap) {
  const source = legendMap && typeof legendMap === "object" ? legendMap : {};
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [String(key), localizedLegendTitle(value) || String(key)])
  );
}

function pickLegendMap(legends, snakeKey, camelKey) {
  if (!legends || typeof legends !== "object") return {};
  if (legends[snakeKey]) return legends[snakeKey];
  if (legends[camelKey]) return legends[camelKey];

  const normalize = (value) => String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const expected = new Set([normalize(snakeKey), normalize(camelKey)]);

  const match = Object.entries(legends).find(([key]) => expected.has(normalize(key)));
  return match?.[1] && typeof match[1] === "object" ? match[1] : {};
}

const INCOME_STATEMENT_FALLBACK_LABELS = {
  "10": "Sales revenue",
  "25": "Cost of goods sold",
  "40": "Other operating income",
  "110": "Goods, raw materials, and services",
  "125": "Marketing expenses",
  "130": "Total personnel expenses",
  "135": "General administration expenses",
  "140": "Depreciation and impairment of fixed assets",
  "150": "Other operating expenses",
  "170": "Operating profit",
  "191": "Financial income/expenses from subsidiaries",
  "192": "Financial income/expenses from affiliates",
  "196": "Other financial income and expenses",
  "197": "Interest income",
  "205": "Interest expense",
  "230": "Profit before tax",
  "250": "Net profit",
  "440": "Various operating expenses",
};

const BALANCE_SHEET_FALLBACK_LABELS = {
  "10": "Cash and bank accounts",
  "20": "Short-term financial investments",
  "61": "Raw materials and supplies",
  "62": "Work in progress",
  "63": "Finished goods",
  "64": "Goods purchased for resale",
  "65": "Prepayments for inventories",
  "70": "Total inventories",
  "75": "Short-term receivables from customers",
  "76": "Short-term receivables from related parties",
  "77": "Short-term tax prepayments and refunds",
  "78": "Other short-term receivables",
  "79": "Short-term prepayments",
  "80": "Total receivables and prepayments",
  "100": "Current assets",
  "104": "Investments in subsidiaries and affiliates",
  "105": "Other long-term investments",
  "106": "Long-term receivables",
  "107": "Long-term prepayments",
  "110": "Total long-term financial investments",
  "111": "Land",
  "112": "Machinery and equipment",
  "113": "Other tangible fixed assets",
  "115": "Construction in progress and prepayments",
  "119": "Buildings",
  "120": "Total tangible fixed assets",
  "122": "Development expenditures",
  "123": "Other intangible fixed assets",
  "124": "Goodwill",
  "125": "Software",
  "126": "Concessions, patents, licenses, trademarks",
  "127": "Projects in progress and prepayments",
  "128": "Other long-term receivables",
  "129": "Long-term prepayments",
  "130": "Total receivables and prepayments",
  "140": "Property investments",
  "150": "Biological assets",
  "200": "Non-current assets",
  "300": "Total assets",
  "310": "Total loans",
  "370": "Other short-term liabilities",
  "390": "Payables and prepayments",
  "400": "Short-term liabilities",
  "410": "Long-term loans",
  "420": "Long-term payables and prepayments",
  "440": "Long-term provisions and other liabilities",
  "500": "Long-term liabilities",
  "610": "Share capital",
  "620": "Share premium",
  "651": "Legal reserve",
  "652": "Other reserves",
  "655": "Retained earnings",
  "656": "Prior-period profit or loss",
  "660": "Current-year profit or loss",
  "670": "Own shares",
  "680": "Other equity",
  "700": "Equity / net assets",
  "800": "Liabilities and equity",
};

const CASH_FLOW_FALLBACK_LABELS = {
  "70": "Operating profit (loss) / result from core activities",
  "80": "Depreciation and impairment of fixed assets",
  "90": "Profit (loss) on sale of fixed assets",
  "100": "Other adjustments",
  "110": "Total adjustments",
  "130": "Change in operating receivables and prepayments",
  "140": "Change in inventories",
  "150": "Change in operating liabilities and prepayments",
  "155": "Interest received",
  "160": "Interest paid",
  "170": "Corporate income tax paid",
  "180": "Receipts from earmarked fees, donations, grants",
  "185": "Dividends received",
  "190": "Other cash flows from operating activities",
  "201": "Net cash flow from operating activities",
  "281": "Payments for acquisition of tangible and intangible fixed assets",
  "282": "Proceeds from sale of tangible and intangible fixed assets",
  "291": "Loans granted",
  "292": "Repayments of loans granted",
  "293": "Interest received",
  "294": "Dividends received",
  "297": "Other receipts from investing activities",
  "300": "Net cash flow from investing activities",
  "330": "Repayment of finance lease principal",
  "331": "Loans received",
  "332": "Repayment of loans received",
  "333": "Change in overdraft balance",
  "336": "Dividends paid",
  "337": "Interest paid",
  "350": "Corporate income tax paid",
  "400": "Net cash flow from financing activities",
  "600": "Net cash flow",
  "610": "Cash and cash equivalents at beginning of period",
  "700": "Change in cash and cash equivalents",
  "800": "Cash and cash equivalents at end of period",
};

function resolvedLegendLabel(lookup, fallbackLabels, code, fallbackKey) {
  const normalizedCode = String(code);
  return lookup[normalizedCode] || fallbackLabels[normalizedCode] || fallbackKey;
}

function latestYearEntry(items) {
  return safeArray(items)
    .slice()
    .sort((left, right) => (numberOrNull(right?.year) || 0) - (numberOrNull(left?.year) || 0))[0] || null;
}

function formatRatio(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "No data";
  return `${formatDecimal(value, 2)}x`;
}

function buildFinancialSnapshot(message) {
  const latestIncomeStatement = latestYearEntry(message?.income_statements);
  const latestStatement = latestYearEntry(message?.statement_of_revenues_and_expenses);

  if (!latestIncomeStatement && !latestStatement) {
    return null;
  }

  if (!latestStatement || (numberOrNull(latestIncomeStatement?.year) || 0) >= (numberOrNull(latestStatement?.year) || 0)) {
    const directRevenue = numberOrNull(latestIncomeStatement?.i_total_revenue);
    const salesRevenue = numberOrNull(latestIncomeStatement?.i_10);
    const otherRevenue = numberOrNull(latestIncomeStatement?.i_40);
    const revenue =
      directRevenue ??
      (salesRevenue !== null || otherRevenue !== null ? (salesRevenue || 0) + (otherRevenue || 0) : null);
    const directOperatingCosts = numberOrNull(latestIncomeStatement?.i_total_operating_cost);
    const costOfGoodsSold = numberOrNull(latestIncomeStatement?.i_25);
    const marketingExpenses = numberOrNull(latestIncomeStatement?.i_125);
    const administrationExpenses = numberOrNull(latestIncomeStatement?.i_135);
    const otherOperatingExpenses = numberOrNull(latestIncomeStatement?.i_150);
    const operatingCosts =
      directOperatingCosts ??
      (costOfGoodsSold !== null || marketingExpenses !== null || administrationExpenses !== null || otherOperatingExpenses !== null
        ? (costOfGoodsSold || 0) + (marketingExpenses || 0) + (administrationExpenses || 0) + (otherOperatingExpenses || 0)
        : null);

    return {
      year: numberOrNull(latestIncomeStatement?.year),
      revenue,
      operatingCosts,
      operatingProfit: numberOrNull(latestIncomeStatement?.i_170),
      profitBeforeTax: numberOrNull(latestIncomeStatement?.i_230),
      netProfit: numberOrNull(latestIncomeStatement?.i_250),
      source: "income_statement",
    };
  }

  return {
    year: numberOrNull(latestStatement?.year),
    revenue: numberOrNull(latestStatement?.sre_270) ?? numberOrNull(latestStatement?.sre_390),
    operatingCosts: numberOrNull(latestStatement?.sre_290),
    operatingProfit: numberOrNull(latestStatement?.sre_490),
    profitBeforeTax: null,
    netProfit: numberOrNull(latestStatement?.sre_510),
    source: "statement_of_revenues_and_expenses",
  };
}

function buildFinancialSnapshotForYear(message, year) {
  const incomeStatement = safeArray(message?.income_statements).find((item) => numberOrNull(item?.year) === year);
  const statement = safeArray(message?.statement_of_revenues_and_expenses).find((item) => numberOrNull(item?.year) === year);

  if (incomeStatement) {
    const directRevenue = numberOrNull(incomeStatement?.i_total_revenue);
    const salesRevenue = numberOrNull(incomeStatement?.i_10);
    const otherRevenue = numberOrNull(incomeStatement?.i_40);
    const revenue =
      directRevenue ??
      (salesRevenue !== null || otherRevenue !== null ? (salesRevenue || 0) + (otherRevenue || 0) : null);
    const directOperatingCosts = numberOrNull(incomeStatement?.i_total_operating_cost);
    const costOfGoodsSold = numberOrNull(incomeStatement?.i_25);
    const marketingExpenses = numberOrNull(incomeStatement?.i_125);
    const administrationExpenses = numberOrNull(incomeStatement?.i_135);
    const otherOperatingExpenses = numberOrNull(incomeStatement?.i_150);
    const operatingCosts =
      directOperatingCosts ??
      (costOfGoodsSold !== null || marketingExpenses !== null || administrationExpenses !== null || otherOperatingExpenses !== null
        ? (costOfGoodsSold || 0) + (marketingExpenses || 0) + (administrationExpenses || 0) + (otherOperatingExpenses || 0)
        : null);

    return {
      year,
      revenue,
      operatingCosts,
      operatingProfit: numberOrNull(incomeStatement?.i_170),
      profitBeforeTax: numberOrNull(incomeStatement?.i_230),
      netProfit: numberOrNull(incomeStatement?.i_250),
      source: "income_statement",
    };
  }

  if (statement) {
    return {
      year,
      revenue: numberOrNull(statement?.sre_270) ?? numberOrNull(statement?.sre_390),
      operatingCosts: numberOrNull(statement?.sre_290),
      operatingProfit: numberOrNull(statement?.sre_490),
      profitBeforeTax: null,
      netProfit: numberOrNull(statement?.sre_510),
      source: "statement_of_revenues_and_expenses",
    };
  }

  return null;
}

function financialPeriods(message) {
  const years = new Set();
  [
    ...safeArray(message?.income_statements),
    ...safeArray(message?.statement_of_revenues_and_expenses),
    ...safeArray(message?.balance_sheets),
    ...safeArray(message?.cash_flows),
    ...safeArray(message?.revenue_by_emtak),
  ].forEach((item) => {
    const year = numberOrNull(item?.year);
    if (year !== null) years.add(year);
  });

  return Array.from(years).sort((left, right) => right - left);
}

function statementRowMarkup({ label, value, kind = "child", note = null }) {
  return `
    <div class="company-statement-row company-statement-row-${escapeHtml(kind)}">
      <div class="company-statement-row-copy">
        <span>${escapeHtml(label)}</span>
        ${textOrNull(note) ? `<p>${escapeHtml(note)}</p>` : ""}
      </div>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function statementSectionMarkup(rows, emptyLabel) {
  const content = safeArray(rows).filter(Boolean).join("");
  if (!content) {
    return `<p class="company-empty-copy">${escapeHtml(emptyLabel)}</p>`;
  }
  return `
    <div class="company-statement-block">
      ${content}
    </div>
  `;
}

function nonZeroStatementValue(value) {
  const number = numberOrNull(value);
  return number !== null && number !== 0 ? number : null;
}

function incomeStatementMarkup(statement, legends) {
  if (!statement) {
    return '<p class="company-empty-copy">No income statement data is available for this year.</p>';
  }

  const incomeLegends = legendLookup(pickLegendMap(legends, "income_statement", "incomeStatement"));
  const format2 = nonZeroStatementValue(statement.i_25) !== null || nonZeroStatementValue(statement.i_125) !== null || nonZeroStatementValue(statement.i_135) !== null;

  const revenueRows = [
    nonZeroStatementValue(statement.i_10) !== null
      ? statementRowMarkup({ label: incomeLegends["10"] || "Sales revenue", value: formatCompactCurrency(statement.i_10) })
      : "",
    nonZeroStatementValue(statement.i_40) !== null
      ? statementRowMarkup({ label: incomeLegends["40"] || "Other operating income", value: formatCompactCurrency(statement.i_40) })
      : "",
  ];

  const operatingCostCodes = format2 ? [25, 125, 135, 150] : [110, 130, 140, 440, 150];
  const operatingCostRows = operatingCostCodes
    .map((code) => {
      const value = nonZeroStatementValue(statement[`i_${code}`]);
      if (value === null) return "";
      return statementRowMarkup({
        label: resolvedLegendLabel(incomeLegends, INCOME_STATEMENT_FALLBACK_LABELS, code, `i_${code}`),
        value: formatCompactCurrency(Math.abs(value)),
      });
    });

  const netInterestCodes = [191, 192, 196, 197, 205];
  const netInterestRows = netInterestCodes
    .map((code) => {
      const value = nonZeroStatementValue(statement[`i_${code}`]);
      if (value === null) return "";
      return statementRowMarkup({
        label: resolvedLegendLabel(incomeLegends, INCOME_STATEMENT_FALLBACK_LABELS, code, `i_${code}`),
        value: formatCompactCurrency(value),
      });
    });

  return `
    <div class="company-statement-layout">
      ${statementSectionMarkup(
        [
          ...revenueRows,
          statementRowMarkup({
            label: "Revenue",
            value: formatCompactCurrency(statement.i_total_revenue ?? ((numberOrNull(statement.i_10) || 0) + (numberOrNull(statement.i_40) || 0))),
            kind: "parent",
          }),
        ],
        "No revenue rows are available."
      )}
      ${statementSectionMarkup(
        [
          ...operatingCostRows,
          statementRowMarkup({
            label: "Operating cost",
            value: formatCompactCurrency(statement.i_total_operating_cost),
            kind: "parent",
          }),
        ],
        "No operating cost rows are available."
      )}
      ${statementSectionMarkup(
        [
          statementRowMarkup({
            label: "Operating profit",
            value: formatCompactCurrency(statement.i_170),
            kind: "parent",
          }),
        ],
        "No operating profit is available."
      )}
      ${statementSectionMarkup(
        [
          ...netInterestRows,
          statementRowMarkup({
            label: "Net interest",
            value: formatCompactCurrency((numberOrNull(statement.i_197) || 0) + (numberOrNull(statement.i_205) || 0)),
            kind: "parent",
          }),
        ],
        "No net-interest rows are available."
      )}
      ${statementSectionMarkup(
        [
          statementRowMarkup({
            label: "Profit before tax",
            value: formatCompactCurrency(statement.i_230),
            kind: "parent",
          }),
        ],
        "No pre-tax profit is available."
      )}
      ${statementSectionMarkup(
        [
          statementRowMarkup({
            label: "Net profit",
            value: formatCompactCurrency(statement.i_250),
            kind: "parent",
          }),
        ],
        "No net profit is available."
      )}
    </div>
  `;
}

function statementOfRevenuesAndExpensesMarkup(statement, legends) {
  if (!statement) {
    return '<p class="company-empty-copy">No statement of revenues and expenses data is available for this year.</p>';
  }

  const statementLegends = legendLookup(
    pickLegendMap(legends, "statement_of_revenues_and_expenses", "statementOfRevenuesAndExpenses")
  );
  const order = [197, 270, 290, 390, 420, 440, 490, 510];
  const rows = order
    .map((rowNo) => {
      const value = nonZeroStatementValue(statement[`sre_${rowNo}`]);
      if (value === null) return "";
      return statementRowMarkup({
        label: resolvedLegendLabel(statementLegends, {}, rowNo, `sre_${rowNo}`),
        value: formatCompactCurrency(value),
      });
    })
    .filter(Boolean);

  return `<div class="company-statement-layout">${statementSectionMarkup(rows, "No statement rows are available.")}</div>`;
}

function cashFlowMarkup(cashFlow, legends) {
  if (!cashFlow) {
    return '<p class="company-empty-copy">No cash flow data is available for this year.</p>';
  }

  const cashFlowLegends = legendLookup(pickLegendMap(legends, "cash_flow", "cashFlow"));
  const rows = Object.keys(cashFlow)
    .filter((key) => key.startsWith("cf_"))
    .map((key) => ({
      rowNo: key.slice(3),
      value: nonZeroStatementValue(cashFlow[key]),
    }))
    .filter((row) => row.value !== null)
    .sort((left, right) => Number(left.rowNo) - Number(right.rowNo))
    .map((row) =>
      statementRowMarkup({
        label: resolvedLegendLabel(cashFlowLegends, CASH_FLOW_FALLBACK_LABELS, row.rowNo, `cf_${row.rowNo}`),
        value: formatCompactCurrency(row.value),
      })
    );

  return `<div class="company-statement-layout">${statementSectionMarkup(rows, "No cash flow rows are available.")}</div>`;
}

function balanceGroupMarkup(totalLabel, totalValue, groups) {
  const rows = [
    ...safeArray(groups).filter(Boolean),
    statementRowMarkup({ label: totalLabel, value: formatCompactCurrency(totalValue), kind: "parent" }),
  ];
  return statementSectionMarkup(rows, `No ${totalLabel.toLowerCase()} rows are available.`);
}

function balanceSheetMarkup(balanceSheet, legends) {
  if (!balanceSheet) {
    return '<p class="company-empty-copy">No balance sheet data is available for this year.</p>';
  }

  const balanceLegends = legendLookup(pickLegendMap(legends, "balance_sheet", "balanceSheet"));
  const sumRows = (rowNos) => {
    const values = safeArray(rowNos)
      .map((rowNo) => numberOrNull(balanceSheet[`b_${rowNo}`]) ?? numberOrNull(balanceSheet.rowValues?.[rowNo]))
      .filter((value) => value !== null);
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0);
  };
  const rowMarkup = (rowNos, fallbackRow) => {
    const childRows = safeArray(rowNos)
      .map((rowNo) => {
        const value = nonZeroStatementValue(balanceSheet[`b_${rowNo}`] ?? balanceSheet.rowValues?.[rowNo]);
        if (value === null) return "";
        return statementRowMarkup({
          label: resolvedLegendLabel(balanceLegends, BALANCE_SHEET_FALLBACK_LABELS, rowNo, `b_${rowNo}`),
          value: formatCompactCurrency(value),
        });
      })
      .filter(Boolean);
    if (childRows.length) return childRows;
    const fallbackValue = nonZeroStatementValue(balanceSheet[`b_${fallbackRow}`] ?? balanceSheet.rowValues?.[fallbackRow]);
    return fallbackValue !== null
      ? [statementRowMarkup({ label: resolvedLegendLabel(balanceLegends, BALANCE_SHEET_FALLBACK_LABELS, fallbackRow, `b_${fallbackRow}`), value: formatCompactCurrency(fallbackValue) })]
      : [];
  };

  const currentAssetsChildren = [
    ...rowMarkup([10], 10),
    ...rowMarkup([20], 20),
    ...rowMarkup([61, 62, 63, 64, 65], 70),
    ...rowMarkup([75, 76, 77, 78, 79], 80),
  ];
  const nonCurrentAssetsChildren = [
    ...rowMarkup([104, 105], 110),
    ...rowMarkup([106, 107, 1240, 128, 129], 130),
    ...rowMarkup([111, 112, 113, 115, 119], 120),
    ...rowMarkup([122, 123, 124, 125, 126, 127], 1300),
    ...rowMarkup([140, 150], 150),
  ];
  const shortTermLiabilityChildren = [
    ...rowMarkup([310], 310),
    ...rowMarkup([367, 368, 369], 370),
    ...rowMarkup([380, 386, 387, 388, 389, 391, 392], 390),
  ];
  const longTermLiabilityChildren = [
    ...rowMarkup([410], 410),
    ...rowMarkup([414, 415, 416, 417, 418, 419], 420),
    ...rowMarkup([427, 428, 429, 430, 440], 440),
  ];
  const equityChildren = [
    ...rowMarkup([610, 620, 651, 652, 655, 656, 660, 670, 680], 700),
  ];

  return `
    <div class="company-balance-layout">
      <div class="company-balance-column">
        <div class="company-statement-block-title">Assets</div>
        ${balanceGroupMarkup("Current assets", balanceSheet.b_100, currentAssetsChildren)}
        ${balanceGroupMarkup("Non-current assets", balanceSheet.b_200, nonCurrentAssetsChildren)}
        ${balanceGroupMarkup("Total assets", balanceSheet.b_300, [])}
      </div>
      <div class="company-balance-column">
        <div class="company-statement-block-title">Liabilities and equity</div>
        ${balanceGroupMarkup("Short-term liabilities", balanceSheet.b_400, shortTermLiabilityChildren)}
        ${balanceGroupMarkup("Long-term liabilities", balanceSheet.b_500, longTermLiabilityChildren)}
        ${balanceGroupMarkup("Liabilities and equity", balanceSheet.b_800, equityChildren)}
      </div>
    </div>
  `;
}

function financialSectionMarkup({ eyebrow = "Financial", title, description, content }) {
  const hasFloatingRail = String(content || "").includes("company-paged-list-controls");
  return `
    <section class="company-subsection-grid">
      <div class="company-subsection-copy">
        <p class="company-section-eyebrow">${escapeHtml(eyebrow)}</p>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(description)}</p>
      </div>
      <article class="company-section-card${hasFloatingRail ? " company-section-card-has-rail" : ""}">
        ${content}
      </article>
    </section>
  `;
}

function financialPeriodSelectorMarkup(periods, activePeriod, hasEmtaData) {
  const buttons = periods
    .map(
      (year, index) => `
        <button
          class="company-toggle-button${activePeriod === String(year) ? " is-active" : ""}"
          type="button"
          data-financial-period-toggle="${escapeHtml(String(year))}"
          role="tab"
          aria-selected="${activePeriod === String(year) ? "true" : "false"}"
        >
          ${escapeHtml(String(year))}
        </button>
      `
    )
    .join("");

  const emtaButton = hasEmtaData
    ? `
      <button
        class="company-toggle-button${activePeriod === "emta" ? " is-active" : ""}"
        type="button"
        data-financial-period-toggle="emta"
        role="tab"
        aria-selected="${activePeriod === "emta" ? "true" : "false"}"
      >
        EMTA
      </button>
    `
    : "";

  if (!buttons && !emtaButton) return "";

  return `
    <div class="company-financial-period-nav" role="tablist" aria-label="Financial period selection">
      ${buttons}
      ${emtaButton}
    </div>
  `;
}

function buildFinancialYearSectionsMarkup(message, legends, year) {
  const snapshot = buildFinancialSnapshotForYear(message, year);
  const incomeStatement = safeArray(message?.income_statements).find((item) => numberOrNull(item?.year) === year);
  const statementOfRevenuesAndExpenses = safeArray(message?.statement_of_revenues_and_expenses).find((item) => numberOrNull(item?.year) === year);
  const balanceSheet = safeArray(message?.balance_sheets).find((item) => numberOrNull(item?.year) === year);
  const cashFlow = safeArray(message?.cash_flows).find((item) => numberOrNull(item?.year) === year);
  const revenueByEmtak = safeArray(message?.revenue_by_emtak).find((item) => numberOrNull(item?.year) === year);
  const emtakDescriptions = buildEmtakDescriptionIndex(legends?.emtaks, legends?.emtaks_old || legends?.emtaksOld);
  const currentAssets = numberOrNull(balanceSheet?.b_100);
  const totalAssets = numberOrNull(balanceSheet?.b_300);
  const shortTermLiabilities = numberOrNull(balanceSheet?.b_400);
  const longTermLiabilities = numberOrNull(balanceSheet?.b_500);
  const currentRatio = currentAssets !== null && shortTermLiabilities ? currentAssets / shortTermLiabilities : null;
  const debtToAssets = totalAssets ? (((shortTermLiabilities || 0) + (longTermLiabilities || 0)) / totalAssets) * 100 : null;
  const workingCapital = currentAssets !== null && shortTermLiabilities !== null ? currentAssets - shortTermLiabilities : null;

  return [
    financialSectionMarkup({
      title: "Income statement",
      description: `Revenue and profit signals for ${year}.`,
      content: incomeStatement
        ? incomeStatementMarkup(incomeStatement, legends)
        : statementOfRevenuesAndExpensesMarkup(statementOfRevenuesAndExpenses, legends),
    }),
    financialSectionMarkup({
      title: "Profitability",
      description: `Margin-based reading of the ${year} results.`,
      content: dataRowsMarkup(
        [
          {
            label: "Operating margin",
            value: snapshot?.revenue && snapshot?.operatingProfit !== null ? formatPercent((snapshot.operatingProfit / snapshot.revenue) * 100) : "No data",
          },
          {
            label: "Net margin",
            value: snapshot?.revenue && snapshot?.netProfit !== null ? formatPercent((snapshot.netProfit / snapshot.revenue) * 100) : "No data",
          },
          {
            label: "Pre-tax margin",
            value: snapshot?.revenue && snapshot?.profitBeforeTax !== null ? formatPercent((snapshot.profitBeforeTax / snapshot.revenue) * 100) : "No data",
          },
        ],
        "Not enough data to calculate profitability for this year."
      ),
    }),
    financialSectionMarkup({
      title: "Balance sheet",
      description: `Asset and liability position reported for ${year}.`,
      content: balanceSheetMarkup(balanceSheet, legends),
    }),
    financialSectionMarkup({
      title: "Financial health",
      description: `Liquidity and leverage metrics derived from the ${year} balance sheet.`,
      content: dataRowsMarkup(
        [
          { label: "Current ratio", value: formatRatio(currentRatio) },
          { label: "Debt to assets", value: formatPercent(debtToAssets) },
          { label: "Working capital", value: formatCompactCurrency(workingCapital) },
        ],
        "No financial health metrics are available for this year."
      ),
    }),
    financialSectionMarkup({
      title: "Cash flow",
      description: `Reported cash movement rows for ${year}.`,
      content: cashFlowMarkup(cashFlow, legends),
    }),
    financialSectionMarkup({
      title: "Revenue by activity",
      description: `Revenue split across reported activity codes in ${year}.`,
      content: dataRowsMarkup(
        safeArray(revenueByEmtak?.data)
          .slice()
          .sort((left, right) => (numberOrNull(right?.revenue_amount) || 0) - (numberOrNull(left?.revenue_amount) || 0))
          .slice(0, 8)
          .map((entry) => {
            const emtakCode = normalizeEmtakCode(
              pickRecordValue(entry, ["emtak_code", "emtakCode", "activity_code", "activityCode", "Code", "code", "emtak"])
            );
            const activityDescription = pickRecordValue(entry, ["activity_description", "activityDescription"]);
            const resolvedDescription = findEmtakDescription(emtakCode, emtakDescriptions) || activityDescription;
            return {
              label: resolvedDescription || emtakCode || "Activity",
              value: formatCompactCurrency(entry?.revenue_amount),
              meta: resolvedDescription && emtakCode ? emtakCode : null,
            };
          }),
        "No revenue-by-activity data is available for this year."
      ),
    }),
  ].join("");
}

function buildFinancialEmtaSectionsMarkup(stats) {
  return [
    financialSectionMarkup({
      eyebrow: "EMTA",
      title: "Turnover",
      description: "Quarter-based EMTA turnover history.",
      content: historyChartMarkup("emta-turnover", "Turnover", stats?.turnover_history, formatCompactCurrency),
    }),
    financialSectionMarkup({
      eyebrow: "EMTA",
      title: "Labour taxes",
      description: "Quarter-based labour tax history from EMTA statistics.",
      content: historyChartMarkup("emta-labour-taxes", "Labour taxes", stats?.labour_taxes_history, formatCompactCurrency),
    }),
    financialSectionMarkup({
      eyebrow: "EMTA",
      title: "National taxes",
      description: "Quarter-based national tax history from EMTA statistics.",
      content: historyChartMarkup("emta-national-taxes", "National taxes", stats?.national_taxes_history, formatCompactCurrency),
    }),
  ].join("");
}

function dataRowsMarkup(rows, emptyLabel) {
  const list = safeArray(rows).filter((row) => textOrNull(row?.label) && textOrNull(row?.value));
  if (!list.length) {
    return `<p class="company-empty-copy">${escapeHtml(emptyLabel)}</p>`;
  }

  return `
    <div class="company-data-list">
      ${list
        .map(
          (row) => `
            <div class="company-data-row">
              <div class="company-data-row-copy">
                <span>${escapeHtml(row.label)}</span>
                ${textOrNull(row.meta) ? `<p>${escapeHtml(row.meta)}</p>` : ""}
              </div>
              <strong>${escapeHtml(row.value)}</strong>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function pagedDataRowsMarkup(items, mapRow, emptyLabel, pagerId) {
  const list = safeArray(items);
  if (!list.length) {
    return `<p class="company-empty-copy">${escapeHtml(emptyLabel)}</p>`;
  }

  const pages = [];
  for (let index = 0; index < list.length; index += 5) {
    pages.push(list.slice(index, index + 5));
  }

  return `
    <div class="company-paged-list" data-paged-list="${escapeHtml(pagerId)}" data-page-index="0">
      <div class="company-floating-rail company-paged-list-controls">
        <button class="company-page-button" type="button" data-page-prev="${escapeHtml(pagerId)}" aria-label="Previous page"><span aria-hidden="true">${chevronIcon("left")}</span></button>
        <span class="company-paged-list-status" data-page-status>${escapeHtml(`1 / ${pages.length}`)}</span>
        <button class="company-page-button" type="button" data-page-next="${escapeHtml(pagerId)}" aria-label="Next page"><span aria-hidden="true">${chevronIcon("right")}</span></button>
      </div>
      ${pages
        .map(
          (page, pageIndex) => `
            <div class="company-paged-list-panel${pageIndex === 0 ? " is-active" : ""}" data-page-panel="${escapeHtml(pagerId)}" data-page-panel-index="${pageIndex}">
              ${dataRowsMarkup(page.map(mapRow), emptyLabel)}
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function pagedMarkup(items, renderPage, emptyLabel, pagerId) {
  const list = safeArray(items);
  if (!list.length) {
    return `<p class="company-empty-copy">${escapeHtml(emptyLabel)}</p>`;
  }

  const pages = [];
  for (let index = 0; index < list.length; index += 5) {
    pages.push(list.slice(index, index + 5));
  }

  return `
    <div class="company-paged-list" data-paged-list="${escapeHtml(pagerId)}" data-page-index="0">
      <div class="company-floating-rail company-paged-list-controls">
        <button class="company-page-button" type="button" data-page-prev="${escapeHtml(pagerId)}" aria-label="Previous page"><span aria-hidden="true">${chevronIcon("left")}</span></button>
        <span class="company-paged-list-status" data-page-status>${escapeHtml(`1 / ${pages.length}`)}</span>
        <button class="company-page-button" type="button" data-page-next="${escapeHtml(pagerId)}" aria-label="Next page"><span aria-hidden="true">${chevronIcon("right")}</span></button>
      </div>
      ${pages
        .map(
          (page, pageIndex) => `
            <div class="company-paged-list-panel${pageIndex === 0 ? " is-active" : ""}" data-page-panel="${escapeHtml(pagerId)}" data-page-panel-index="${pageIndex}">
              ${renderPage(page, pageIndex)}
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function industryStandingMarkup(industryStats, fallbackRanks) {
  const topCompanies = safeArray(industryStats?.top10);
  const currentRank = numberOrNull(industryStats?.company_rank);

  if (topCompanies.length) {
    return pagedMarkup(
      topCompanies,
      (page, pageIndex) => `
        <div class="company-leaderboard-list">
          ${page
            .map((entry, index) => {
              const absoluteRank = pageIndex * 5 + index + 1;
              const turnoverValue =
                numberOrNull(entry?.turnover_last_4_quarters) ??
                numberOrNull(entry?.turnover) ??
                numberOrNull(entry?.revenue) ??
                numberOrNull(entry?.value);
              return `
                <div class="company-leaderboard-row">
                  <span class="company-leaderboard-rank">${escapeHtml(String(absoluteRank).padStart(2, "0"))}</span>
                  <span class="company-leaderboard-name">${escapeHtml(textOrNull(entry?.name) || `Industry company ${absoluteRank}`)}</span>
                  <strong class="company-leaderboard-value">${escapeHtml(formatCompactCurrency(turnoverValue))}</strong>
                </div>
              `;
            })
            .join("")}
        </div>
      `,
      "No industry standings are available yet.",
      "industry-leaders"
    );
  }

  return dataRowsMarkup(
    [
      currentRank ? { label: "Industry rank", value: `#${formatInteger(currentRank)}` } : null,
      numberOrNull(fallbackRanks?.turnover_national_rank)
        ? { label: "Turnover rank", value: `#${formatInteger(fallbackRanks.turnover_national_rank)}` }
        : null,
      numberOrNull(fallbackRanks?.employees_national_rank)
        ? { label: "Employees rank", value: `#${formatInteger(fallbackRanks.employees_national_rank)}` }
        : null,
      numberOrNull(fallbackRanks?.average_salary_national_rank)
        ? { label: "Salary rank", value: `#${formatInteger(fallbackRanks.average_salary_national_rank)}` }
        : null,
    ].filter(Boolean),
    "No industry standings are available yet."
  );
}

function legalSuccessionMarkup(items) {
  const list = safeArray(items);
  if (!list.length) {
    return '<p class="company-empty-copy">No legal succession records are available for this company.</p>';
  }

  const dateTitle = (entry) => {
    const startDate =
      textOrNull(entry?.algus_kpv) ||
      textOrNull(entry?.start_date) ||
      textOrNull(entry?.startDate);
    const endDate =
      textOrNull(entry?.lopp_kpv) ||
      textOrNull(entry?.end_date) ||
      textOrNull(entry?.endDate);
    if (startDate && endDate) return `${startDate} - ${endDate}`;
    return startDate || endDate || null;
  };

  const rows = list
    .slice(0, 6)
    .map((entry, index) => ({
      title: dateTitle(entry),
      content:
        textOrNull(entry?.sisu) ||
        textOrNull(entry?.content) ||
        textOrNull(entry?.tyyp_tekstina) ||
        textOrNull(entry?.relation) ||
        textOrNull(entry?.succession_type) ||
        textOrNull(entry?.type_text) ||
        textOrNull(entry?.type) ||
        textOrNull(entry?.successor_name) ||
        textOrNull(entry?.predecessor_name) ||
        textOrNull(entry?.name) ||
        `Succession ${index + 1}`,
    }))
    .filter((row) => row.title || row.content);

  if (!rows.length) {
    return '<p class="company-empty-copy">No legal succession records are available for this company.</p>';
  }

  return `
    <div class="company-data-list company-succession-list">
      ${rows
        .map(
          (row) => `
            <div class="company-succession-row">
              ${row.title ? `<strong>${escapeHtml(row.title)}</strong>` : ""}
              ${row.content ? `<p>${escapeHtml(row.content)}</p>` : ""}
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function activityCodesMarkup(company, legends) {
  const emtakDescriptions = legends?.emtak_descriptions || buildEmtakDescriptionIndex(legends?.emtaks, legends?.emtaks_old || legends?.emtaksOld);
  const entries = [
    ...safeArray(company?.activities),
    company?.primary_emtak,
    company?.primary_emtak4,
  ]
    .filter(Boolean)
    .map((item) => {
      const code = normalizeEmtakCode(
        pickRecordValue(item, ["emtak_code", "emtakCode", "code", "Code", "emtak"])
      );
      const description =
        findEmtakDescriptionInTree(code, legends?.emtaks) ||
        findEmtakDescriptionInTree(code, legends?.emtaks_old || legends?.emtaksOld) ||
        findEmtakDescription(code, emtakDescriptions) ||
        pickRecordValue(item, ["emtak_text", "name", "activity_description", "activity", "description"]);
      const isPrimary = Boolean(item?.is_primary);
      return { code, description, isPrimary };
    })
    .filter((item) => item.code || item.description);

  const unique = [];
  const seen = new Set();
  entries.forEach((item) => {
    const key = item.code || item.description;
    if (!key || seen.has(key)) return;
    seen.add(key);
    unique.push(item);
  });

  return `
    <div class="company-tag-grid company-tag-grid-single-column">
      ${unique
        .slice(0, 8)
        .map(
          (item) => `
            <article class="company-tag-card">
              <p class="company-tag-title">${escapeHtml(item.description || `EMTAK ${item.code || ""}`.trim())}</p>
              ${item.code ? `<p class="company-tag-meta">${escapeHtml(item.code)}${item.isPrimary ? " • Primary" : ""}</p>` : ""}
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

async function ensureCompanyLegends(payload) {
  const emtaks = safeArray(payload?.legends?.emtaks);
  if (emtaks.length && payload?.legends?.emtak_descriptions) return payload;

  const mergeLegendPayload = (legendPayload) => {
    const mergedLegends = {
      ...(payload?.legends || {}),
      ...(legendPayload?.message || legendPayload || {}),
    };
    if (!mergedLegends.emtak_descriptions) {
      mergedLegends.emtak_descriptions = buildEmtakDescriptionIndex(mergedLegends.emtaks, mergedLegends.emtaks_old || mergedLegends.emtaksOld);
    }
    return {
      ...payload,
      legends: mergedLegends,
    };
  };

  try {
    const response = await fetch("/api/legends", {
      headers: { Accept: "application/json" },
    });
    if (response.ok) {
      return mergeLegendPayload(await response.json());
    }
  } catch {
  }

  try {
    const response = await fetch("https://leadlistscraper-524b3d937ddd.herokuapp.com/api/legends", {
      headers: { Accept: "application/json" },
    });
    if (response.ok) {
      return mergeLegendPayload(await response.json());
    }
  } catch {}

  return payload;
}

function shareholdingsMarkup(items, emptyLabel) {
  const list = safeArray(items);
  if (!list.length) {
    return `<p class="company-empty-copy">${escapeHtml(emptyLabel)}</p>`;
  }
  return shareholderListMarkup(list);
}

function locationMarkup(company) {
  const newestAddress = company?.newest_address || {};
  const fullAddress = textOrNull(newestAddress.address_long) || textOrNull(newestAddress.address);
  const coordinates = normalizeCoordinates(newestAddress.coordinates);
  const mapsHref = appleMapsHrefForLocation({
    coordinates,
    address: fullAddress,
    label: textOrNull(company?.name) || "Company location",
  });
  const fields = [
    ["Address", textOrNull(newestAddress.address)],
    ["County", textOrNull(newestAddress.county)],
    ["City / municipality", textOrNull(newestAddress["city/municipality"]) || textOrNull(newestAddress.city) || textOrNull(newestAddress.municipality)],
    ["Neighbourhood", textOrNull(newestAddress.neighborhood)],
    ["Postal code", textOrNull(newestAddress.postal_code)],
    ["Country", textOrNull(newestAddress.country)],
  ].filter(([, value]) => value);

  return `
    <div class="company-location-stack">
      <div class="company-map-embed-shell company-location-map">
        ${
          coordinates && APPLE_MAPS_TOKEN
            ? `
              <div
                class="company-map-canvas"
                data-company-apple-map
                data-company-map-lat="${escapeHtml(String(coordinates.latitude))}"
                data-company-map-lng="${escapeHtml(String(coordinates.longitude))}"
                data-company-map-title="${escapeHtml(textOrNull(company?.name) || "Company location")}"
                data-company-map-subtitle="${escapeHtml(fullAddress || "")}"
              ></div>
            `
            : `<div class="company-map-orb"><span></span><span></span><span></span></div>`
        }
      </div>
      ${
        fields.length || mapsHref
          ? `
            ${fields.length
              ? `
                <div class="company-info-grid company-location-grid">
                  ${fields
                    .map(
                      ([label, value]) => `
                        <div class="company-info-item">
                          <p class="company-info-label">${escapeHtml(label)}</p>
                          <p class="company-info-value">${escapeHtml(value)}</p>
                        </div>
                      `
                    )
                    .join("")}
                </div>
              `
              : ""}
            ${mapsHref ? `<a class="company-location-link" href="${escapeHtml(mapsHref)}" target="_blank" rel="noreferrer">Open in Maps</a>` : ""}
          `
          : '<p class="company-empty-copy">No location details are available for this company.</p>'
      }
    </div>
  `;
}

function economicActivitiesMarkup(items) {
  return pagedDataRowsMarkup(
    items,
    (entry, index) => ({
      label:
        pickRecordValue(entry, ["category_en", "categoryEn", "category", "name"]) ||
        `Economic activity ${index + 1}`,
      value: entry?.is_active === false || entry?.isValid === false ? "Inactive" : "Active",
      meta: [
        pickRecordValue(entry, ["number"]),
        pickRecordValue(entry, ["valid_from", "validFrom"]),
        pickRecordValue(entry, ["valid_until", "validUntil"]),
        pickRecordValue(entry, ["extra_info_en", "extraInfoEn", "extra_info", "extraInfo"]),
      ].filter(Boolean).join(" • "),
    }),
    "No economic activities are available for this company.",
    "economic-activities"
  );
}

function operatingLicencesMarkup(items) {
  return pagedDataRowsMarkup(
    items,
    (entry, index) => ({
      label:
        pickRecordValue(entry, ["category_en", "categoryEn", "category", "name"]) ||
        `Operating licence ${index + 1}`,
      value: entry?.is_valid === false || entry?.isValid === false ? "Inactive" : "Active",
      meta: [
        pickRecordValue(entry, ["number"]),
        pickRecordValue(entry, ["valid_from", "validFrom"]),
        pickRecordValue(entry, ["valid_until", "validUntil"]),
        pickRecordValue(entry, ["extra_info_en", "extraInfoEn", "extra_info", "extraInfo"]),
      ].filter(Boolean).join(" • "),
    }),
    "No operating licences are available for this company.",
    "operating-licences"
  );
}

function overviewSectionMarkup({ title, description, content }) {
  return financialSectionMarkup({
    eyebrow: "Overview",
    title,
    description,
    content,
  });
}

function buildOverviewSectionsMarkup({ message, company, stats, legends, legalSuccessions }) {
  return [
    overviewSectionMarkup({
      title: "Activity codes",
      description: "Registered EMTAK codes and primary industry focus.",
      content: activityCodesMarkup(company, legends),
    }),
    overviewSectionMarkup({
      title: "Employees",
      description: "Reported employee history and latest workforce scale.",
      content: historyChartMarkup("employees", "Employees", stats?.employees_count_history, formatInteger),
    }),
    overviewSectionMarkup({
      title: "Average salary",
      description: "Reported salary history and latest pay level.",
      content: historyChartMarkup("average-salary", "Average salary", stats?.average_salary_history, formatCurrency),
    }),
    overviewSectionMarkup({
      title: "Shareholders",
      description: "Ownership records currently associated with the company.",
      content: shareholderListMarkup(message.shareholders),
    }),
    overviewSectionMarkup({
      title: "Shares in companies",
      description: "Equity positions this company holds in other entities.",
      content: shareholdingsMarkup(message.shares_in_companies, "No shareholdings in other companies are available."),
    }),
    overviewSectionMarkup({
      title: "Economic activities",
      description: "Declared activity records and their current validity.",
      content: economicActivitiesMarkup(message.economic_activities),
    }),
    overviewSectionMarkup({
      title: "Operating licences",
      description: "Licences and permits associated with the company.",
      content: operatingLicencesMarkup(message.operating_licences),
    }),
    overviewSectionMarkup({
      title: "Industry leaders",
      description: "Comparable market leaders and rank context.",
      content: industryStandingMarkup(message.industry_stats, stats),
    }),
    overviewSectionMarkup({
      title: "Legal succession",
      description: "Registered predecessor and successor relationships.",
      content: legalSuccessionMarkup(legalSuccessions),
    }),
  ].join("");
}

function buildLocationSectionMarkup(company) {
  return financialSectionMarkup({
    eyebrow: "Location",
    title: "Registered address",
    description: "Registered address map and structured location details.",
    content: locationMarkup(company),
  });
}

function buildPage(payload, slug) {
  const company = payload?.message?.general_data;
  if (!company) {
    throw new Error("Company payload is missing general data.");
  }

  const message = payload.message;
  const legends = payload.legends || {};
  const status = statusMeta(company.status);
  const contacts = safeArray(company.contacts);
  const email = firstContact(contacts, ["EMAIL"]);
  const phone = firstContact(contacts, ["MOB", "PHONE", "TEL"]);
  const website = firstContact(contacts, ["WWW", "WEB", "URL", "WEBSITE"]);
  const registryCode = textOrNull(company.registry_code) || "Unknown";
  const businessRegisterUrl =
    registryCode !== "Unknown"
      ? `https://ariregister.rik.ee/eng/company/${encodeURIComponent(registryCode)}/`
      : null;
  const companyName = textOrNull(company.name) || "Unknown company";
  const stats = message.statistics || {};
  const primaryEmtak =
    textOrNull(company.primary_emtak?.emtak_text) ||
    textOrNull(company.primary_emtak?.name) ||
    textOrNull(company.primary_emtak4?.emtak_text) ||
    textOrNull(company.primary_emtak4?.name);
  const address = textOrNull(company.newest_address?.address_long) || textOrNull(company.newest_address?.address);
  const otherPeopleItems = [...safeArray(message.registry_cards), ...safeArray(message.non_registry_cards)].map((entry) => ({
    ...entry,
    full_name:
      textOrNull(entry?.full_name) ||
      [textOrNull(entry?.first_name), textOrNull(entry?.last_name)].filter(Boolean).join(" ") ||
      textOrNull(entry?.name) ||
      textOrNull(entry?.company_name) ||
      "Unknown",
    role_text:
      textOrNull(entry?.role_text) ||
      textOrNull(entry?.card_type) ||
      textOrNull(entry?.entity_type) ||
      "Other relationship",
  }));
  const peopleGroups = [
    {
      id: "representatives",
      label: "Representatives",
      items: safeArray(message.representatives),
      emptyLabel: "No representative records are available.",
      description: "Who can represent the company in official matters.",
    },
    {
      id: "beneficiaries",
      label: "Beneficiaries",
      items: safeArray(message.beneficiaries),
      emptyLabel: "No beneficiary records are available.",
      description: "Beneficial owners and controlling interest holders.",
    },
    {
      id: "council",
      label: "Council",
      items: safeArray(message.board_members),
      emptyLabel: "No board member records are available.",
      description: "Council or board-level oversight roles linked to the company.",
    },
    {
      id: "other",
      label: "Other",
      items: otherPeopleItems,
      emptyLabel: "No other personnel records are available.",
      description: "Additional registry and non-registry relationships.",
    },
  ];

  const historyMode = "annual";
  const annualReports = safeArray(message.annual_reports);
  const activeTab = "overview";
  const availableFinancialYears = financialPeriods(message);
  const activeFinancialPeriod = availableFinancialYears.length ? String(availableFinancialYears[0]) : message.statistics ? "emta" : "";
  const legalSuccessions = safeArray(company.legal_succession || company.legal_successions);
  const vatRegistered = message.tax_information ? (message.tax_information.vat_registered ? "Active" : "Inactive") : null;

  document.title = `ContactPit | ${companyName}`;

  return `
    <div class="company-view" data-company-view data-history-mode="${historyMode}" data-company-tab="${activeTab}" data-financial-period="${escapeHtml(activeFinancialPeriod)}">
      <section class="company-hero-shell">
        <div class="company-hero-card">
          <div class="company-floating-rail">
            <div class="company-floating-status company-floating-status-${escapeHtml(status.tone)}">${escapeHtml(status.label)}</div>
            ${floatingAction({
              label: "Email",
              href: email ? `mailto:${email.value}` : null,
              icon: "email",
            })}
            ${floatingAction({
              label: "Phone",
              href: phone ? `tel:${String(phone.value).replace(/\s+/g, "")}` : null,
              icon: "phone",
            })}
            ${floatingAction({
              label: "Website",
              href: normalizeUrl(website?.value || website?.label),
              icon: "website",
              external: true,
            })}
            ${floatingAction({
              label: "Ariregister",
              href: businessRegisterUrl,
              icon: "register",
              external: true,
            })}
            ${floatingStat({
              label: "Views",
              value: formatInteger(message.total_view_count ?? company.total_view_count ?? 0),
              icon: "eye",
            })}
            ${floatingStat({
              label: "Favorites",
              value: formatInteger(message.total_favorite_count ?? company.total_favorite_count ?? 0),
              icon: "heart",
            })}
          </div>
          <div class="company-hero-copy">
            <div class="company-title-row">
              <div class="company-title-mark">${escapeHtml(initials(companyName))}</div>
              <div>
                <h1 class="company-title">${escapeHtml(companyName)}</h1>
              </div>
            </div>
            <div class="company-hero-meta-layout">
              <div class="company-info-grid company-info-grid-hero">
                ${infoItem("Registry code", registryCode)}
                ${infoItem("Legal form", company.legal_form)}
                ${infoItem("Registered", company.registration_date)}
                ${infoItem("Invoice provider", message.invoice_provider)}
                ${infoItem("VAT number", message.tax_information?.vat_code)}
                ${infoItem("VAT registered", message.tax_information ? (message.tax_information.vat_registered ? "Active" : "Inactive") : null)}
              </div>
            </div>
          </div>

          <aside class="company-hero-map-side" aria-hidden="true"></aside>
        </div>

        ${stats.tax_debt && Number(stats.tax_debt) > 0 ? `
          <article class="company-tax-alert">
            <div>
              <p class="company-card-eyebrow">Tax debt</p>
              <h2>${escapeHtml(formatCurrency(stats.tax_debt))} currently outstanding</h2>
              <p>Presented separately so debt risk is immediately visible instead of being buried inside the KPI row.</p>
            </div>
            <div class="company-tax-alert-meta">
              ${stats.national_taxes ? `<span class="company-inline-meta">National taxes ${escapeHtml(formatCompactCurrency(stats.national_taxes))}</span>` : ""}
              ${stats.labour_taxes ? `<span class="company-inline-meta">Labour taxes ${escapeHtml(formatCompactCurrency(stats.labour_taxes))}</span>` : ""}
            </div>
          </article>
        ` : ""}

        <div class="company-kpi-grid">
          ${metricCard({
            label: "4-quarter turnover",
            value: formatCompactCurrency(stats.turnover_4_quarter_sum),
            note: stats.turnover_last_quarter ? `Last quarter ${formatCompactCurrency(stats.turnover_last_quarter)}` : "Latest reported turnover",
            accent: "is-featured",
          })}
          ${metricCard({
            label: "Employees",
            value: formatInteger(stats.employees_count),
            note: stats.employees_national_rank ? `National rank #${formatInteger(stats.employees_national_rank)}` : "Latest reported headcount",
          })}
          ${metricCard({
            label: "Average salary",
            value: formatCurrency(stats.average_salary),
            note: stats.average_salary_national_rank ? `National rank #${formatInteger(stats.average_salary_national_rank)}` : "Latest reported salary level",
          })}
        </div>
      </section>

      <nav class="company-jump-nav" aria-label="Company section navigation" role="tablist">
        <button class="is-active" type="button" data-company-tab-toggle="overview" role="tab" aria-selected="true">Overview</button>
        <button type="button" data-company-tab-toggle="financial" role="tab" aria-selected="false">Financial</button>
        <button type="button" data-company-tab-toggle="people" role="tab" aria-selected="false">People</button>
        <button type="button" data-company-tab-toggle="location" role="tab" aria-selected="false">Location</button>
      </nav>

      ${availableFinancialYears.length || message.statistics
        ? `
          <div class="company-financial-rail" data-company-financial-rail>
            ${financialPeriodSelectorMarkup(availableFinancialYears, activeFinancialPeriod, Boolean(message.statistics))}
          </div>
        `
        : ""}

      <section class="company-tab-panel company-overview-layout is-active" id="company-overview" data-company-tab-panel="overview">
        <div class="company-section-content">
          <div class="company-subsection-stack">
            ${buildOverviewSectionsMarkup({ message, company, stats, legends, legalSuccessions })}
          </div>
        </div>
      </section>

      <section class="company-tab-panel company-location-layout" id="company-location" data-company-tab-panel="location">
        <div class="company-section-content">
          <div class="company-subsection-stack">
            ${buildLocationSectionMarkup(company)}
          </div>
        </div>
      </section>

      <section class="company-tab-panel company-financial-layout" id="company-financial" data-company-tab-panel="financial">
        <div class="company-section-content company-financial-shell">
          <div class="company-subsection-stack">
            ${availableFinancialYears
              .map(
                (year) => `
                  <div class="company-financial-period-panel${activeFinancialPeriod === String(year) ? " is-active" : ""}" data-financial-period-panel="${escapeHtml(String(year))}">
                    <div class="company-subsection-stack">
                      ${buildFinancialYearSectionsMarkup(message, legends, year)}
                    </div>
                  </div>
                `
              )
              .join("")}
            ${message.statistics
              ? `
                <div class="company-financial-period-panel${activeFinancialPeriod === "emta" ? " is-active" : ""}" data-financial-period-panel="emta">
                  <div class="company-subsection-stack">
                    ${buildFinancialEmtaSectionsMarkup(stats)}
                  </div>
                </div>
              `
              : ""}
          </div>
        </div>
      </section>

      <section class="company-tab-panel company-people-layout" id="company-people" data-company-tab-panel="people">
        <div class="company-section-content">
          <div class="company-subsection-stack">
            ${peopleGroups
              .map(
                (group) => `
                  <section class="company-subsection-grid">
                    <div class="company-subsection-copy">
                      <p class="company-section-eyebrow">People</p>
                      <h3>${escapeHtml(group.label)}</h3>
                      <p>${escapeHtml(group.description)}</p>
                    </div>
                    <article class="company-section-card">
                      ${peopleListMarkup(group.items, group.emptyLabel)}
                    </article>
                  </section>
                `
              )
              .join("")}
          </div>
        </div>
      </section>
    </div>
  `;
}

function buildHistoryPanels(stats, mode) {
  const scope = mode === "quarterly" ? "Quarterly" : "Annual";
  return [
    miniBars("Turnover", metricHistorySeries(stats.turnover_history, mode), formatCompactCurrency, scope),
    miniBars("Employees", metricHistorySeries(stats.employees_count_history, mode), formatInteger, scope),
    miniBars("Average salary", metricHistorySeries(stats.average_salary_history, mode), formatCurrency, scope),
  ].join("");
}

function setupInteractions(payload) {
  const shell = document.querySelector("[data-company-view]");
  if (!shell) return;

  const stats = payload?.message?.statistics || {};
  const tabButtons = shell.querySelectorAll("[data-company-tab-toggle]");
  const tabPanels = shell.querySelectorAll("[data-company-tab-panel]");
  const financialRail = shell.querySelector("[data-company-financial-rail]");
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.getAttribute("data-company-tab-toggle");
      if (!tab) return;
      shell.setAttribute("data-company-tab", tab);
      tabButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", active ? "true" : "false");
      });
      tabPanels.forEach((panel) => {
        panel.classList.toggle("is-active", panel.getAttribute("data-company-tab-panel") === tab);
      });
      if (financialRail) {
        financialRail.classList.toggle("is-active", tab === "financial");
      }
      if (tab === "location") {
        void setupCompanyLocationMaps(shell);
      }
    });
  });
  if (financialRail) {
    financialRail.classList.toggle("is-active", shell.getAttribute("data-company-tab") === "financial");
  }
  if (shell.getAttribute("data-company-tab") === "location") {
    void setupCompanyLocationMaps(shell);
  }

  const financialPeriodButtons = shell.querySelectorAll("[data-financial-period-toggle]");
  const financialPeriodPanels = shell.querySelectorAll("[data-financial-period-panel]");
  financialPeriodButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const period = button.getAttribute("data-financial-period-toggle");
      if (!period) return;
      shell.setAttribute("data-financial-period", period);
      financialPeriodButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", active ? "true" : "false");
      });
      financialPeriodPanels.forEach((panel) => {
        panel.classList.toggle("is-active", panel.getAttribute("data-financial-period-panel") === period);
      });
    });
  });

  const historyPanels = shell.querySelector("[data-history-panels]");
  const historyButtons = shell.querySelectorAll("[data-history-toggle]");

  historyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.getAttribute("data-history-toggle");
      if (!mode || !historyPanels) return;
      shell.setAttribute("data-history-mode", mode);
      historyPanels.innerHTML = buildHistoryPanels(stats, mode);
      historyButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", active ? "true" : "false");
      });
    });
  });

  const chartButtons = shell.querySelectorAll("[data-chart-toggle]");
  chartButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const chartId = button.getAttribute("data-chart-toggle");
      const mode = button.getAttribute("data-chart-mode");
      if (!chartId || !mode) return;
      const chartShell = shell.querySelector(`[data-chart-shell="${chartId}"]`);
      if (!chartShell) return;
      chartShell.setAttribute("data-chart-mode", mode);
      chartShell.querySelectorAll(`[data-chart-toggle="${chartId}"]`).forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });
      chartShell.querySelectorAll(`[data-chart-panel="${chartId}"]`).forEach((panel) => {
        panel.classList.toggle("is-active", panel.getAttribute("data-chart-panel-mode") === mode);
      });
      chartShell.querySelectorAll(`[data-chart-summary-panel="${chartId}"]`).forEach((summary) => {
        summary.classList.toggle("is-active", summary.getAttribute("data-chart-summary-mode") === mode);
      });
      const scopeLabel = chartShell.querySelector("[data-chart-scope-label]");
      if (scopeLabel) scopeLabel.textContent = mode === "annual" ? "Annual" : "Quarterly";
    });
  });

  shell.querySelectorAll("[data-paged-list]").forEach((listNode) => {
    const listId = listNode.getAttribute("data-paged-list");
    if (!listId) return;
    const panels = Array.from(listNode.querySelectorAll(`[data-page-panel="${listId}"]`));
    const status = listNode.querySelector("[data-page-status]");
    const updatePage = (nextIndex) => {
      const boundedIndex = Math.max(0, Math.min(nextIndex, panels.length - 1));
      listNode.setAttribute("data-page-index", String(boundedIndex));
      panels.forEach((panel, panelIndex) => {
        panel.classList.toggle("is-active", panelIndex === boundedIndex);
      });
      if (status) status.textContent = `${boundedIndex + 1} / ${panels.length}`;
    };

    listNode.querySelector(`[data-page-prev="${listId}"]`)?.addEventListener("click", () => {
      updatePage(Number(listNode.getAttribute("data-page-index") || 0) - 1);
    });
    listNode.querySelector(`[data-page-next="${listId}"]`)?.addEventListener("click", () => {
      updatePage(Number(listNode.getAttribute("data-page-index") || 0) + 1);
    });
  });

  shell.querySelectorAll("[data-line-chart]").forEach((chartNode) => {
    const chartId = chartNode.getAttribute("data-line-chart") || "";
    const chartShell = chartNode.closest("[data-chart-shell]");
    const summaryNode = chartShell?.querySelector(`[data-line-summary="${chartId}"]`) || null;
    const valueNode = summaryNode?.querySelector("[data-line-summary-value]") || null;
    const periodNode = summaryNode?.querySelector("[data-line-summary-period]") || null;
    const guideNode = chartNode.querySelector("[data-line-guide]");
    const plotNode = chartNode.querySelector(".company-line-chart-plot");
    const defaultValue = chartNode.getAttribute("data-line-default-value") || "";
    const defaultPeriod = chartNode.getAttribute("data-line-default-period") || "";
    const points = Array.from(chartNode.querySelectorAll("[data-line-point]"));
    const setSummary = (value, period) => {
      if (valueNode) valueNode.textContent = value;
      if (periodNode) periodNode.textContent = period;
    };
    const setGuide = (point) => {
      if (!guideNode) return;
      if (!point) {
        guideNode.setAttribute("hidden", "");
        return;
      }
      const x = point.getAttribute("data-line-x");
      if (!x) return;
      guideNode.removeAttribute("hidden");
      guideNode.setAttribute("x1", x);
      guideNode.setAttribute("x2", x);
    };
    const activatePoint = (point) => {
      if (!point) return;
      setSummary(point.getAttribute("data-line-value") || defaultValue, point.getAttribute("data-line-period") || defaultPeriod);
      setGuide(point);
    };
    const resetPoint = () => {
      setSummary(defaultValue, defaultPeriod);
      setGuide(null);
    };
    const nearestPointForRatio = (ratio) => {
      let nearest = null;
      let distance = Infinity;
      points.forEach((point) => {
        const pointRatio = Number(point.getAttribute("data-line-ratio"));
        if (!Number.isFinite(pointRatio)) return;
        const delta = Math.abs(pointRatio - ratio);
        if (delta < distance) {
          distance = delta;
          nearest = point;
        }
      });
      return nearest;
    };

    points.forEach((point) => {
      point.addEventListener("mouseenter", () => {
        activatePoint(point);
      });
      point.addEventListener("focus", () => {
        activatePoint(point);
      });
      point.addEventListener("mouseleave", () => {
        resetPoint();
      });
      point.addEventListener("blur", () => {
        resetPoint();
      });
    });

    plotNode?.addEventListener("mousemove", (event) => {
      const rect = plotNode.getBoundingClientRect();
      if (!rect.width) return;
      const offsetX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
      const ratio = offsetX / rect.width;
      activatePoint(nearestPointForRatio(ratio));
    });
    plotNode?.addEventListener("mouseleave", () => {
      resetPoint();
    });
  });
}

async function setupCompanyLocationMaps(scope = document) {
  const containers = Array.from(scope.querySelectorAll("[data-company-apple-map]")).filter(
    (container) => !container.hasAttribute("data-company-apple-map-initialized")
  );
  if (!containers.length) return;

  try {
    await loadAppleMapKit();
  } catch {
    containers.forEach((container) => {
      renderCompanyLocationFallback(container);
      container.setAttribute("data-company-apple-map-initialized", "true");
    });
    return;
  }

  containers.forEach((container) => {
    try {
      renderCompanyLocationMap(container);
    } catch {
      renderCompanyLocationFallback(container);
    }
    container.setAttribute("data-company-apple-map-initialized", "true");
  });
}

async function loadCompany() {
  const slug = currentSlug();
  if (!slug) {
    renderState('<p class="detail-state">Missing company slug.</p>');
    return;
  }

  try {
    const response = await fetch(`/api/company?slug=${encodeURIComponent(slug)}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(response.status === 404 ? "Company not found." : `Failed to load company (${response.status}).`);
    }

    const rawPayload = await response.json();
    const payload = await ensureCompanyLegends(rawPayload);
    renderState(buildPage(payload, slug));
    setupInteractions(payload);
  } catch (error) {
    renderState(`<p class="detail-state">${escapeHtml(error instanceof Error ? error.message : "Failed to load company.")}</p>`);
  }
}

void loadCompany();
