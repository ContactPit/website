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
  return `
    <a
      class="company-floating-action person-floating-action person-floating-action-${escapeHtml(icon)}"
      href="${escapeHtml(href)}"
      aria-label="${escapeHtml(label)}"
      title="${escapeHtml(label)}"
      ${external ? 'target="_blank" rel="noreferrer"' : ""}
    >
      <span class="company-floating-action-icon company-floating-action-icon-${escapeHtml(icon)}" aria-hidden="true">${iconSvg(icon)}</span>
    </a>
  `;
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
  const roleChips = roles
    .map(
      (role) => `
        <article class="company-tag-card">
          <p class="company-tag-title">${escapeHtml(roleText(role))}</p>
          ${roleDateText(role) ? `<p class="company-tag-meta">${escapeHtml(roleDateText(role))}</p>` : ""}
        </article>
      `
    )
    .join("");

  return `
    <article class="person-company-card">
      <div class="person-company-card-head">
        <div>
          <p class="company-card-eyebrow">Company</p>
          <h3>${escapeHtml(textOrNull(company?.name) || "Unknown company")}</h3>
        </div>
        <div class="person-company-actions">
          ${textOrNull(company?.registry_code) ? `<span class="company-inline-meta">Registry ${escapeHtml(String(company.registry_code))}</span>` : ""}
          ${href ? `<a class="company-inline-meta person-link-chip" href="${escapeHtml(href)}">Open company view</a>` : ""}
        </div>
      </div>
      ${
        roleChips
          ? `<div class="company-tag-grid person-role-grid">${roleChips}</div>`
          : '<p class="company-empty-copy">No role records are available for this company.</p>'
      }
    </article>
  `;
}

function certificateCard(title, items, titleGetter) {
  const list = safeArray(items);
  return `
    <article class="company-section-card">
      <div class="company-section-card-head">
        <div>
          <p class="company-card-eyebrow">Certificates</p>
          <h3>${escapeHtml(title)}</h3>
        </div>
      </div>
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
          : `<p class="company-empty-copy">No ${escapeHtml(title.toLowerCase())} records are available.</p>`
      }
    </article>
  `;
}

function uniqueAddresses(companiesData) {
  const seen = new Set();
  return safeArray(companiesData)
    .map((item) => item?.address)
    .filter((address) => {
      const longAddress = textOrNull(address?.address_long);
      if (!longAddress) return false;
      if (seen.has(longAddress)) return false;
      seen.add(longAddress);
      return true;
    });
}

