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

const assetManifest = {
  Icon: "./assets/ios/Icon.svg",
  test2: "./assets/ios/test2.png",
};

function assetPath(ref) {
  if (!ref) return "";
  if (assetManifest[ref]) return assetManifest[ref];
  return `./assets/ios/${ref}.png`;
}

function assetSvgPath(ref) {
  if (!ref) return "";
  if (assetManifest[ref]?.endsWith(".svg")) return assetManifest[ref];
  return `./assets/ios/${ref}.svg`;
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

function toSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderTrending(data) {
  const tabsRoot = document.getElementById("trending-tabs");
  const gridRoot = document.getElementById("trending-grid");
  if (!tabsRoot || !gridRoot) return;

  let activeKey = data[0]?.key;

  function paint() {
    const active = data.find((item) => item.key === activeKey) || data[0];

    tabsRoot.innerHTML = data
      .map(
        (board) => `
          <button class="trending-tab ${board.key === active?.key ? "is-active" : ""}" data-key="${board.key}">
            ${localizedText(board.title)}
          </button>
        `
      )
      .join("");

    gridRoot.innerHTML = (active?.items || [])
      .map(
        (item) => `
          <article class="trend-card">
            <div class="top-meta">
              <span class="type-chip">${item.type}</span>
              <span class="value-chip">${formatValue(item.value, item.value_type)}</span>
            </div>
            <h3 class="trend-name">${item.name}</h3>
            <p class="item-subtitle">${localizedText(active.subtitle)}</p>
            <div class="item-meta">ID ${item.identifier}</div>
          </article>
        `
      )
      .join("");

    tabsRoot.querySelectorAll("[data-key]").forEach((button) => {
      button.addEventListener("click", () => {
        activeKey = button.dataset.key;
        paint();
      });
    });
  }

  paint();
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
              .slice(0, 5)
              .map(
                (item, index) => `
                  <li>
                    <span class="rank-index">${String(index + 1).padStart(2, "0")}</span>
                    <span class="rank-name">${item.name}</span>
                    <span class="rank-value">${formatValue(item.value, item.value_type)}</span>
                  </li>
                `
              )
              .join("")}
          </ol>
          <div class="item-meta">${board.key.replaceAll("_", " ")}</div>
        </article>
      `
    )
    .join("");
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
          <img class="county-card-shape" src="${shape}" alt="" />
        </article>
      `;
    })
    .join("");
}

function renderCatalogBoard(board, rootId) {
  const root = document.getElementById(rootId);
  if (!root || !board) return;

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
            <img class="catalog-logo" src="${logo}" alt="${item.name} logo" loading="lazy" onerror="this.onerror=null;this.src='${assetSvgPath(meta.image_ref)}'" />
            <div class="catalog-copy">
              <h3 class="catalog-name">${item.name}</h3>
            </div>
          </div>
          <div>
            <div class="catalog-metric">
              <p class="item-subtitle catalog-label">
                ${localizedText(item.value_description) || "Member count"}
              </p>
              <div class="catalog-value">${formatValue(item.value, item.value_type)}</div>
            </div>
            <div class="item-meta" style="color:${theme.chipText}; border-color:${theme.chipBorder}; background:${theme.chipBg}">Registry code ${item.registry_code}</div>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadHomeData() {
  const status = document.getElementById("home-status");
  if (!status) return;

  try {
    let payload = null;
    const sources = ["/api/home", "./data/home.json"];

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

    renderTrending(payload.trending || []);
    renderLeaderboards(payload.leaderboards || []);
    renderCounties(payload.counties || []);
    renderCatalogBoard(
      (payload.catalog || []).find((board) => board.key === "political_parties"),
      "parties-grid"
    );
    renderCatalogBoard(
      (payload.catalog || []).find((board) => board.key === "publicly_traded_companies"),
      "public-grid"
    );

    status.textContent =
      "Home data loaded from the same backend feeds the iOS app uses. Local preview may use a generated snapshot fallback.";
  } catch (error) {
    status.textContent =
      "Home data could not be loaded in this environment. Check /api/home or regenerate ./data/home.json.";
    status.classList.add("is-error");
    console.error(error);
  }
}

if (document.body.classList.contains("page-home")) {
  loadHomeData();
}
