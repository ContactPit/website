import { getOrFetchSessionCache } from "./shared/session-bootstrap-cache.js";

const bundledAssetEntries = Object.entries(
  import.meta.glob("./assets/ios/*.{png,svg,jpg,jpeg}", {
    eager: true,
    import: "default",
  })
);

const bundledAssetsByPath = new Map(bundledAssetEntries);
const bundledAssetsByStem = new Map(
  bundledAssetEntries.map(([path, url]) => {
    const fileName = path.split("/").pop() || "";
    const stem = fileName.replace(/\.[^.]+$/, "");
    return [stem, url];
  })
);

const numberFormatter = new Intl.NumberFormat("en-US");
const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const currencyCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const legalReplacements = {
  sihtasutus: "SA",
  aktsiaselts: "AS",
  "osaühing": "OÜ",
  filiaal: "FIL",
  "füüsilisest isikust ettevõtja": "FIE",
  mittetulundusühing: "MTÜ",
  maaparandusühistu: "MPÜ",
  "tarbijate ühistu": "TÜ",
  tulundusühistu: "TÜH",
  koolitusühistu: "KÜ",
  "ametiühing": "AMETÜ",
  "usuline ühendus": "UÜ",
  "ühendus": "ÜÜ",
  "ühisus": "ÜÜ",
  "avoin yhtiö": "AVOIG",
  komanditühing: "KOVAS",
  "täisühing": "TRAS",
  "ühisprojekt": "SCE",
  usaldusühing: "TKR",
  "euroopa majandushuviühing": "EMÜ",
  "seadusega moodustatud asutus": "SE",
};

const legalAbbreviations = new Set([
  "AMETÜ", "AS", "AVOIG", "EMÜ", "ERAK", "FIE", "FIL", "KOVAS",
  "KÜ", "MPÜ", "MTÜ", "OÜ", "SA", "SCE", "SE", "TKR", "TRAS",
  "TÜ", "TÜH", "UÜ", "ÜÜ", "EU",
]);

const longTokens = new Set(Object.keys(legalReplacements).map((value) => value.toLowerCase()));
const shortTokens = new Set(Object.values(legalReplacements).map((value) => value.toLowerCase()));

const assetManifest = {
  Icon: bundledAssetsByPath.get("./assets/ios/Icon.svg"),
  test2: bundledAssetsByPath.get("./assets/ios/test2.png"),
};

const HOME_CACHE_KEY = "home-bootstrap";
const FILTERS_CACHE_KEY = "filters-bootstrap";
const SESSION_BOOTSTRAP_TTL_MS = 30 * 60 * 1000;

function assetPath(ref) {
  if (!ref) return "";
  if (assetManifest[ref]) return assetManifest[ref];
  return bundledAssetsByStem.get(ref) || bundledAssetsByPath.get(`./assets/ios/${ref}.png`) || "";
}

function assetSvgPath(ref) {
  if (!ref) return "";
  const asset = assetManifest[ref];
  if (asset?.endsWith(".svg")) return asset;
  return bundledAssetsByPath.get(`./assets/ios/${ref}.svg`) || "";
}

function normalizeHex(value) {
  if (!value) return null;
  const hex = String(value).trim();
  if (!hex.startsWith("#")) return null;
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex.length === 7 ? hex : null;
}

