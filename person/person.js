const EMAIL_ICON_URL = new URL("../assets/ios/email.svg", import.meta.url).href;
const PHONE_ICON_URL = new URL("../assets/ios/phone.svg", import.meta.url).href;
const REGISTER_ICON_URL = new URL("../assets/ios/rik.png", import.meta.url).href;
const APPLE_MAPS_TOKEN = import.meta.env.VITE_APPLE_MAPS_TOKEN || "";
const MAP_MARKER_COLOR = "#9422db";

let appleMapKitPromise = null;

function chevronIcon(direction = "right") {
  const rotation = direction === "left" ? 180 : 0;
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${rotation}deg);">
      <path d="M8 5l8 7-8 7"></path>
    </svg>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function currentSlug() {
  const segments = window.location.pathname.split("/").filter(Boolean);
  if (segments[0] !== "person" || !segments[1]) {
    return "";
  }
  return decodeURIComponent(segments[1]);
}

function renderState(markup) {
  const root = document.getElementById("person-detail-root");
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

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatInteger(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "No data";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatDecimal(value, maximumFractionDigits = 1) {
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

function formatDate(value) {
  const text = textOrNull(value);
  if (!text) return "No data";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
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

function legalStatusMeta(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "C") {
    return { label: "Citizen", tone: "positive" };
  }
  if (normalized === "E") {
    return { label: "E-resident", tone: "neutral" };
  }
  if (normalized === "F") {
    return { label: "Foreigner", tone: "warning" };
  }
  return { label: "Unknown", tone: "neutral" };
}

function toneBadge(label, tone) {
  return `<span class="company-status-badge is-${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
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

function metricCard({ label, value, note, accent = "" }) {
  return `
    <article class="company-kpi-card${accent ? ` ${accent}` : ""}">
      <p class="company-kpi-label">${escapeHtml(label)}</p>
      <p class="company-kpi-value">${escapeHtml(value)}</p>
      <p class="company-kpi-note">${escapeHtml(note)}</p>
    </article>
  `;
}

function firstContact(contacts, types) {
  const typeSet = new Set(types.map((type) => String(type).toUpperCase()));
  return safeArray(contacts).find((item) => typeSet.has(String(item?.type || "").toUpperCase()) && textOrNull(item?.value));
}

function contactTypeMeta(type) {
  const normalized = String(type || "").trim().toUpperCase();
  if (normalized === "EMAIL") return { label: "Email", icon: "email" };
  if (["PHONE", "MOBILE", "MOB", "CELL", "CELLPHONE", "MOBILE_PHONE"].includes(normalized)) {
    return { label: "Phone", icon: "phone" };
  }
  return { label: normalized || "Contact", icon: "website" };
}

function iconSvg(name) {
  const icons = {
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
    register: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 3.75A2.25 2.25 0 0 0 2.75 6v12A2.25 2.25 0 0 0 5 20.25h14A2.25 2.25 0 0 0 21.25 18V9.31a2.25 2.25 0 0 0-.66-1.59L17.53 4.66A2.25 2.25 0 0 0 15.94 4H5Zm10.25 1.9 4.1 4.1h-2.6A1.5 1.5 0 0 1 15.25 8.25v-2.6ZM7.5 11h9a.75.75 0 0 1 0 1.5h-9a.75.75 0 0 1 0-1.5Zm0 3.5h9a.75.75 0 0 1 0 1.5h-9a.75.75 0 0 1 0-1.5Z" fill="currentColor"/>
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

function compactFloatingAction({ label, value, href, icon, external = false }) {
  if (!textOrNull(href)) return "";
  const iconMarkup =
    icon === "email"
      ? `<img src="${escapeHtml(EMAIL_ICON_URL)}" alt="" />`
      : icon === "phone"
        ? `<img src="${escapeHtml(PHONE_ICON_URL)}" alt="" />`
        : icon === "register"
          ? `<img src="${escapeHtml(REGISTER_ICON_URL)}" alt="" />`
          : `<span class="company-floating-action-icon" aria-hidden="true">${iconSvg(icon)}</span>`;
  return `
    <a
      class="company-floating-action person-floating-action person-floating-action-${escapeHtml(icon)}"
      href="${escapeHtml(href)}"
      aria-label="${escapeHtml(label)}"
      title="${escapeHtml(label)}"
      ${external ? 'target="_blank" rel="noreferrer"' : ""}
    >
      <span class="company-floating-action-icon company-floating-action-icon-${escapeHtml(icon)}" aria-hidden="true">${iconMarkup}</span>
    </a>
  `;
}

function escapeAttributeJson(value) {
  return escapeHtml(JSON.stringify(value));
}

function floatingStat({ label, value, icon }) {
  if (!textOrNull(value)) return "";
  return `
    <span class="person-floating-stat" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
      <span class="person-floating-stat-icon" aria-hidden="true">${iconSvg(icon)}</span>
      <span>${escapeHtml(value)}</span>
    </span>
  `;
}

function normalizeUrl(value) {
  const raw = textOrNull(value);
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function contactActionsMarkup(contacts) {
  const markup = safeArray(contacts)
    .map((contact) => {
      const value = textOrNull(contact?.value);
      if (!value) return "";
      const meta = contactTypeMeta(contact?.type);
      if (meta.icon === "email") {
        return contactAction({
          label: meta.label,
          value,
          href: `mailto:${value}`,
          icon: meta.icon,
        });
      }
      if (meta.icon === "phone") {
        return contactAction({
          label: meta.label,
          value,
          href: `tel:${value.replace(/\s+/g, "")}`,
          icon: meta.icon,
        });
      }
      return contactAction({
        label: meta.label,
        value,
        href: normalizeUrl(value),
        icon: meta.icon,
        external: true,
      });
    })
    .filter(Boolean)
    .join("");

  return markup || '<p class="company-empty-copy">No direct contact channels are available for this person.</p>';
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

function companyLinkHref(company) {
  const slug = companySlug(company?.name, company?.registry_code);
  return slug ? `/company/${encodeURIComponent(slug)}` : null;
}

function roleText(role) {
  return textOrNull(role?.name) || textOrNull(role?.type) || "Role";
}

function roleDateText(role) {
  const date = textOrNull(role?.start_date);
  return date ? `Since ${date}` : null;
}

function companyCardMarkup(company) {
  const roles = safeArray(company?.roles);
  const href = companyLinkHref(company);
  const roleItems = roles
    .map(
      (role) => `
        <li class="company-data-row-copy">
          <span class="person-role-name">${escapeHtml(roleText(role))}</span>
          ${roleDateText(role) ? `<p class="person-role-date">${escapeHtml(roleDateText(role))}</p>` : ""}
        </li>
      `
    )
    .join("");
  const companyName = textOrNull(company?.name) || "Unknown company";
  const registryCode = textOrNull(company?.registry_code);
  const headerContent = `
    <div class="company-person-avatar">${escapeHtml(initials(companyName))}</div>
    <div class="company-person-copy person-company-copy">
      <h3>${escapeHtml(companyName)}</h3>
      ${registryCode ? `<p>${escapeHtml(registryCode)}</p>` : ""}
    </div>
    ${href ? '<span class="company-person-chevron" aria-hidden="true">›</span>' : ""}
  `;

  return `
    <article class="person-company-card">
      ${
        href
          ? `<a class="person-company-card-head person-company-card-head-link" href="${escapeHtml(href)}" aria-label="Open ${escapeHtml(companyName)} company view">${headerContent}</a>`
          : `<div class="person-company-card-head">${headerContent}</div>`
      }
      ${
        roleItems
          ? `<ul class="person-role-list">${roleItems}</ul>`
          : '<p class="company-empty-copy">No role records are available for this company.</p>'
      }
    </article>
  `;
}

function certificateCard(title, items, titleGetter) {
  const list = safeArray(items);
  return `
    <article class="company-section-card">
      ${
        list.length
          ? `
            <div class="company-data-list">
              ${list
                .map((item) => {
                  const start = textOrNull(item?.valid_from) || textOrNull(item?.validFrom);
                  const end = textOrNull(item?.valid_until) || textOrNull(item?.validUntil);
                  return `
                    <div class="company-data-row">
                      <div class="company-data-row-copy">
                        <span>${escapeHtml(titleGetter(item))}</span>
                        <p>${escapeHtml([start || "Unknown start", end || "No expiry"].join(" • "))}</p>
                      </div>
                    </div>
                  `;
                })
                .join("")}
            </div>
          `
          : '<p class="company-empty-copy">No records are available.</p>'
      }
    </article>
  `;
}

function normalizeCoordinates(coordinates) {
  const latitude = numberOrNull(coordinates?.latitude ?? coordinates?.lat);
  const longitude = numberOrNull(coordinates?.longitude ?? coordinates?.lng ?? coordinates?.lon);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

function uniqueCompanyLocations(person) {
  const companyNameByRegistry = new Map(
    safeArray(person?.companies).map((company) => [String(company?.registry_code || ""), textOrNull(company?.name)])
  );
  const seen = new Set();

  return safeArray(person?.companies_data)
    .map((companyData, index) => {
      const registryCode = textOrNull(companyData?.registry_code);
      const companyName =
        companyNameByRegistry.get(String(companyData?.registry_code || "")) ||
        textOrNull(companyData?.name) ||
        (registryCode ? `Company ${registryCode}` : `Company ${index + 1}`);
      const address = companyData?.address || {};
      const addressText = textOrNull(address?.address_long) || textOrNull(address?.address);
      const coordinates = normalizeCoordinates(address?.coordinates || companyData?.coordinates);
      const key = [
        registryCode || companyName,
        addressText || "",
        coordinates ? `${coordinates.latitude.toFixed(6)},${coordinates.longitude.toFixed(6)}` : "",
      ].join("|");

      if (seen.has(key)) return null;
      seen.add(key);

      return {
        companyName,
        registryCode,
        address,
        addressText,
        coordinates,
      };
    })
    .filter((location) => location && (location.addressText || location.coordinates));
}

function googleMapsEmbedUrlForLocations(locations) {
  const points = safeArray(locations).filter((location) => location?.coordinates);
  if (!points.length) return null;
  const coordinates = points[0].coordinates;
  return `https://www.google.com/maps?q=${encodeURIComponent(`${coordinates.latitude},${coordinates.longitude}`)}&z=15&output=embed`;
}

function appleMapsHrefForLocation(location) {
  const addressText = textOrNull(location?.addressText);
  const label = textOrNull(location?.companyName) || addressText || "Location";
  const params = new URLSearchParams();

  if (location?.coordinates) {
    params.set("ll", `${location.coordinates.latitude},${location.coordinates.longitude}`);
    params.set("q", label);
  } else if (addressText) {
    params.set("q", addressText);
  }

  return `https://maps.apple.com/?${params.toString()}`;
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
    const callbackName = `contactPitAppleMapKitInit${Math.random().toString(36).slice(2)}`;
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

function renderAppleLocationMap(container, locations) {
  const points = safeArray(locations).filter((location) => location?.coordinates);
  if (!container || !points.length || !window.mapkit?.Map) return;

  const { mapkit } = window;
  const map = new mapkit.Map(container);
  map.mapType = mapkit.Map.MapTypes.Standard;
  map.colorScheme = mapkit.Map.ColorSchemes.Light;
  map.tintColor = "#7a1ce1";
  const annotations = points.map(
    (location, index) =>
      new mapkit.MarkerAnnotation(new mapkit.Coordinate(location.coordinates.latitude, location.coordinates.longitude), {
        title: location.companyName || `Location ${index + 1}`,
        subtitle: location.addressText || "",
        color: MAP_MARKER_COLOR,
        glyphColor: "#ffffff",
      })
  );

  map.showItems(annotations);
  if (mapkit.CoordinateRegion && mapkit.CoordinateSpan) {
    const latitudes = points.map((location) => location.coordinates.latitude);
    const longitudes = points.map((location) => location.coordinates.longitude);
    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);
    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);
    const latitudeDelta = Math.max((maxLatitude - minLatitude) * 1.22, 0.04);
    const longitudeDelta = Math.max((maxLongitude - minLongitude) * 1.22, 0.04);
    map.region = new mapkit.CoordinateRegion(
      new mapkit.Coordinate((minLatitude + maxLatitude) / 2, (minLongitude + maxLongitude) / 2),
      new mapkit.CoordinateSpan(latitudeDelta, longitudeDelta)
    );
  }
}

function renderFallbackLocationMap(container) {
  const fallbackUrl = container?.getAttribute("data-person-map-fallback-url");
  if (!container || !fallbackUrl) return;
  container.innerHTML = `
    <iframe
      class="company-map-embed"
      src="${escapeHtml(fallbackUrl)}"
      title="Person company locations map"
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
    ></iframe>
  `;
}

function locationMapMarkup(locations) {
  const points = safeArray(locations).filter((location) => location?.coordinates);
  const mapUrl = googleMapsEmbedUrlForLocations(points);
  const canRenderAppleMap = Boolean(APPLE_MAPS_TOKEN && points.length);

  if (!points.length || !mapUrl) {
    return `
      <div class="company-location-stack person-location-stack">
        <div class="company-map-embed-shell company-location-map person-location-map">
          <div class="company-map-orb"><span></span><span></span><span></span></div>
        </div>
        <p class="company-empty-copy">No coordinates are available for this person's linked company locations.</p>
      </div>
    `;
  }

  return `
    <div class="company-location-stack person-location-stack">
      <div class="company-map-embed-shell company-location-map person-location-map">
        ${
          canRenderAppleMap
            ? `
              <div
                class="person-location-canvas"
                data-person-apple-map
                data-person-apple-map-locations="${escapeAttributeJson(
                  points.map((location) => ({
                    companyName: location.companyName,
                    addressText: location.addressText,
                    coordinates: location.coordinates,
                  }))
                )}"
                data-person-map-fallback-url="${escapeHtml(mapUrl)}"
              ></div>
            `
            : `
              <iframe
                class="company-map-embed"
                src="${escapeHtml(mapUrl)}"
                title="Person company locations map"
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade"
              ></iframe>
            `
        }
      </div>
      <div class="person-location-legend">
        ${points
          .map((location) => {
            const href = companyLinkHref({ name: location.companyName, registry_code: location.registryCode });
            const content = `
              <div class="company-person-avatar">${escapeHtml(initials(location.companyName || "Company"))}</div>
              <div class="company-person-copy person-location-legend-copy">
                <h3>${escapeHtml(location.companyName)}</h3>
                ${location.registryCode ? `<p>${escapeHtml(location.registryCode)}</p>` : ""}
              </div>
              ${href ? '<span class="company-person-chevron" aria-hidden="true">›</span>' : ""}
            `;

            return href
              ? `<a class="company-person-card is-navigable person-location-legend-item" href="${escapeHtml(href)}">${content}</a>`
              : `<article class="company-person-card person-location-legend-item">${content}</article>`;
          })
          .join("")}
      </div>
    </div>
  `;
}