function addressCardMarkup(address) {
  const addressText = textOrNull(address?.address_long) || textOrNull(address?.address) || "Unknown address";
  const mapsHref = `https://www.google.com/maps?q=${encodeURIComponent(addressText)}`;
  return `
    <article class="company-tag-card person-address-card">
      <p class="company-tag-title">${escapeHtml(addressText)}</p>
      <p class="company-tag-meta">${escapeHtml(
        [
          textOrNull(address?.county),
          textOrNull(address?.["city/municipality"]),
          textOrNull(address?.postal_code),
        ]
          .filter(Boolean)
          .join(" • ") || "Known company address"
      )}</p>
      <a class="person-address-link" href="${escapeHtml(mapsHref)}" target="_blank" rel="noreferrer">Open in Maps</a>
    </article>
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

function latestByYear(items) {
  return safeArray(items)
    .slice()
    .sort((left, right) => (numberOrNull(right?.year) || 0) - (numberOrNull(left?.year) || 0))[0] || null;
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
              <strong>${escapeHtml(row.value)}</strong>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function buildCompanyFinancialSection(person, companyData) {
  const company = safeArray(person?.companies).find(
    (item) => String(item?.registry_code || "") === String(companyData?.registry_code || "")
  );
  const companyName = textOrNull(company?.name) || `Company ${companyData?.registry_code || ""}`.trim();
  const latestStatement = latestByYear(companyData?.income_statements);
  const latestProfitability = latestByYear(companyData?.profitability);
  const turnoverHistory = safeArray(companyData?.tax_information?.turnover_history?.quarterly).slice(-6);
  const annualRevenueHistory = safeArray(companyData?.income_statements)
    .slice()
    .sort((left, right) => (numberOrNull(left?.year) || 0) - (numberOrNull(right?.year) || 0))
    .slice(-6)
    .map((item) => ({
      period: item?.year,
      value: item?.agg_total_revenue,
    }));
  const annualNetProfitHistory = safeArray(companyData?.income_statements)
    .slice()
    .sort((left, right) => (numberOrNull(left?.year) || 0) - (numberOrNull(right?.year) || 0))
    .slice(-6)
    .map((item) => ({
      period: item?.year,
      value: item?.agg_net_profit,
    }));
  const address = textOrNull(companyData?.address?.address_long) || textOrNull(companyData?.address?.address);
  const href = companyLinkHref(company);

  return `
    <section class="company-subsection-grid">
      <div class="company-subsection-copy">
        <p class="company-section-eyebrow">Tax & financial</p>
        <h3>${escapeHtml(companyName)}</h3>
        <p>${escapeHtml(
          [
            textOrNull(companyData?.registry_code) ? `Registry ${companyData.registry_code}` : null,
            address,
          ]
            .filter(Boolean)
            .join(" • ") || "Company-linked tax and financial footprint."
        )}</p>
        ${href ? `<a class="person-subsection-link" href="${escapeHtml(href)}">Open company intelligence</a>` : ""}
      </div>
      <article class="company-section-card">
        <div class="person-financial-card-stack">
          <div class="company-kpi-grid person-kpi-grid">
            ${metricCard({
              label: "4-quarter turnover",
              value: formatCompactCurrency(companyData?.tax_information?.turnover_4_quarter_sum),
              note: "EMTA aggregate across the latest four quarters",
              accent: "is-featured",
            })}
            ${metricCard({
              label: "Last quarter turnover",
              value: formatCompactCurrency(companyData?.tax_information?.turnover_last_quarter),
              note: "Most recent quarter",
            })}
            ${metricCard({
              label: "Tax debt",
              value: formatCompactCurrency(companyData?.tax_information?.tax_debt),
              note: "Current recorded debt",
            })}
            ${metricCard({
              label: "Latest annual revenue",
              value: formatCompactCurrency(latestStatement?.agg_total_revenue),
              note: latestStatement?.year ? `Income statement ${latestStatement.year}` : "No annual statement yet",
            })}
            ${metricCard({
              label: "Latest net profit",
              value: formatCompactCurrency(latestStatement?.agg_net_profit),
              note: latestStatement?.year ? `Income statement ${latestStatement.year}` : "No annual statement yet",
            })}
            ${metricCard({
              label: "Latest net margin",
              value: formatPercent(latestProfitability?.net_margin),
              note: latestProfitability?.year ? `Profitability ${latestProfitability.year}` : "No profitability series yet",
            })}
          </div>
          <div class="company-chart-grid person-chart-grid">
            ${chartCard("Quarterly turnover", turnoverHistory, formatCompactCurrency, "EMTA")}
            ${chartCard("Annual revenue", annualRevenueHistory, formatCompactCurrency, "Annual")}
            ${chartCard("Annual net profit", annualNetProfitHistory, formatCompactCurrency, "Annual")}
          </div>
          <div class="company-grid company-grid-two person-financial-detail-grid">
            <article class="company-chart-card">
              <div class="company-section-card-head">
                <div>
                  <p class="company-card-eyebrow">Latest year</p>
                  <h3>Profitability ratios</h3>
                </div>
              </div>
              ${companyDataRows(
                [
                  {
                    label: "Revenue",
                    value: formatCurrency(latestProfitability?.revenue),
                    meta: latestProfitability?.year ? String(latestProfitability.year) : null,
                  },
                  {
                    label: "Operating profit",
                    value: formatCurrency(latestProfitability?.operating_profit),
                  },
                  {
                    label: "Profit before tax",
                    value: formatCurrency(latestProfitability?.profit_before_tax),
                  },
                  {
                    label: "Net profit",
                    value: formatCurrency(latestProfitability?.net_profit),
                  },
                  {
                    label: "Operating margin",
                    value: formatPercent(latestProfitability?.operating_margin),
                  },
                  {
                    label: "Pre-tax margin",
                    value: formatPercent(latestProfitability?.profit_before_tax_margin),
                  },
                  {
                    label: "Net margin",
                    value: formatPercent(latestProfitability?.net_margin),
                  },
                ],
                "No profitability ratios are available."
              )}
            </article>
            <article class="company-chart-card">
              <div class="company-section-card-head">
                <div>
                  <p class="company-card-eyebrow">History</p>
                  <h3>Reported annual statements</h3>
                </div>
              </div>
              ${companyDataRows(
                safeArray(companyData?.income_statements)
                  .slice()
                  .sort((left, right) => (numberOrNull(right?.year) || 0) - (numberOrNull(left?.year) || 0))
                  .map((item) => ({
                    label: String(item?.year || "Unknown year"),
                    value: formatCompactCurrency(item?.agg_total_revenue),
                    meta: `Net profit ${formatCompactCurrency(item?.agg_net_profit)}`,
                  })),
                "No annual statements are available."
              )}
            </article>
          </div>
        </div>
      </article>
    </section>
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

function buildPersonMarkup(person, slug) {
  const fullName = [textOrNull(person?.first_name), textOrNull(person?.last_name)].filter(Boolean).join(" ") || "Unknown person";
  const legalStatus = legalStatusMeta(person?.legal_status);
  const overviewFlag = countryFlagEmoji(person?.country_code);
  const addresses = uniqueAddresses(person?.companies_data);
  const companies = safeArray(person?.companies);
  const companiesData = safeArray(person?.companies_data);
  const emailContact = safeArray(person?.contacts).find(
    (contact) => String(contact?.type || "").toUpperCase() === "EMAIL" && textOrNull(contact?.value)
  );
  const phoneContact = safeArray(person?.contacts).find(
    (contact) =>
      ["PHONE", "MOBILE", "MOB", "CELL", "CELLPHONE", "MOBILE_PHONE"].includes(String(contact?.type || "").toUpperCase()) &&
      textOrNull(contact?.value)
  );

  return `
    <div class="company-view person-view" data-person-view>
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
                ${infoItem("Identification code", person?.identification_code)}
                ${infoItem("Birth date", formatDate(person?.birth_date))}
                ${infoItem("Legal status", legalStatus.label)}
                ${infoItem("Country", overviewFlag ? `${overviewFlag} ${person.country_code}` : person?.country_code)}
              </div>
            </div>
          </div>
          <aside class="company-hero-map-side person-hero-side" aria-hidden="true"></aside>
        </div>
      </section>

      <nav class="company-jump-nav person-jump-nav" aria-label="Person section navigation">
        <a href="#person-overview">Overview</a>
        <a href="#person-contact">Contact</a>
        <a href="#person-financial">Tax & financial</a>
      </nav>

      <section class="company-section-grid" id="person-overview">
        <div class="company-section-heading">
          <p class="company-section-eyebrow">Overview</p>
          <h2>Identity, companies, and certificates</h2>
          <p>The web layout keeps the iOS general view structure: core person facts first, then company links and regulated certificates.</p>
        </div>
        <div class="company-section-content">
          <div class="company-grid company-grid-two">
            <article class="company-section-card">
              <div class="company-section-card-head">
                <div>
                  <p class="company-card-eyebrow">Identity</p>
                  <h3>Registry snapshot</h3>
                </div>
              </div>
              <div class="company-info-grid">
                ${infoItem("Identification code", person?.identification_code)}
                ${infoItem("Legal status", legalStatus.label)}
                ${infoItem("Birth date", formatDate(person?.birth_date))}
                ${infoItem("Age", person?.age !== null && person?.age !== undefined ? `${person.age} years` : null)}
                ${infoItem("Country", overviewFlag ? `${overviewFlag} ${person.country_code}` : person?.country_code)}
                ${infoItem("Slug", person?.slug || slug)}
              </div>
            </article>

            <article class="company-section-card">
              <div class="company-section-card-head">
                <div>
                  <p class="company-card-eyebrow">Engagement</p>
                  <h3>View and favorite signals</h3>
                </div>
              </div>
              <div class="company-kpi-grid person-kpi-grid">
                ${metricCard({
                  label: "Views",
                  value: formatInteger(person?.total_view_count || 0),
                  note: "Total recorded profile views",
                  accent: "is-featured",
                })}
                ${metricCard({
                  label: "Favorites",
                  value: formatInteger(person?.total_favorite_count || 0),
                  note: "Total saved counts",
                })}
                ${metricCard({
                  label: "Linked addresses",
                  value: formatInteger(addresses.length),
                  note: addresses.length ? "Distinct company addresses" : "No address records available",
                })}
              </div>
            </article>

            <article class="company-section-card company-section-card-span-2">
              <div class="company-section-card-head">
                <div>
                  <p class="company-card-eyebrow">Companies</p>
                  <h3>Roles across organizations</h3>
                </div>
              </div>
              ${
                companies.length
                  ? `<div class="person-company-list">${companies.map((company) => companyCardMarkup(company)).join("")}</div>`
                  : '<p class="company-empty-copy">No linked companies are available for this person.</p>'
              }
            </article>

            ${certificateCard(
              "Competence certificates",
              person?.kutsetunnistused,
              (item) => textOrNull(item?.professional_standard) || textOrNull(item?.professionalStandard) || "Unknown certificate"
            )}

            ${certificateCard(
              "Authorization certificates",
              person?.padevustunnistused,
              (item) => textOrNull(item?.registration_number) || textOrNull(item?.registrationNumber) || "Unknown certificate"
            )}
          </div>
        </div>
      </section>

      <section class="company-section-grid" id="person-contact">
        <div class="company-section-heading">
          <p class="company-section-eyebrow">Contact</p>
          <h2>Direct channels and known operating locations</h2>
          <p>The contact section mirrors the iOS route by prioritizing direct outreach first, then mapping the addresses connected through linked companies.</p>
        </div>
        <div class="company-section-content">
          <div class="company-grid company-grid-two">
            <article class="company-section-card">
              <div class="company-section-card-head">
                <div>
                  <p class="company-card-eyebrow">Direct contact</p>
                  <h3>Email, phone, and public channels</h3>
                </div>
              </div>
              <div class="company-contact-grid">
                ${contactActionsMarkup(person?.contacts)}
              </div>
            </article>

            <article class="company-section-card">
              <div class="company-section-card-head">
                <div>
                  <p class="company-card-eyebrow">Coverage</p>
                  <h3>Location footprint</h3>
                </div>
              </div>
              <div class="company-info-grid">
                ${infoItem("Distinct addresses", addresses.length ? String(addresses.length) : null)}
                ${infoItem(
                  "Counties",
                  Array.from(new Set(addresses.map((address) => textOrNull(address?.county)).filter(Boolean))).join(", ")
                )}
                ${infoItem("Linked companies", companies.length ? String(companies.length) : null)}
                ${infoItem(
                  "Has direct contact",
                  safeArray(person?.contacts).some((contact) => textOrNull(contact?.value)) ? "Yes" : "No"
                )}
              </div>
            </article>

            <article class="company-section-card company-section-card-span-2">
              <div class="company-section-card-head">
                <div>
                  <p class="company-card-eyebrow">Addresses</p>
                  <h3>Known company locations</h3>
                </div>
              </div>
              ${
                addresses.length
                  ? `<div class="company-tag-grid person-address-grid">${addresses.map((address) => addressCardMarkup(address)).join("")}</div>`
                  : '<p class="company-empty-copy">No company address records are available for this person.</p>'
              }
            </article>
          </div>
        </div>
      </section>

      <section class="company-section-grid" id="person-financial">
        <div class="company-section-heading">
          <p class="company-section-eyebrow">Tax & financial</p>
          <h2>Company-linked turnover, tax, and profitability</h2>
          <p>This section translates the iOS tax-information tab into website sections: EMTA turnover, tax debt, yearly revenue, and profitability by linked company.</p>
        </div>
        <div class="company-section-content">
          <div class="company-subsection-stack">
            ${
              companiesData.length
                ? companiesData.map((companyData) => buildCompanyFinancialSection(person, companyData)).join("")
                : '<article class="company-section-card"><p class="company-empty-copy">No company tax or financial records are available for this person.</p></article>'
            }
          </div>
        </div>
      </section>
    </div>
  `;
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
  } catch (error) {
    renderState(`<p class="detail-state">${escapeHtml(error instanceof Error ? error.message : "Failed to load person.")}</p>`);
  }
}

void loadPerson();