function hexToRgb(value) {
  const hex = normalizeHex(value);
  if (!hex) return null;
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  const toLinear = (channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function withAlpha(hex, alpha) {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(255,255,255,${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function cardTheme(background, foreground) {
  const bg = normalizeHex(background) || "#ffffff";
  const fg = normalizeHex(foreground);
  const bgIsDark = luminance(bg) < 0.32;
  const ink = fg || (bgIsDark ? "#ffffff" : "#171320");
  const muted = bgIsDark ? "rgba(255,255,255,0.78)" : withAlpha(ink, 0.68);
  const value = bgIsDark ? "#ffffff" : "#1f1a2d";
  const chipBg = bgIsDark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.74)";
  const chipBorder = bgIsDark ? "rgba(255,255,255,0.22)" : withAlpha(ink, 0.12);
  const chipText = bgIsDark ? "#ffffff" : ink;
  return { ink, muted, value, chipBg, chipBorder, chipText };
}

function formatValue(value, type) {
  if (value == null) return "";
  if (type === "count") return numberFormatter.format(Math.round(value));
  if (type === "percentage") return `${(value * 100).toFixed(1)}%`;
  if (type === "euro") return currencyCompact.format(value);
  if (type === "unix_date") {
    const date = new Date(Number(value) * 1000);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-GB");
  }
  return compactNumber.format(value);
}

function localizedText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.en || value.et || "";
}

function hasLowercaseLetters(value) {
  return /[\p{Ll}]/u.test(value);
}

function titleCaseWord(value) {
  return String(value)
    .split("-")
    .map((part) => {
      if (!part) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("-");
}

function transformedName(value, includeLegalForm = false) {
  const original = String(value || "").trim();
  if (!original) return "";

  const isAllCapsOrNoLowercase = !hasLowercaseLetters(original);

  let updatedName = original;
  Object.entries(legalReplacements).forEach(([target, replacement]) => {
    updatedName = updatedName.replace(new RegExp(target, "giu"), replacement);
  });

  updatedName = updatedName.replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^_`{|}~]/g, " ");

  let words = updatedName
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  words = words.filter((word) => {
    const lower = word.toLowerCase();
    const base = lower.split("-")[0] || lower;

    if (includeLegalForm) {
      return !longTokens.has(lower) && !longTokens.has(base);
    }

    return (
      !longTokens.has(lower) &&
      !longTokens.has(base) &&
      !shortTokens.has(lower) &&
      !shortTokens.has(base)
    );
  });

  if (!words.length) return "";

  if (!isAllCapsOrNoLowercase) {
    return words
      .map((word) => {
        const upper = word.toUpperCase();
        if (legalAbbreviations.has(upper)) {
          return upper;
        }
        if (!hasLowercaseLetters(word)) {
          if (word.length >= 2 && word.length <= 4) {
            return upper;
          }
          return titleCaseWord(word);
        }
        return word;
      })
      .join(" ");
  }

  const nonLegalWords = words;
  const hasGroup = nonLegalWords.some((word) => word.toLowerCase() === "group");
  const coreWords = nonLegalWords.filter((word) => word.toLowerCase() !== "group");
  const treatCoreAsAcronyms =
    hasGroup && coreWords.length > 0 && coreWords.every((word) => word.length <= 3);

  return words
    .map((word) => {
      const lower = word.toLowerCase();
      const upper = word.toUpperCase();

      if (legalAbbreviations.has(upper)) {
        return upper;
      }
      if (lower === "group") {
        return "Group";
      }
      if (treatCoreAsAcronyms && lower !== "group") {
        return upper;
      }
      return titleCaseWord(lower);
    })
    .join(" ");
}

function toSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderTrending(data) {
  const root = document.getElementById("trending-grid");
  if (!root) return;

  root.innerHTML = (data || [])
    .map((board, index) => {
      const items = board.items || [];
      if (!items.length) return "";
      const duplicated = [...items, ...items];
      return `
        <div class="trending-marquee-row">
          <div class="trending-row-head">
            <p class="trending-row-label">${localizedText(board.title)}</p>
            <p class="trending-row-copy">${localizedText(board.subtitle) || ""}</p>
          </div>
          <div class="trending-carousel-wrap">
            <div class="trending-carousel ${index % 2 === 1 ? "is-reverse" : ""}">
              ${duplicated
                .map(
                  (item) => `
                    <article class="trending-card-minimal">
                      <div class="top-meta">
                        <span class="type-chip">${item.type}</span>
                        <span class="value-chip">${formatValue(item.value, item.value_type)} views</span>
                      </div>
                      <h3 class="trend-name">${transformedName(item.name)}</h3>
                      <p class="trend-subline">${item.identifier}</p>
                    </article>
                  `
                )
                .join("")}
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderLeaderboards(data) {
  const root = document.getElementById("leaderboards-grid");
  if (!root) return;

  root.innerHTML = data
    .map(
      (board) => `
        <article class="leaderboard-card">
          <div class="board-head">
            <div>
              <span class="board-kicker">${localizedText(board.subtitle) || "Live board"}</span>
              <h3 class="board-title">${localizedText(board.title)}</h3>
            </div>
            <span class="count-chip">${board.items.length} ranked</span>
          </div>
          <ol class="rank-list">
            ${board.items
              .slice(0, 10)
              .map(
                (item, index) => `
                  <li>
                    <span class="rank-index">${String(index + 1).padStart(2, "0")}</span>
                    <span class="rank-name">${transformedName(item.name)}</span>
                    <span class="rank-value">${formatValue(item.value, item.value_type)}</span>
                  </li>
                `
              )
              .join("")}
          </ol>
          <a class="item-meta" href="/filters/">View all</a>
        </article>
      `
    )
    .join("");

  bindLeaderboardControls();
}

function bindLeaderboardControls() {
  const rail = document.getElementById("leaderboards-grid");
  const prev = document.getElementById("leaderboards-prev");
  const next = document.getElementById("leaderboards-next");
  if (!rail || !prev || !next) return;

  let snapTimer = null;
  let programmaticScrollTimer = null;
  let isProgrammaticScroll = false;

  const cards = () => Array.from(rail.querySelectorAll(".leaderboard-card"));
  const snapPoints = () => {
    const cardList = cards();
    const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const points = cardList.map((card) => Math.min(card.offsetLeft, maxScrollLeft));
    return points.filter((point, index) => index === 0 || Math.abs(point - points[index - 1]) > 2);
  };

  const nearestSnapIndex = () => {
    const points = snapPoints();
    if (!points.length) return 0;
    const current = rail.scrollLeft;
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    points.forEach((point, index) => {
      const distance = Math.abs(point - current);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    return bestIndex;
  };

  const nearestIndex = () => {
    const cardList = cards();
    if (!cardList.length) return 0;
    const maxScrollLeft = rail.scrollWidth - rail.clientWidth;
    if (maxScrollLeft <= 0) return 0;
    if (rail.scrollLeft >= maxScrollLeft - 8) return cardList.length - 1;
    const current = rail.scrollLeft;
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    cardList.forEach((card, index) => {
      const target = Math.min(card.offsetLeft, maxScrollLeft);
      const distance = Math.abs(target - current);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    return bestIndex;
  };

  const snapToPoint = (pointIndex, behavior = "smooth") => {
    const points = snapPoints();
    if (!points.length) return;
    const safeIndex = Math.max(0, Math.min(pointIndex, points.length - 1));
    const target = points[safeIndex];
    if (behavior === "smooth") {
      isProgrammaticScroll = true;
      window.clearTimeout(programmaticScrollTimer);
      programmaticScrollTimer = window.setTimeout(() => {
        isProgrammaticScroll = false;
      }, 420);
    }
    rail.scrollTo({ left: target, behavior });
  };

  const queueSnap = () => {
    window.clearTimeout(snapTimer);
    snapTimer = window.setTimeout(() => {
      snapToPoint(nearestSnapIndex());
    }, 120);
  };

  prev.onclick = () => snapToPoint(nearestSnapIndex() - 1);
  next.onclick = () => snapToPoint(nearestSnapIndex() + 1);

  rail.onscroll = () => {
    if (isProgrammaticScroll) return;
    queueSnap();
  };
}

function renderCounties(data) {
  const root = document.getElementById("counties-grid");
  if (!root) return;

  root.innerHTML = data
    .map((county) => {
      const shape = assetPath(
        county.meta?.assets?.main || county.meta?.assets?.third || county.meta?.assets?.secondary
      );
      return `
        <article class="county-card">
          <div class="county-head">
            <div>
              <p class="count-label">County</p>
              <h3 class="county-name">${county.name}</h3>
            </div>
          </div>
          <p class="county-capital">${county.meta.capital}</p>
          <img class="county-card-shape" src="${shape}" alt="" loading="lazy" decoding="async" />
        </article>
      `;
    })
    .join("");
}

function renderCatalogBoard(board, rootId) {
  const root = document.getElementById(rootId);
  if (!root || !board) return;

  const titleId = rootId === "parties-grid" ? "parties-title" : rootId === "public-grid" ? "public-title" : null;
  const subtitleId =
    rootId === "parties-grid" ? "parties-subtitle" : rootId === "public-grid" ? "public-subtitle" : null;

  const heading = titleId ? document.getElementById(titleId) : null;
  const subtitle = subtitleId ? document.getElementById(subtitleId) : null;

  if (heading) {
    heading.textContent = localizedText(board.title) || heading.textContent;
  }

  if (subtitle) {
    const subtitleText = localizedText(board.subtitle);
    subtitle.textContent = subtitleText;
    subtitle.hidden = !subtitleText;
  }

  root.innerHTML = board.items
    .map((item) => {
      const meta = item.metaData || {};
      const logo = assetPath(meta.image_ref);
      const background = meta.secondary_color || "#ffffff";
      const foreground = meta.primary_color || "#171320";
      const theme = cardTheme(background, foreground);
      return `
        <article class="catalog-card" style="background:${background}; color:${theme.ink}; --card-muted:${theme.muted}; --card-value:${theme.value}">
          <div class="catalog-top">
            <img class="catalog-logo" src="${logo}" alt="${item.name} logo" loading="lazy" decoding="async" width="156" height="54" onerror="this.onerror=null;this.src='${assetSvgPath(meta.image_ref)}'" />
            <div class="catalog-copy">
              <h3 class="catalog-name">${transformedName(item.name)}</h3>
            </div>
          </div>
          <div>
            <div class="catalog-metric">
              <div class="catalog-value">${formatValue(item.value, item.value_type)}</div>
              <p class="item-subtitle catalog-label">
                ${localizedText(item.value_description) || "Member count"}
              </p>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTestimonials(data) {
  const root = document.getElementById("testimonials-grid");
  if (!root) return;

  const items = data || [];
  if (!items.length) {
    root.innerHTML = "";
    return;
  }

  const duplicated = [...items, ...items];

  root.innerHTML = `
    <div class="testimonial-carousel-wrap">
      <div class="testimonial-carousel">
      ${duplicated
        .map(
          (item) => `
          <article class="testimonial-slide">
            <div class="testimonial-stars">${"★".repeat(item.rating)}</div>
            <p class="testimonial-quote">“${item.review}”</p>
            <div class="testimonial-meta">
              <div class="testimonial-avatar">${item.name.charAt(0)}</div>
              <div class="testimonial-person">
                <p class="testimonial-name">${item.name}</p>
                <p class="testimonial-role">${item.position} · ${item.company}</p>
              </div>
            </div>
          </article>
        `
        )
        .join("")}
      </div>
    </div>
  `;
}

async function loadHomeData() {
  try {
    const payload = await getOrFetchSessionCache(
      HOME_CACHE_KEY,
      SESSION_BOOTSTRAP_TTL_MS,
      fetchHomePayload
    );

    renderTrending(payload.trending || []);
    renderLeaderboards(payload.leaderboards || []);
    renderCounties(payload.counties || []);
    renderCatalogBoard(
      (payload.catalog || []).find((board) => board.key === "political_parties"),
      "parties-grid"
    );
    renderTestimonials(payload.testimonials || []);
    renderCatalogBoard(
      (payload.catalog || []).find((board) => board.key === "publicly_traded_companies"),
      "public-grid"
    );
  } catch (error) {
    console.error(error);
  }
}

async function fetchHomePayload() {
  let payload = null;
  const sources = ["/api/home", "/data/home.json", "./data/home.json"];

  for (const source of sources) {
    try {
      const response = await fetch(source);
      if (!response.ok) continue;
      payload = await response.json();
      if (payload) break;
    } catch (_error) {
      continue;
    }
  }

  if (!payload) {
    throw new Error("No available home data source");
  }

  return payload;
}

async function prefetchFiltersBootstrap() {
  try {
    await getOrFetchSessionCache(FILTERS_CACHE_KEY, SESSION_BOOTSTRAP_TTL_MS, async () => {
      const response = await fetch("/api/filters");
      if (!response.ok) {
        throw new Error(`Failed to load filters data: ${response.status}`);
      }
      return response.json();
    });
  } catch (error) {
    console.error(error);
  }
}

function scheduleHomeDataLoad() {
  const run = () => {
    void loadHomeData();
    void prefetchFiltersBootstrap();
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 1200 });
    return;
  }

  window.setTimeout(run, 0);
}

if (document.body.classList.contains("page-home")) {
  scheduleHomeDataLoad();
}