function chartCard(title, points, formatter, scope) {
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
        <p class="company-empty-copy">No ${escapeHtml(scope.toLowerCase())} data is available.</p>
      </article>
    `;
  }

  const maxValue = Math.max(...items.map((item) => Math.abs(Number(item?.value) || 0)), 1);
  const bars = items
    .map((item) => {
      const rawValue = Number(item?.value) || 0;
      const height = Math.max(10, Math.round((Math.abs(rawValue) / maxValue) * 100));
      const negativeClass = rawValue < 0 ? " is-negative" : "";
      return `
        <div class="company-chart-bar-group">
          <span class="company-chart-bar${negativeClass}" style="height:${height}%"></span>
          <span class="company-chart-period">${escapeHtml(String(item?.period || "—"))}</span>
          <strong class="company-chart-value">${escapeHtml(formatter(rawValue))}</strong>
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

function companyDataRows(rows, emptyLabel) {
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
              <strong class="${row.valueClass ? escapeHtml(row.valueClass) : ""}">${escapeHtml(row.value)}</strong>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function personFinancialYears(companiesData) {
  return Array.from(
    new Set(
      safeArray(companiesData)
        .flatMap((companyData) => safeArray(companyData?.income_statements))
        .map((statement) => numberOrNull(statement?.year))
        .filter((year) => year !== null)
    )
  ).sort((left, right) => right - left);
}

function personHasTaxInformation(companiesData) {
  return safeArray(companiesData).some((companyData) => companyData?.tax_information);
}

function personFinancialInitialPeriod(companiesData) {
  const years = personFinancialYears(companiesData);
  if (years.length) return `year:${years[0]}`;
  if (personHasTaxInformation(companiesData)) return "last-quarter";
  return "";
}

function personFinancialPeriodLabel(period) {
  if (period === "last-quarter") return "Last quarter";
  if (period === "last-4-quarters") return "Last 4 quarters";
  if (String(period).startsWith("year:")) return String(period).slice(5);
  return "";
}

function companyForRegistry(person, registryCode) {
  return safeArray(person?.companies).find((item) => String(item?.registry_code || "") === String(registryCode || ""));
}

function companyReference(person, registryCode) {
  const company = companyForRegistry(person, registryCode);
  const fallback = {
    name: textOrNull(company?.name) || `Company ${registryCode || ""}`.trim() || "Unknown company",
    registry_code: registryCode,
  };

  return {
    company: company || fallback,
    name: textOrNull(company?.name) || fallback.name,
    registryCode: textOrNull(registryCode),
    href: companyLinkHref(company || fallback),
  };
}

function financialCompanyRows(items, emptyLabel, valueFormatter, valueAccessor = (item) => item?.value) {
  const list = safeArray(items)
    .map((item) => ({
      item,
      rawValue: numberOrNull(valueAccessor(item)),
    }))
    .filter(({ item, rawValue }) => textOrNull(item?.name) && rawValue !== null);
  if (!list.length) {
    return `<p class="company-empty-copy">${escapeHtml(emptyLabel)}</p>`;
  }

  return companyDataRows(
    list.map(({ item, rawValue }) => ({
      label: item.name,
      value: valueFormatter(rawValue),
      meta: item.registryCode || null,
      valueClass: rawValue < 0 ? "person-financial-value is-negative" : "person-financial-value",
    })),
    emptyLabel
  );
}

function profitabilityMarginRows(rows, emptyLabel) {
  const list = safeArray(rows);
  if (!list.length) {
    return `<p class="company-empty-copy">${escapeHtml(emptyLabel)}</p>`;
  }

  return `
    <div class="person-financial-margin-table">
      <div class="person-financial-margin-row is-head">
        <span class="person-financial-margin-label is-company">Company</span>
        <span class="person-financial-margin-label">Operating</span>
        <span class="person-financial-margin-label">Net</span>
      </div>
      ${list
        .map((row) => {
          const nameMarkup = row.href
            ? `<a class="person-financial-company-link" href="${escapeHtml(row.href)}">${escapeHtml(row.name)}</a>`
            : `<span>${escapeHtml(row.name)}</span>`;

          return `
            <div class="person-financial-margin-row">
              <div class="person-financial-margin-company">${nameMarkup}</div>
              <strong class="person-financial-margin-value${Number(row.operatingMargin) < 0 ? " is-negative" : ""}">${escapeHtml(
                formatPercent(row.operatingMargin)
              )}</strong>
              <strong class="person-financial-margin-value${Number(row.netMargin) < 0 ? " is-negative" : ""}">${escapeHtml(
                formatPercent(row.netMargin)
              )}</strong>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function personFinancialSectionMarkup({ title, description, content, eyebrow = "Financial" }) {
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

function financialSummaryHead({ label, value, note }) {
  return `
    <div class="company-section-card-head company-section-card-head-split person-financial-summary-head">
      <div class="person-financial-summary-copy">
        <p class="company-card-eyebrow">${escapeHtml(label)}</p>
        <h3 class="person-financial-summary-value">${escapeHtml(value)}</h3>
      </div>
      ${textOrNull(note) ? `<p class="person-financial-summary-note">${escapeHtml(note)}</p>` : ""}
    </div>
  `;
}

function financialPoolChips({ profitPool, lossPool }) {
  return `
    <div class="person-financial-pool-chips">
      <span class="person-financial-pool-chip">
        <span class="person-financial-pool-dot"></span>
        <span>Profit pool</span>
        <strong>${escapeHtml(formatCompactCurrency(profitPool))}</strong>
      </span>
      <span class="person-financial-pool-chip is-negative">
        <span class="person-financial-pool-dot is-negative"></span>
        <span>Loss pool</span>
        <strong>${escapeHtml(formatCompactCurrency(-lossPool))}</strong>
      </span>
    </div>
  `;
}

const PERSON_FINANCIAL_SLICE_COLORS = [
  "linear-gradient(135deg, #af52de, #af52de)",
  "linear-gradient(135deg, #5856d6, #5856d6)",
  "linear-gradient(135deg, #007aff, #007aff)",
  "linear-gradient(135deg, #32ade6, #32ade6)",
  "linear-gradient(135deg, #34c759, #34c759)",
  "linear-gradient(135deg, #009900, #009900)",
  "linear-gradient(135deg, #ffcc00, #ffcc00)",
  "linear-gradient(135deg, #ff9500, #ff9500)",
  "linear-gradient(135deg, #ff2d55, #ff2d55)",
  "linear-gradient(135deg, #ff3b30, #ff3b30)",
  "linear-gradient(135deg, #a2845e, #a2845e)",
];

const PERSON_FINANCIAL_SLICE_SOLID_COLORS = [
  "#af52de",
  "#5856d6",
  "#007aff",
  "#32ade6",
  "#34c759",
  "#009900",
  "#ffcc00",
  "#ff9500",
  "#ff2d55",
  "#ff3b30",
  "#a2845e",
];

function percentageString(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "0%";
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(Number(value));
}

function splitPieSlices(rawSlices, threshold = 0.015, softCap = 12) {
  const maxValue = rawSlices[0]?.value || 0;
  if (!maxValue) return { keep: [], tail: [] };
  let keep = rawSlices.filter((slice) => slice.value >= maxValue * threshold);
  const tail = rawSlices.filter((slice) => slice.value < maxValue * threshold);
  if (keep.length > softCap) {
    tail.push(...keep.slice(softCap));
    keep = keep.slice(0, softCap);
  }
  return { keep, tail };
}

function pieSlicesForRows(rows) {
  const items = safeArray(rows).filter((row) => numberOrNull(row?.value) !== null && Number(row.value) > 0);
  if (!items.length) return { chartSlices: [], legendSlices: [] };

  const total = items.reduce((sum, row) => sum + row.value, 0);
  const rawSlices = items
    .map((row) => ({
      ...row,
      percentage: total > 0 ? row.value / total : 0,
    }))
    .sort((left, right) => right.value - left.value);

  const { keep, tail } = splitPieSlices(rawSlices);
  const chartSlices = keep.slice();
  const combinedIds = new Set(tail.map((slice) => String(slice.registryCode || slice.id || slice.name)));

  if (tail.length) {
    const tailValue = tail.reduce((sum, row) => sum + row.value, 0);
    chartSlices.push({
      id: "other",
      name: "Other",
      value: tailValue,
      percentage: total > 0 ? tailValue / total : 0,
      href: null,
      isOther: true,
    });
  }

  const primaryId = chartSlices.find((slice) => !slice.isOther)?.registryCode || chartSlices.find((slice) => !slice.isOther)?.id || null;
  const colorForSlice = (slice) => {
    const sliceId = String(slice.registryCode || slice.id || slice.name);
    if (slice.isOther || combinedIds.has(sliceId)) {
      return {
        solid: "#b8afc8",
        gradient: "linear-gradient(135deg, #c8c1d6, #a99fbd)",
      };
    }

    const rankable = chartSlices.filter((item) => !item.isOther);
    if ((slice.registryCode || slice.id) === primaryId) {
      return {
        solid: "#7a1ce1",
        gradient: "linear-gradient(135deg, #7a1ce1, #7a1ce1)",
      };
    }

    const secondary = rankable.filter((item) => (item.registryCode || item.id) !== primaryId);
    const index = secondary.findIndex((item) => (item.registryCode || item.id) === (slice.registryCode || slice.id));
    const paletteIndex = index < 0 ? 0 : index % PERSON_FINANCIAL_SLICE_COLORS.length;
    return {
      solid: PERSON_FINANCIAL_SLICE_SOLID_COLORS[paletteIndex],
      gradient: PERSON_FINANCIAL_SLICE_COLORS[paletteIndex],
    };
  };

  const chartSlicesWithColor = chartSlices.map((slice) => ({
    ...slice,
    ...colorForSlice(slice),
  }));

  const legendSlices = rawSlices
    .slice()
    .sort((left, right) => right.percentage - left.percentage)
    .map((slice) => ({
      ...slice,
      ...colorForSlice(slice),
    }));

  return { chartSlices: chartSlicesWithColor, legendSlices };
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeDonutSegment(centerX, centerY, outerRadius, innerRadius, startAngle, endAngle) {
  const outerStart = polarToCartesian(centerX, centerY, outerRadius, startAngle);
  const outerEnd = polarToCartesian(centerX, centerY, outerRadius, endAngle);
  const innerEnd = polarToCartesian(centerX, centerY, innerRadius, endAngle);
  const innerStart = polarToCartesian(centerX, centerY, innerRadius, startAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x.toFixed(3)} ${outerEnd.y.toFixed(3)}`,
    `L ${innerEnd.x.toFixed(3)} ${innerEnd.y.toFixed(3)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x.toFixed(3)} ${innerStart.y.toFixed(3)}`,
    "Z",
  ].join(" ");
}

function financialPieSvgMarkup(slices) {
  const size = 260;
  const outerRadius = 118;
  const innerRadius = 70;
  const center = size / 2;
  let current = -90;

  const segments = slices
    .map((slice) => {
      const span = slice.percentage * 360;
      if (span <= 0) return "";
      const start = current;
      const end = current + span;
      current += span;
      if (end <= start) return "";

      return `
        <path
          d="${describeDonutSegment(center, center, outerRadius, innerRadius, start, end)}"
          fill="${escapeHtml(slice.solid)}"
        ></path>
      `;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
      ${segments}
    </svg>
  `;
}

function financialPieLegendMarkup(slices) {
  const list = safeArray(slices);
  if (!list.length) return "";

  const pages = [];
  for (let index = 0; index < list.length; index += 4) {
    pages.push(list.slice(index, index + 4));
  }

  const pagerId = "person-revenue-legend";

  return `
    <div class="person-financial-pie-legend company-paged-list" data-paged-list="${escapeHtml(pagerId)}" data-page-index="0">
      ${
        pages.length > 1
          ? `
            <div class="company-floating-rail company-paged-list-controls">
              <button class="company-page-button" type="button" data-page-prev="${escapeHtml(pagerId)}" aria-label="Previous page"><span aria-hidden="true">${chevronIcon("left")}</span></button>
              <span class="company-paged-list-status" data-page-status>${escapeHtml(`1 / ${pages.length}`)}</span>
              <button class="company-page-button" type="button" data-page-next="${escapeHtml(pagerId)}" aria-label="Next page"><span aria-hidden="true">${chevronIcon("right")}</span></button>
            </div>
          `
          : ""
      }
      ${pages
        .map(
          (page, pageIndex) => `
            <div class="company-paged-list-panel${pageIndex === 0 ? " is-active" : ""}" data-page-panel="${escapeHtml(pagerId)}" data-page-panel-index="${pageIndex}">
              ${page
                .map((slice) => {
                  const nameMarkup = slice.href
                    ? `<a class="person-financial-pie-company" href="${escapeHtml(slice.href)}">${escapeHtml(slice.name)}</a>`
                    : `<span class="person-financial-pie-company">${escapeHtml(slice.name)}</span>`;

                  return `
                    <div class="person-financial-pie-row">
                      <span class="person-financial-pie-swatch" style="background:${escapeHtml(slice.gradient)};"></span>
                      <div class="person-financial-pie-copy">
                        <strong>${escapeHtml(formatCurrency(slice.value))}</strong>
                        ${nameMarkup}
                      </div>
                      <strong class="person-financial-pie-share">${escapeHtml(percentageString(slice.percentage))}</strong>
                    </div>
                  `;
                })
                .join("")}
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function financialPieChartMarkup(rows, total, label, emptyLabel) {
  const { chartSlices, legendSlices } = pieSlicesForRows(rows);
  if (!legendSlices.length) {
    return `<p class="company-empty-copy">${escapeHtml(emptyLabel)}</p>`;
  }

  return `
    <div class="person-financial-pie-chart">
      ${financialPieLegendMarkup(legendSlices)}
      <div class="person-financial-pie-figure-wrap">
        <div class="person-financial-pie-figure">
          ${financialPieSvgMarkup(chartSlices)}
          <div class="person-financial-pie-ring">
            <div class="person-financial-pie-hole">
              <strong>${escapeHtml(label || formatCompactCurrency(total))}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function turnoverRowsForPeriod(person, companiesData, period) {
  return safeArray(companiesData)
    .map((companyData) => {
      const taxInformation = companyData?.tax_information;
      const value =
        period === "last-quarter"
          ? numberOrNull(taxInformation?.turnover_last_quarter)
          : numberOrNull(taxInformation?.turnover_4_quarter_sum);
      if (value === null || value <= 0) return null;
      const reference = companyReference(person, companyData?.registry_code);
      return {
        ...reference,
        value,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.value - left.value);
}

function taxDebtRows(person, companiesData) {
  return safeArray(companiesData)
    .map((companyData) => {
      const value = numberOrNull(companyData?.tax_information?.tax_debt);
      if (value === null || value <= 0) return null;
      const reference = companyReference(person, companyData?.registry_code);
      return {
        ...reference,
        value,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.value - left.value);
}

function revenueRowsForYear(person, companiesData, year) {
  return safeArray(companiesData)
    .map((companyData) => {
      const statement = safeArray(companyData?.income_statements).find((item) => numberOrNull(item?.year) === year);
      const value = numberOrNull(statement?.agg_total_revenue);
      if (value === null || value <= 0) return null;
      const reference = companyReference(person, companyData?.registry_code);
      return {
        ...reference,
        value,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.value - left.value);
}

function profitabilityRowsForYear(person, companiesData, year) {
  return safeArray(companiesData)
    .map((companyData) => {
      const profitability = safeArray(companyData?.profitability).find((item) => numberOrNull(item?.year) === year);
      if (!profitability) return null;
      const reference = companyReference(person, companyData?.registry_code);
      return {
        ...reference,
        operatingMargin: numberOrNull(profitability?.operating_margin),
        netMargin: numberOrNull(profitability?.net_margin),
        netProfit: numberOrNull(profitability?.net_profit),
      };
    })
    .filter(Boolean);
}

function buildTaxFinancialPanel(person, companiesData, period, activePeriod) {
  const rows = turnoverRowsForPeriod(person, companiesData, period);
  const totalTurnover = rows.reduce((sum, row) => sum + row.value, 0);
  const debtRows = taxDebtRows(person, companiesData);
  const totalDebt = debtRows.reduce((sum, row) => sum + row.value, 0);
  const periodLabel = personFinancialPeriodLabel(period).toLowerCase();

  return `
    <div class="company-financial-period-panel${activePeriod === period ? " is-active" : ""}" data-person-financial-period-panel="${escapeHtml(period)}">
      <div class="company-subsection-stack person-financial-panel-stack">
        ${personFinancialSectionMarkup({
          title: "Turnover",
          description: `EMTA-reported turnover for ${periodLabel} across linked companies.`,
          content: `
            ${financialSummaryHead({
              label: personFinancialPeriodLabel(period),
              value: formatCompactCurrency(totalTurnover),
              note: rows.length ? `${rows.length} linked companies with turnover in the selected period.` : "No turnover records are available for the selected period.",
            })}
            ${financialCompanyRows(rows, "No turnover records are available for the selected period.", formatCurrency)}
          `,
        })}
        ${personFinancialSectionMarkup({
          title: "Tax debt",
          description: "Current tax debt balances across linked companies.",
          content: `
            ${financialSummaryHead({
              label: "Current total",
              value: formatCompactCurrency(totalDebt),
              note: debtRows.length ? `${debtRows.length} linked companies currently show tax debt.` : "No linked companies currently show tax debt.",
            })}
            ${financialCompanyRows(debtRows, "No linked companies currently show tax debt.", formatCurrency)}
          `,
        })}
      </div>
    </div>
  `;
}

function buildAnnualFinancialPanel(person, companiesData, year, activePeriod) {
  const panelKey = `year:${year}`;
  const revenueRows = revenueRowsForYear(person, companiesData, year);
  const totalRevenue = revenueRows.reduce((sum, row) => sum + row.value, 0);
  const profitabilityRows = profitabilityRowsForYear(person, companiesData, year);
  const profitRows = profitabilityRows
    .filter((row) => row.netProfit !== null)
    .slice()
    .sort((left, right) => right.netProfit - left.netProfit);
  const totalNetProfit = profitRows.reduce((sum, row) => sum + row.netProfit, 0);
  const profitPool = profitRows.filter((row) => row.netProfit > 0).reduce((sum, row) => sum + row.netProfit, 0);
  const lossPool = profitRows.filter((row) => row.netProfit < 0).reduce((sum, row) => sum + Math.abs(row.netProfit), 0);
  const marginRows = profitabilityRows
    .slice()
    .sort((left, right) => {
      const leftValue = left.netMargin ?? -Infinity;
      const rightValue = right.netMargin ?? -Infinity;
      if (leftValue === rightValue) return left.name.localeCompare(right.name);
      return rightValue - leftValue;
    });

  return `
    <div class="company-financial-period-panel${activePeriod === panelKey ? " is-active" : ""}" data-person-financial-period-panel="${escapeHtml(panelKey)}">
      <div class="company-subsection-stack person-financial-panel-stack">
        ${personFinancialSectionMarkup({
          title: "Revenue",
          description: `Annual income statement revenue by linked company for ${year}.`,
          content: `
            ${financialPieChartMarkup(
              revenueRows,
              totalRevenue,
              formatCompactCurrency(totalRevenue),
              `No linked companies reported revenue in ${year}.`
            )}
          `,
        })}
        ${
          profitabilityRows.length
            ? personFinancialSectionMarkup({
                title: "Profit",
                description: `Net profit contribution by linked company for ${year}.`,
                content: `
                  ${financialSummaryHead({
                    label: `${year} net profit`,
                    value: formatCompactCurrency(totalNetProfit),
                    note: "Positive and negative company contributions combined.",
                  })}
                  ${financialPoolChips({ profitPool, lossPool })}
                  ${financialCompanyRows(profitRows, `No net profit figures are available for ${year}.`, formatCurrency, (row) => row.netProfit)}
                `,
              })
            : ""
        }
        ${
          profitabilityRows.length
            ? personFinancialSectionMarkup({
                title: "Profit margins",
                description: `Operating and net margin standings for linked companies in ${year}.`,
                content: profitabilityMarginRows(marginRows, `No profitability margin data is available for ${year}.`),
              })
            : ""
        }
      </div>
    </div>
  `;
}

function personFinancialPeriodSelectorMarkup(years, activePeriod, hasTaxData) {
  const yearButtons = safeArray(years)
    .map((year) => {
      const period = `year:${year}`;
      const active = activePeriod === period;
      return `
        <button
          class="company-toggle-button${active ? " is-active" : ""}"
          type="button"
          data-person-financial-period-toggle="${escapeHtml(period)}"
          role="tab"
          aria-selected="${active ? "true" : "false"}"
        >
          ${escapeHtml(String(year))}
        </button>
      `;
    })
    .join("");

  const taxButtons = hasTaxData
    ? `
      <button
        class="company-toggle-button${activePeriod === "last-quarter" ? " is-active" : ""}"
        type="button"
        data-person-financial-period-toggle="last-quarter"
        role="tab"
        aria-selected="${activePeriod === "last-quarter" ? "true" : "false"}"
      >
        Last quarter
      </button>
      <button
        class="company-toggle-button${activePeriod === "last-4-quarters" ? " is-active" : ""}"
        type="button"
        data-person-financial-period-toggle="last-4-quarters"
        role="tab"
        aria-selected="${activePeriod === "last-4-quarters" ? "true" : "false"}"
      >
        Last 4 quarters
      </button>
    `
    : "";

  if (!yearButtons && !taxButtons) return "";

  return `
    <div class="company-financial-period-nav person-financial-period-nav" role="tablist" aria-label="Person financial period selection">
      ${yearButtons}
      ${taxButtons}
    </div>
  `;
}

function buildSummary(person) {
  const bits = [
    person?.age !== null && person?.age !== undefined ? `${person.age} years old` : null,
    textOrNull(person?.birth_date) ? `Born ${formatDate(person.birth_date)}` : null,
    countryFlagEmoji(person?.country_code) ? `${countryFlagEmoji(person.country_code)} ${person.country_code}` : textOrNull(person?.country_code),
  ].filter(Boolean);
  if (!bits.length) {
    return "Person intelligence profile built from ContactPit person, company, contact, and tax data.";
  }
  return `${bits.join(" • ")}. Person intelligence profile built from ContactPit person, company, contact, and tax data.`;
}

function buildOverviewPanelMarkup({ person, companies }) {
  return `
    <section class="company-tab-panel company-overview-layout is-active" id="person-overview" data-person-tab-panel="overview">
      <div class="company-section-content">
        <div class="company-subsection-stack">
          <section class="company-subsection-grid">
            <div class="company-subsection-copy">
              <p class="company-section-eyebrow">Overview</p>
              <h3>Roles in companies</h3>
              <p>All linked company roles stay grouped in the first overview section.</p>
            </div>
            <article class="company-section-card">
              ${
                companies.length
                  ? `<div class="person-company-list">${companies.map((company) => companyCardMarkup(company)).join("")}</div>`
                  : '<p class="company-empty-copy">No linked companies are available for this person.</p>'
              }
            </article>
          </section>

          <section class="company-subsection-grid">
            <div class="company-subsection-copy">
              <p class="company-section-eyebrow">Certificates</p>
              <h3>Competence certificates</h3>
              <p>Professional competence certificates are shown as their own overview section.</p>
            </div>
            ${certificateCard(
              "Competence certificates",
              person?.kutsetunnistused,
              (item) => textOrNull(item?.professional_standard) || textOrNull(item?.professionalStandard) || "Unknown certificate"
            )}
          </section>

          <section class="company-subsection-grid">
            <div class="company-subsection-copy">
              <p class="company-section-eyebrow">Certificates</p>
              <h3>Authorization certificates</h3>
              <p>Authorization certificates are separated into the third overview section.</p>
            </div>
            ${certificateCard(
              "Authorization certificates",
              person?.padevustunnistused,
              (item) => textOrNull(item?.registration_number) || textOrNull(item?.registrationNumber) || "Unknown certificate"
            )}
          </section>
        </div>
      </div>
    </section>
  `;
}

function buildLocationsPanelMarkup({ locations }) {
  return `
    <section class="company-tab-panel company-location-layout" id="person-locations" data-person-tab-panel="locations">
      <div class="company-section-content">
        <div class="company-subsection-stack">
          <section class="company-subsection-grid">
            <div class="company-subsection-copy">
              <p class="company-section-eyebrow">Locations</p>
              <h3>Associated company locations</h3>
              <p>The locations tab plots linked company coordinates on a shared map and keeps the associated companies visible beneath it.</p>
            </div>
            <article class="company-section-card">
              ${locationMapMarkup(locations)}
            </article>
          </section>
        </div>
      </div>
    </section>
  `;
}

function buildFinancialPanelMarkup({ person, companiesData, activeFinancialPeriod }) {
  const years = personFinancialYears(companiesData);
  const hasTaxData = personHasTaxInformation(companiesData);
  const periodsMarkup = [
    ...years.map((year) => buildAnnualFinancialPanel(person, companiesData, year, activeFinancialPeriod)),
    ...(hasTaxData
      ? [
          buildTaxFinancialPanel(person, companiesData, "last-quarter", activeFinancialPeriod),
          buildTaxFinancialPanel(person, companiesData, "last-4-quarters", activeFinancialPeriod),
        ]
      : []),
  ].join("");

  return `
    <section class="company-tab-panel company-financial-layout person-financial-layout" id="person-financial" data-person-tab-panel="financial">
      <div class="company-section-content company-financial-shell person-financial-shell">
        ${
          years.length || hasTaxData
            ? `
              <div class="company-financial-content-stack">
                ${periodsMarkup}
              </div>
            `
            : '<article class="company-section-card"><p class="company-empty-copy">No company tax or financial records are available for this person.</p></article>'
        }
      </div>
    </section>
  `;
}

function buildPersonMarkup(person, slug) {
  const fullName = [textOrNull(person?.first_name), textOrNull(person?.last_name)].filter(Boolean).join(" ") || "Unknown person";
  const legalStatus = legalStatusMeta(person?.legal_status);
  const overviewFlag = countryFlagEmoji(person?.country_code);
  const locations = uniqueCompanyLocations(person);
  const companies = safeArray(person?.companies);
  const companiesData = safeArray(person?.companies_data);
  const activeFinancialPeriod = personFinancialInitialPeriod(companiesData);
  const emailContact = firstContact(person?.contacts, ["EMAIL"]);
  const phoneContact = firstContact(person?.contacts, ["MOBILE", "MOB", "PHONE", "CELL", "CELLPHONE", "MOBILE_PHONE"]);

  return `
    <div class="company-view person-view" data-person-view data-person-tab="overview" data-person-financial-period="${escapeHtml(activeFinancialPeriod)}">
      <section class="company-hero-shell">
        <div class="company-hero-card person-hero-card">
          <div class="company-floating-rail">
            ${compactFloatingAction({
              label: "Email",
              value: null,
              href: emailContact ? `mailto:${emailContact.value}` : null,
              icon: "email",
            })}
            ${compactFloatingAction({
              label: "Phone",
              value: null,
              href: phoneContact ? `tel:${phoneContact.value.replace(/\s+/g, "")}` : null,
              icon: "phone",
            })}
            ${floatingStat({
              label: "Views",
              value: formatInteger(person?.total_view_count || 0),
              icon: "eye",
            })}
            ${floatingStat({
              label: "Favorites",
              value: formatInteger(person?.total_favorite_count || 0),
              icon: "heart",
            })}
          </div>
          <div class="company-hero-copy">
            <div class="company-title-row">
              <div class="company-title-mark">${escapeHtml(initials(fullName))}</div>
              <div>
                <h1 class="company-title">${escapeHtml(fullName)}</h1>
              </div>
            </div>
            <div class="company-hero-meta-layout">
              <div class="company-info-grid company-info-grid-hero">
                ${infoItem("Age", person?.age !== null && person?.age !== undefined ? `${person.age} years` : null)}
                ${infoItem("Birth date", formatDate(person?.birth_date))}
                ${infoItem("Legal status", legalStatus.label)}
                ${infoItem("Country", overviewFlag ? `${overviewFlag} ${person.country_code}` : person?.country_code)}
              </div>
            </div>
          </div>
          <aside class="company-hero-map-side person-hero-side" aria-hidden="true"></aside>
        </div>
      </section>

      <nav class="company-jump-nav person-jump-nav" aria-label="Person section navigation" role="tablist">
        <button class="is-active" type="button" data-person-tab-toggle="overview" role="tab" aria-selected="true">Overview</button>
        <button type="button" data-person-tab-toggle="financial" role="tab" aria-selected="false">Financial</button>
        <button type="button" data-person-tab-toggle="locations" role="tab" aria-selected="false">Locations</button>
      </nav>

      ${companiesData.length
        ? `
          <div class="company-financial-rail" data-person-financial-rail>
            ${personFinancialPeriodSelectorMarkup(personFinancialYears(companiesData), activeFinancialPeriod, personHasTaxInformation(companiesData))}
          </div>
        `
        : ""}

      ${buildOverviewPanelMarkup({ person, companies })}
      ${buildFinancialPanelMarkup({ person, companiesData, activeFinancialPeriod })}
      ${buildLocationsPanelMarkup({ locations })}
    </div>
  `;
}

function setupInteractions() {
  const shell = document.querySelector("[data-person-view]");
  if (!shell) return;

  const tabButtons = shell.querySelectorAll("[data-person-tab-toggle]");
  const tabPanels = shell.querySelectorAll("[data-person-tab-panel]");
  const financialRail = shell.querySelector("[data-person-financial-rail]");
  const financialPeriodButtons = shell.querySelectorAll("[data-person-financial-period-toggle]");
  const financialPeriodPanels = shell.querySelectorAll("[data-person-financial-period-panel]");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.getAttribute("data-person-tab-toggle");
      if (!tab) return;

      shell.setAttribute("data-person-tab", tab);
      tabButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", active ? "true" : "false");
      });
      tabPanels.forEach((panel) => {
        panel.classList.toggle("is-active", panel.getAttribute("data-person-tab-panel") === tab);
      });
      if (financialRail) {
        financialRail.classList.toggle("is-active", tab === "financial");
      }
      if (tab === "locations") {
        void setupAppleLocationMaps(shell);
      }
    });
  });
  if (financialRail) {
    financialRail.classList.toggle("is-active", shell.getAttribute("data-person-tab") === "financial");
  }
  if (shell.getAttribute("data-person-tab") === "locations") {
    void setupAppleLocationMaps(shell);
  }

  financialPeriodButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const period = button.getAttribute("data-person-financial-period-toggle");
      if (!period) return;

      shell.setAttribute("data-person-financial-period", period);
      financialPeriodButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", active ? "true" : "false");
      });
      financialPeriodPanels.forEach((panel) => {
        panel.classList.toggle("is-active", panel.getAttribute("data-person-financial-period-panel") === period);
      });
    });
  });

  shell.querySelectorAll("[data-paged-list]").forEach((listNode) => {
    const listId = listNode.getAttribute("data-paged-list");
    if (!listId) return;
    const panels = Array.from(listNode.querySelectorAll(`[data-page-panel="${listId}"]`));
    if (!panels.length) return;
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
}

async function setupAppleLocationMaps(scope = document) {
  const containers = Array.from(scope.querySelectorAll("[data-person-apple-map]")).filter(
    (container) => !container.hasAttribute("data-person-apple-map-initialized")
  );
  if (!containers.length) return;

  try {
    await loadAppleMapKit();
  } catch {
    containers.forEach((container) => {
      renderFallbackLocationMap(container);
      container.setAttribute("data-person-apple-map-initialized", "true");
    });
    return;
  }

  containers.forEach((container) => {
    const raw = container.getAttribute("data-person-apple-map-locations");
    if (!raw) {
      renderFallbackLocationMap(container);
      container.setAttribute("data-person-apple-map-initialized", "true");
      return;
    }
    try {
      renderAppleLocationMap(container, JSON.parse(raw));
    } catch {
      renderFallbackLocationMap(container);
    }
    container.setAttribute("data-person-apple-map-initialized", "true");
  });
}

async function loadPerson() {
  const slug = currentSlug();
  if (!slug) {
    renderState('<p class="detail-state">Missing person slug.</p>');
    return;
  }

  try {
    const response = await fetch(`/api/person?slug=${encodeURIComponent(slug)}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(response.status === 404 ? "Person not found." : `Failed to load person (${response.status}).`);
    }

    const payload = await response.json();
    const person = payload?.message;
    if (!person) {
      throw new Error("Person payload is missing.");
    }

    const fullName = [person.first_name, person.last_name].filter(Boolean).join(" ") || "Unknown person";
    document.title = `ContactPit | ${fullName}`;

    renderState(buildPersonMarkup(person, slug));
    setupInteractions();
  } catch (error) {
    renderState(`<p class="detail-state">${escapeHtml(error instanceof Error ? error.message : "Failed to load person.")}</p>`);
  }
}

void loadPerson();
