const API_ENDPOINT = "/api/filters";
const API_BASE_URL = "https://leadlistscraper-524b3d937ddd.herokuapp.com";
const COUNT_DEBOUNCE_MS = 450;
const MAX_FILTER_RESULTS = 120;
const LEGAL_FORMS = [
  "AMETÜ", "AS", "AVOIG", "EMÜ", "ERAK", "FIE", "FIL", "KOVAS",
  "KÜ", "MPÜ", "MTÜ", "OÜ", "SA", "SCE", "SE", "TKR", "TRAS",
  "TÜ", "TÜH", "UÜ",
];
const YEAR_OPTIONS = Array.from({ length: 2024 - 1991 + 1 }, (_, index) => String(1991 + index)).reverse();
const STATUS_OPTIONS = [
  { value: "R", label: "Registered" },
  { value: "L", label: "In Liquidation" },
  { value: "N", label: "Bankruptcy" },
  { value: "K", label: "Deleted" },
];
const FILTER_ORDER = [
  "location",
  "emtak_codes",
  "employees",
  "turnover",
  "legal_forms",
  "status",
  "tax_information",
  "registration",
  "annual_reports",
  "beneficiaries",
  "board_members",
  "website_available",
  "economic_activity",
  "operating_licences",
];
const EMPLOYEE_PRESETS = [
  { label: "0-10", min: "", max: "10" },
  { label: "11-25", min: "11", max: "25" },
  { label: "26-50", min: "26", max: "50" },
  { label: "51-100", min: "51", max: "100" },
  { label: "100-250", min: "100", max: "250" },
  { label: "251-500", min: "251", max: "500" },
  { label: "500-1K", min: "500", max: "1000" },
  { label: "1K+", min: "1001", max: "" },
];

const countFormatter = new Intl.NumberFormat("en-US");

const appState = {
  configLoaded: false,
  countStatus: "idle",
  countMessage: "Loading filter configuration and legends.",
  countValue: null,
  debounceTimer: null,
  activeRequest: null,
  filtersConfig: [],
  availableTypes: new Set(),
  legends: null,
  locationTree: [],
  emtakTree: [],
  search: {
    deletionReasons: "",
    economicActivities: "",
    operatingLicences: "",
  },
  selection: {
    locationsMode: "include",
    locationKeys: new Set(),
    emtakMode: "include",
    emtakCodes: new Set(),
    legalFormsMode: "include",
    legalForms: new Set(),
    statusMode: "include",
    statuses: new Set(),
    deletionReasonMode: "include",
    deletionReasons: new Set(),
    yearsSubmitted: new Set(),
    yearsNotSubmitted: new Set(),
    economicActivities: new Set(),
    operatingLicences: new Set(),
    annualReportsLatest: "skip",
    beneficiariesForeigners: "skip",
    beneficiariesEresidents: "skip",
    beneficiariesPermanentResidents: "skip",
    boardMembersForeigners: "skip",
    boardMembersEresidents: "skip",
    boardMembersPermanentResidents: "skip",
    vatRegistered: "skip",
    taxDebt: "skip",
    websiteAvailable: "skip",
  },
};

const el = {};
let floatingSummaryTicking = false;

document.addEventListener("DOMContentLoaded", async () => {
  cacheElements();
  bindStaticEvents();
  setupFloatingSummary();
  setupSectionNavigation();
  renderStaticChoices();
  await loadFiltersPage();
});

function cacheElements() {
  const ids = [
    "companies-count-value",
    "count-status-text",
    "active-filter-chips",
    "active-filter-empty",
    "filters-hero-section",
    "count-card",
    "floating-count-card",
    "floating-companies-count-value",
    "floating-count-status-text",
    "floating-active-filter-chips",
    "reset-filters-button",
    "reset-filters-button-floating",
    "selected-locations",
    "location-results",
    "employees-presets",
    "selected-emtak-codes",
    "emtak-results",
    "legal-forms-grid",
    "status-grid",
    "status-detail-block",
    "deletion-reason-search",
    "selected-deletion-reasons",
    "deletion-reason-results",
    "deletion-date-grid",
    "years-submitted-grid",
    "years-not-submitted-grid",
    "selected-economic-activities",
    "economic-activity-search",
    "economic-activity-results",
    "selected-operating-licences",
    "operating-licence-search",
    "operating-licence-results",
  ];

  ids.forEach((id) => {
    el[id] = document.getElementById(id);
  });
}

function bindStaticEvents() {
  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);
  document.addEventListener("change", handleChange);
  el["reset-filters-button"].addEventListener("click", resetAllFilters);
  el["reset-filters-button-floating"].addEventListener("click", resetAllFilters);
}

function renderStaticChoices() {
  el["employees-presets"].innerHTML = EMPLOYEE_PRESETS.map((preset) => `
    <button
      class="toggle-pill employee-preset"
      type="button"
      data-employee-preset="${escapeAttribute(preset.label)}"
      data-preset-min="${escapeAttribute(preset.min)}"
      data-preset-max="${escapeAttribute(preset.max)}"
    >
      ${escapeHtml(preset.label)}
    </button>
  `).join("");

  el["legal-forms-grid"].innerHTML = LEGAL_FORMS.map((form) => selectablePill({
    label: form,
    dataset: `data-legal-form="${escapeAttribute(form)}"`,
  })).join("");

  el["status-grid"].innerHTML = STATUS_OPTIONS.map((status) => selectablePill({
    label: status.label,
    dataset: `data-status-value="${status.value}"`,
  })).join("");

  el["years-submitted-grid"].innerHTML = YEAR_OPTIONS.map((year) => selectablePill({
    label: year,
    dataset: `data-year-submitted="${year}"`,
  })).join("");

  el["years-not-submitted-grid"].innerHTML = YEAR_OPTIONS.map((year) => selectablePill({
    label: year,
    dataset: `data-year-not-submitted="${year}"`,
  })).join("");
}

async function loadFiltersPage() {
  try {
    setCountState("loading", null, "Loading filter configuration and legends.");
    const payload = await fetchFiltersBootstrap();
    appState.filtersConfig = Array.isArray(payload.filtersConfiguration) ? payload.filtersConfiguration : [];
    appState.availableTypes = new Set(
      appState.filtersConfig
        .filter((entry) => entry && entry.status !== "disabled")
        .map((entry) => entry.type)
    );
    appState.legends = payload.legends || {};
    appState.locationTree = normalizeLocationTree(appState.legends.locations || []);
    appState.emtakTree = normalizeEmtakTree(appState.legends.emtaks || []);
    appState.configLoaded = true;

    syncAvailableSections();
    renderDynamicLists();
    setCountState("idle", null, "Add at least one filter to fetch a live company count.");
  } catch (error) {
    setCountState("error", null, error instanceof Error ? error.message : "Failed to load filters page.");
  }
}

function syncAvailableSections() {
  document.querySelectorAll("[data-filter-type]").forEach((node) => {
    const type = node.getAttribute("data-filter-type");
    const supported = FILTER_ORDER.includes(type);
    node.hidden = !supported || !appState.availableTypes.has(type);
  });
}

function handleClick(event) {
  const segmented = event.target.closest("[data-segmented] button");
  if (segmented) {
    updateSegmented(segmented);
    return;
  }

  const locationNodeButton = event.target.closest(".tree-select-button[data-location-node]");
  if (locationNodeButton) {
    toggleLocationNodeSelection(locationNodeButton.getAttribute("data-location-node"));
    refreshSelectionsAndCount();
    return;
  }

  const locationExpandButton = event.target.closest(".location-node[data-location-expand]");
  if (locationExpandButton) {
    toggleLocationExpanded(locationExpandButton.getAttribute("data-location-expand"));
    return;
  }

  const emtakNodeButton = event.target.closest(".tree-select-button[data-emtak-node]");
  if (emtakNodeButton) {
    toggleEmtakNodeSelection(emtakNodeButton.getAttribute("data-emtak-node"));
    refreshSelectionsAndCount();
    return;
  }

  const emtakExpandButton = event.target.closest(".emtak-node[data-emtak-expand]");
  if (emtakExpandButton) {
    toggleEmtakExpanded(emtakExpandButton.getAttribute("data-emtak-expand"));
    return;
  }

  const employeePresetButton = event.target.closest("[data-employee-preset]");
  if (employeePresetButton) {
    applyEmployeePreset(
      employeePresetButton.getAttribute("data-preset-min"),
      employeePresetButton.getAttribute("data-preset-max")
    );
    refreshSelectionsAndCount();
    return;
  }

  const deletionReasonButton = event.target.closest("[data-deletion-reason-id]");
  if (deletionReasonButton) {
    toggleSetValue(appState.selection.deletionReasons, deletionReasonButton.getAttribute("data-deletion-reason-id"));
    refreshSelectionsAndCount();
    return;
  }

  const legalFormButton = event.target.closest("[data-legal-form]");
  if (legalFormButton) {
    toggleSetValue(appState.selection.legalForms, legalFormButton.getAttribute("data-legal-form"));
    refreshSelectionsAndCount();
    return;
  }

  const statusButton = event.target.closest("[data-status-value]");
  if (statusButton) {
    toggleSetValue(appState.selection.statuses, statusButton.getAttribute("data-status-value"));
    refreshSelectionsAndCount();
    return;
  }

  const yearSubmittedButton = event.target.closest("[data-year-submitted]");
  if (yearSubmittedButton) {
    toggleSetValue(appState.selection.yearsSubmitted, yearSubmittedButton.getAttribute("data-year-submitted"));
    refreshSelectionsAndCount();
    return;
  }

  const yearNotSubmittedButton = event.target.closest("[data-year-not-submitted]");
  if (yearNotSubmittedButton) {
    toggleSetValue(appState.selection.yearsNotSubmitted, yearNotSubmittedButton.getAttribute("data-year-not-submitted"));
    refreshSelectionsAndCount();
    return;
  }

  const economicActivityButton = event.target.closest("[data-economic-activity]");
  if (economicActivityButton) {
    toggleSetValue(appState.selection.economicActivities, economicActivityButton.getAttribute("data-economic-activity"));
    refreshSelectionsAndCount();
    return;
  }

  const operatingLicenceButton = event.target.closest("[data-operating-licence]");
  if (operatingLicenceButton) {
    toggleSetValue(appState.selection.operatingLicences, operatingLicenceButton.getAttribute("data-operating-licence"));
    refreshSelectionsAndCount();
    return;
  }

  const removeChip = event.target.closest("[data-remove-chip]");
  if (removeChip) {
    removeChipValue(removeChip.getAttribute("data-remove-chip"), removeChip.getAttribute("data-remove-value"));
  }
}

function handleInput(event) {
  const { id, value } = event.target;
  if (id === "deletion-reason-search") {
    appState.search.deletionReasons = value.trim();
    renderDeletionReasonResults();
    return;
  }
  if (id === "economic-activity-search") {
    appState.search.economicActivities = value.trim();
    renderEconomicActivityResults();
    return;
  }
  if (id === "operating-licence-search") {
    appState.search.operatingLicences = value.trim();
    renderOperatingLicenceResults();
    return;
  }
  scheduleCountRefresh();
}

function handleChange(event) {
  if (event.target.matches("input[type='number'], input[type='date']")) {
    scheduleCountRefresh();
  }
}

function updateSegmented(button) {
  const parent = button.closest("[data-segmented]");
  const key = parent.getAttribute("data-segmented");
  const value = button.getAttribute("data-option-value");

  parent.querySelectorAll("button").forEach((item) => {
    item.classList.toggle("is-active", item === button);
  });

  switch (key) {
    case "locations-mode":
      appState.selection.locationsMode = value;
      break;
    case "emtak-mode":
      appState.selection.emtakMode = value;
      break;
    case "legal-forms-mode":
      appState.selection.legalFormsMode = value;
      break;
    case "status-mode":
      appState.selection.statusMode = value;
      break;
    case "deletion-reason-mode":
      appState.selection.deletionReasonMode = value;
      break;
    case "annual-reports-latest":
      appState.selection.annualReportsLatest = value;
      break;
    case "beneficiaries-foreigners":
      appState.selection.beneficiariesForeigners = value;
      break;
    case "beneficiaries-eresidents":
      appState.selection.beneficiariesEresidents = value;
      break;
    case "beneficiaries-permanent-residents":
      appState.selection.beneficiariesPermanentResidents = value;
      break;
    case "board-members-foreigners":
      appState.selection.boardMembersForeigners = value;
      break;
    case "board-members-eresidents":
      appState.selection.boardMembersEresidents = value;
      break;
    case "board-members-permanent-residents":
      appState.selection.boardMembersPermanentResidents = value;
      break;
    case "vat-registered":
      appState.selection.vatRegistered = value;
      break;
    case "tax-debt":
      appState.selection.taxDebt = value;
      break;
    case "website-available":
      appState.selection.websiteAvailable = value;
      break;
    default:
      break;
  }

  refreshSelectionsAndCount();
}

function refreshSelectionsAndCount() {
  renderDynamicLists();
  scheduleCountRefresh();
}

function renderDynamicLists() {
  renderLocationResults();
  renderLocationPills();
  renderEmtakResults();
  renderEmtakPills();
  refreshEmployeePresets();
  renderDeletionReasonResults();
  renderDeletionReasonPills();
  renderEconomicActivityResults();
  renderEconomicActivityPills();
  renderOperatingLicenceResults();
  renderOperatingLicencePills();
  refreshTogglePills();
  refreshStatusDetailVisibility();
  updateActiveFilterSummary();
}

function renderLocationResults() {
  el["location-results"].innerHTML = renderLocationTree(appState.locationTree);
}

function renderLocationPills() {
  if (!el["selected-locations"]) return;
  const values = Array.from(appState.selection.locationKeys)
    .map((key) => locationLabelForKey(key))
    .filter(Boolean);
  el["selected-locations"].innerHTML = renderSelectedPills("location", values);
}

function renderEmtakResults() {
  el["emtak-results"].innerHTML = renderEmtakTree(appState.emtakTree);
}

function renderEmtakPills() {
  if (!el["selected-emtak-codes"]) return;
  const values = Array.from(appState.selection.emtakCodes).map((code) => ({
    value: code,
    label: `${code} ${emtakLabelForCode(code)}`,
  }));
  el["selected-emtak-codes"].innerHTML = renderSelectedPills("emtak", values);
}

function refreshEmployeePresets() {
  const min = valueOf("employees-min");
  const max = valueOf("employees-max");
  document.querySelectorAll("[data-employee-preset]").forEach((node) => {
    const matches = node.getAttribute("data-preset-min") === min && node.getAttribute("data-preset-max") === max;
    node.classList.toggle("is-active", matches);
  });
}

function renderDeletionReasonResults() {
  const reasons = (appState.legends?.deletion_reasons || appState.legends?.deletionReasons || []);
  const normalized = reasons.map((item) => ({
    id: String(item.id),
    label: item?.text?.en || item?.text?.et || String(item.id),
    searchText: `${item?.text?.en || ""} ${item?.text?.et || ""} ${item.id}`.toLowerCase(),
  }));
  const results = filterBySearch(normalized, appState.search.deletionReasons);
  el["deletion-reason-results"].innerHTML = renderResultButtons(results.slice(0, MAX_FILTER_RESULTS), (item) => ({
    label: `<strong>#${escapeHtml(item.id)}</strong><span>${escapeHtml(item.label)}</span>`,
    dataset: `data-deletion-reason-id="${item.id}"`,
    active: appState.selection.deletionReasons.has(item.id),
  }));
}

function renderDeletionReasonPills() {
  const reasons = (appState.legends?.deletion_reasons || appState.legends?.deletionReasons || []);
  const values = Array.from(appState.selection.deletionReasons).map((id) => {
    const reason = reasons.find((item) => String(item.id) === id);
    return {
      value: id,
      label: reason ? `#${id} · ${reason.text?.en || reason.text?.et || id}` : id,
    };
  });
  el["selected-deletion-reasons"].innerHTML = renderSelectedPills("deletionReason", values);
}

function renderEconomicActivityResults() {
  const items = mapLocalizedEntries(appState.legends?.economic_activities || appState.legends?.economicActivities || {});
  const results = filterBySearch(items, appState.search.economicActivities);
  el["economic-activity-results"].innerHTML = renderResultButtons(results.slice(0, MAX_FILTER_RESULTS), (item) => ({
    label: `<span>${escapeHtml(item.caption || item.label)}</span>`,
    dataset: `data-economic-activity="${escapeAttribute(item.value)}"`,
    active: appState.selection.economicActivities.has(item.value),
  }));
}

function renderEconomicActivityPills() {
  const values = Array.from(appState.selection.economicActivities).map((value) => ({
    value,
    label: value,
  }));
  el["selected-economic-activities"].innerHTML = renderSelectedPills("economicActivity", values);
}

function renderOperatingLicenceResults() {
  const items = mapLocalizedEntries(appState.legends?.operating_licences || appState.legends?.operatingLicences || {});
  const results = filterBySearch(items, appState.search.operatingLicences);
  el["operating-licence-results"].innerHTML = renderResultButtons(results.slice(0, MAX_FILTER_RESULTS), (item) => ({
    label: `<span>${escapeHtml(item.caption || item.label)}</span>`,
    dataset: `data-operating-licence="${escapeAttribute(item.value)}"`,
    active: appState.selection.operatingLicences.has(item.value),
  }));
}

function renderOperatingLicencePills() {
  const values = Array.from(appState.selection.operatingLicences).map((value) => ({
    value,
    label: value,
  }));
  el["selected-operating-licences"].innerHTML = renderSelectedPills("operatingLicence", values);
}

function refreshTogglePills() {
  syncPillSelection("[data-legal-form]", appState.selection.legalForms);
  syncPillSelection("[data-status-value]", appState.selection.statuses);
  syncPillSelection("[data-year-submitted]", appState.selection.yearsSubmitted);
  syncPillSelection("[data-year-not-submitted]", appState.selection.yearsNotSubmitted);
}

function refreshStatusDetailVisibility() {
  const selectedStatuses = appState.selection.statuses;
  const showReasons = selectedStatuses.has("K") || selectedStatuses.has("L");
  const showDates = selectedStatuses.has("K");
  el["status-detail-block"].hidden = !showReasons && !showDates;
  el["deletion-date-grid"].hidden = !showDates;
}

function updateActiveFilterSummary() {
  const labels = activeFilterLabels();
  const chips = labels.map((label) => `<span>${escapeHtml(label)}</span>`);
  el["active-filter-chips"].innerHTML = chips.join("");
  el["active-filter-chips"].hidden = labels.length === 0;
  el["active-filter-empty"].hidden = labels.length > 0;
  el["reset-filters-button"].hidden = labels.length === 0;
  el["active-filter-empty"]?.closest(".filters-applied-card")?.classList.toggle("is-empty", labels.length === 0);
  el["floating-active-filter-chips"].innerHTML = chips.length
    ? chips.join("")
    : '<span class="filters-floating-empty">No filters selected</span>';
}

function scheduleCountRefresh() {
  window.clearTimeout(appState.debounceTimer);
  appState.debounceTimer = window.setTimeout(requestCount, COUNT_DEBOUNCE_MS);
}

async function requestCount() {
  if (!appState.configLoaded) return;

  const payload = buildCheckDataCountPayload();
  if (!payload) {
    setCountState("idle", null, "Add at least one filter to fetch a live company count.");
    return;
  }

  if (!isValidPayload(payload)) {
    setCountState("error", null, "The current filter combination is incomplete or invalid.");
    return;
  }

  if (appState.activeRequest) {
    appState.activeRequest.abort();
  }

  const controller = new AbortController();
  appState.activeRequest = controller;
  setCountState("loading", null, "Updating live company count.");

  try {
    const data = await postCountPayload(payload, controller.signal);
    const count = Number.parseInt(data.message, 10);
    if (Number.isNaN(count)) {
      throw new Error("Count response was not numeric.");
    }

    setCountState("success", count, "Live company count from the same endpoint used by the iOS app.");
  } catch (error) {
    if (controller.signal.aborted) {
      return;
    }
    setCountState("error", null, error instanceof Error ? error.message : "Failed to fetch company count.");
  } finally {
    if (appState.activeRequest === controller) {
      appState.activeRequest = null;
    }
  }
}

function setCountState(status, count, message) {
  appState.countStatus = status;
  appState.countValue = count ?? appState.countValue;
  appState.countMessage = message;
  const countMarkup = status === "loading"
    ? '<span class="count-loading-dot"></span>'
    : appState.countValue == null
      ? "0"
      : countFormatter.format(appState.countValue);
  el["companies-count-value"].innerHTML = countMarkup;
  el["floating-companies-count-value"].textContent = countMarkup.includes("count-loading-dot")
    ? "..."
    : countMarkup;
  el["count-status-text"].textContent = message;
}

function setupFloatingSummary() {
  if (!el["filters-hero-section"] || !el["floating-count-card"]) return;

  const syncVisibility = () => {
    const heroRect = el["filters-hero-section"].getBoundingClientRect();
    const shouldShow = window.innerWidth > 1120 && heroRect.bottom <= 112;
    el["floating-count-card"].hidden = !shouldShow;
    el["floating-count-card"].classList.toggle("is-visible", shouldShow);
  };

  const requestSyncVisibility = () => {
    if (floatingSummaryTicking) return;
    floatingSummaryTicking = true;
    window.requestAnimationFrame(() => {
      floatingSummaryTicking = false;
      syncVisibility();
    });
  };

  window.addEventListener("resize", requestSyncVisibility);
  window.addEventListener("scroll", requestSyncVisibility, { passive: true });
  syncVisibility();
}

function setupSectionNavigation() {
  const tocLinks = Array.from(document.querySelectorAll(".filters-toc a[href^='#']"));
  if (!tocLinks.length) return;

  const sections = tocLinks
    .map((link) => {
      const section = document.querySelector(link.getAttribute("href"));
      const head = section?.querySelector(".filters-section-head");
      return section && head ? { section, head, link } : null;
    })
    .filter(Boolean);
  if (!sections.length) return;

  const setActiveLink = (activeSection) => {
    tocLinks.forEach((link) => {
      const isActive = sections.find((entry) => entry.section === activeSection)?.link === link;
      link.classList.toggle("is-active", isActive);
    });
  };

  tocLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const target = sections.find((entry) => entry.link === link);
      if (target) {
        setActiveLink(target.section);
      }
    });
  });

  let ticking = false;
  const syncActiveSection = () => {
    ticking = false;
    const topbar = document.querySelector(".topbar");
    const toolbarLine = (topbar?.getBoundingClientRect().bottom || 0) + 12;
    const containingSection = sections.find((entry) => {
      const rect = entry.section.getBoundingClientRect();
      return rect.top <= toolbarLine && rect.bottom > toolbarLine;
    });
    const firstVisible = sections.find((entry) => entry.head.getBoundingClientRect().top >= toolbarLine);
    const activeSection = containingSection?.section || firstVisible?.section || sections[sections.length - 1].section;

    setActiveLink(activeSection);
  };

  const requestSync = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(syncActiveSection);
  };

  window.addEventListener("scroll", requestSync, { passive: true });
  window.addEventListener("resize", requestSync);
  syncActiveSection();
}

async function fetchFiltersBootstrap() {
  const localResponse = await fetch(API_ENDPOINT).catch(() => null);
  if (localResponse?.ok) {
    return localResponse.json();
  }

  if (localResponse && localResponse.status !== 404) {
    throw new Error(`Failed to load filters data: ${localResponse.status}`);
  }

  const [filtersConfiguration, legends] = await Promise.all([
    fetchJson(`${API_BASE_URL}/api/filters-configuration`),
    fetchJson(`${API_BASE_URL}/api/legends`),
  ]);

  return {
    filtersConfiguration: filtersConfiguration.message || [],
    legends: legends.message || {},
  };
}

async function postCountPayload(payload, signal) {
  const localResponse = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  }).catch(() => null);

  if (localResponse?.ok) {
    return localResponse.json();
  }

  if (localResponse && localResponse.status !== 404) {
    throw new Error(`Count request failed: ${localResponse.status}`);
  }

  return fetchJson(`${API_BASE_URL}/api/count-companies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function buildCheckDataCountPayload() {
  const payload = {};

  const annualReportsLatest = optionToBoolean(appState.selection.annualReportsLatest);
  const yearsSubmitted = Array.from(appState.selection.yearsSubmitted);
  const yearsNotSubmitted = Array.from(appState.selection.yearsNotSubmitted);
  if (annualReportsLatest !== null || yearsSubmitted.length || yearsNotSubmitted.length) {
    payload.annual_reports = {
      latest_submitted: annualReportsLatest,
      years_submitted: yearsSubmitted.length ? yearsSubmitted : undefined,
      years_not_submitted: yearsNotSubmitted.length ? yearsNotSubmitted : undefined,
    };
  }

  const beneficiaries = numericRangePayload({
    min: valueOf("beneficiaries-min"),
    max: valueOf("beneficiaries-max"),
    ageMin: valueOf("beneficiaries-age-min"),
    ageMax: valueOf("beneficiaries-age-max"),
    includeForeigners: optionToBoolean(appState.selection.beneficiariesForeigners),
    includeEresidents: optionToBoolean(appState.selection.beneficiariesEresidents),
    includePermanentResidents: optionToBoolean(appState.selection.beneficiariesPermanentResidents),
  }, {
    ageMin: "age_min",
    ageMax: "age_max",
    includeForeigners: "include_foreigners",
    includeEresidents: "include_eresidents",
    includePermanentResidents: "include_permanent_residents",
  });
  if (beneficiaries) {
    payload.beneficiaries = beneficiaries;
  }

  const boardMembers = numericRangePayload({
    min: valueOf("board-members-min"),
    max: valueOf("board-members-max"),
    ageMin: valueOf("board-members-age-min"),
    ageMax: valueOf("board-members-age-max"),
    includeForeigners: optionToBoolean(appState.selection.boardMembersForeigners),
    includeEresidents: optionToBoolean(appState.selection.boardMembersEresidents),
    includePermanentResidents: optionToBoolean(appState.selection.boardMembersPermanentResidents),
  }, {
    ageMin: "age_min",
    ageMax: "age_max",
    includeForeigners: "include_foreigners",
    includeEresidents: "include_eresidents",
    includePermanentResidents: "include_permanent_residents",
  });
  if (boardMembers) {
    payload.board_members = boardMembers;
  }

  const emtakCodes = Array.from(appState.selection.emtakCodes);
  if (emtakCodes.length) {
    payload.emtak_codes = {
      mode: "include",
      values: emtakCodes,
    };
  }

  const employees = numericRangePayload({
    min: valueOf("employees-min"),
    max: valueOf("employees-max"),
  });
  if (employees) {
    payload.employees = employees;
  }

  const legalForms = Array.from(appState.selection.legalForms);
  if (legalForms.length) {
    payload.legal_forms = {
      mode: "include",
      values: legalForms,
    };
  }

  const registrationBefore = formatDateForRequest(valueOf("registration-before"));
  const registrationAfter = formatDateForRequest(valueOf("registration-after"));
  if (registrationBefore || registrationAfter) {
    payload.registration = {
      before: registrationBefore || undefined,
      after: registrationAfter || undefined,
    };
  }

  const statuses = Array.from(appState.selection.statuses);
  if (statuses.length) {
    const deletionReasons = Array.from(appState.selection.deletionReasons).map((value) => Number.parseInt(value, 10));
    const deletionDateBefore = formatDateForRequest(valueOf("deletion-date-before"));
    const deletionDateAfter = formatDateForRequest(valueOf("deletion-date-after"));
    payload.status = {
      mode: "include",
      values: statuses,
      deletion_reason: deletionReasons.length
        ? { mode: appState.selection.deletionReasonMode, values: deletionReasons }
        : undefined,
      deletion_date: deletionDateBefore || deletionDateAfter
        ? { before: deletionDateBefore || undefined, after: deletionDateAfter || undefined }
        : undefined,
    };
  }

  const vatRegistered = optionToBoolean(appState.selection.vatRegistered);
  const taxDebt = optionToBoolean(appState.selection.taxDebt);
  if (vatRegistered !== null || taxDebt !== null) {
    payload.tax_information = {
      vat_registered: vatRegistered,
      tax_debt: taxDebt,
    };
  }

  const turnovers = {};
  const lastFourQuarters = numericRangePayload({
    min: valueOf("turnover-last-four-min"),
    max: valueOf("turnover-last-four-max"),
  });
  const lastQuarter = numericRangePayload({
    min: valueOf("turnover-last-quarter-min"),
    max: valueOf("turnover-last-quarter-max"),
  });
  if (lastFourQuarters) turnovers.last_four_quarters = lastFourQuarters;
  if (lastQuarter) turnovers.last_quarter = lastQuarter;
  if (Object.keys(turnovers).length) {
    payload.turnovers = turnovers;
  }

  const websiteAvailable = optionToBoolean(appState.selection.websiteAvailable);
  if (websiteAvailable !== null) {
    payload.website_available = websiteAvailable;
  }

  const locationPayload = buildLocationPayload();
  if (locationPayload.length) {
    payload.location = {
      mode: "include",
      counties: locationPayload,
    };
  }

  const operatingLicences = Array.from(appState.selection.operatingLicences);
  if (operatingLicences.length) {
    payload.operating_licences = operatingLicences;
  }

  const economicActivities = Array.from(appState.selection.economicActivities);
  if (economicActivities.length) {
    payload.economic_activities = economicActivities;
  }

  return Object.keys(payload).length ? stripUndefinedDeep(payload) : null;
}

function buildLocationPayload() {
  const countyMap = new Map();

  Array.from(appState.selection.locationKeys).forEach((key) => {
    const parts = key.split("::");
    const type = parts[0];
    const countyName = parts[1];
    const cityName = parts[2];
    const neighborhoodName = parts[3];

    if (!countyMap.has(countyName)) {
      countyMap.set(countyName, { name: countyName, cities: new Map(), full: false });
    }
    const county = countyMap.get(countyName);

    if (type === "county") {
      county.full = true;
      county.cities.clear();
      return;
    }

    if (county.full) return;

    if (!county.cities.has(cityName)) {
      county.cities.set(cityName, { name: cityName, neighborhoods: new Map(), full: false });
    }
    const city = county.cities.get(cityName);

    if (type === "city") {
      city.full = true;
      city.neighborhoods.clear();
      return;
    }

    if (city.full) return;
    city.neighborhoods.set(neighborhoodName, { name: neighborhoodName });
  });

  return Array.from(countyMap.values()).map((county) => {
    if (county.full) {
      return { name: county.name };
    }
    return {
      name: county.name,
      cities: Array.from(county.cities.values()).map((city) => (
        city.full
          ? { name: city.name }
          : { name: city.name, neighborhoods: Array.from(city.neighborhoods.values()) }
      )),
    };
  });
}

function isValidPayload(payload) {
  if (
    payload.annual_reports &&
    payload.annual_reports.latest_submitted == null &&
    !payload.annual_reports.years_submitted &&
    !payload.annual_reports.years_not_submitted
  ) {
    return false;
  }
  if (payload.emtak_codes && !payload.emtak_codes.values?.length) return false;
  if (payload.legal_forms && !payload.legal_forms.values?.length) return false;
  if (payload.status && !payload.status.values?.length) return false;
  if (payload.location && !payload.location.counties?.length) return false;
  if (payload.turnovers && !payload.turnovers.last_four_quarters && !payload.turnovers.last_quarter) return false;
  return true;
}

function resetAllFilters() {
  document.querySelectorAll("input[type='number'], input[type='date'], input[type='search']").forEach((input) => {
    input.value = "";
  });

  resetSegment("locations-mode", "include");
  resetSegment("emtak-mode", "include");
  resetSegment("legal-forms-mode", "include");
  resetSegment("status-mode", "include");
  resetSegment("deletion-reason-mode", "include");
  resetSegment("annual-reports-latest", "skip");
  resetSegment("beneficiaries-foreigners", "skip");
  resetSegment("beneficiaries-eresidents", "skip");
  resetSegment("beneficiaries-permanent-residents", "skip");
  resetSegment("board-members-foreigners", "skip");
  resetSegment("board-members-eresidents", "skip");
  resetSegment("board-members-permanent-residents", "skip");
  resetSegment("vat-registered", "skip");
  resetSegment("tax-debt", "skip");
  resetSegment("website-available", "skip");

  appState.search = {
    deletionReasons: "",
    economicActivities: "",
    operatingLicences: "",
  };

  appState.selection.locationKeys.clear();
  appState.selection.emtakCodes.clear();
  appState.selection.legalForms.clear();
  appState.selection.statuses.clear();
  appState.selection.deletionReasons.clear();
  appState.selection.yearsSubmitted.clear();
  appState.selection.yearsNotSubmitted.clear();
  appState.selection.economicActivities.clear();
  appState.selection.operatingLicences.clear();

  refreshSelectionsAndCount();
}

function resetSegment(key, value) {
  const container = document.querySelector(`[data-segmented="${key}"]`);
  if (!container) return;
  container.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("is-active", button.getAttribute("data-option-value") === value);
  });
  updateSegmented(container.querySelector(`[data-option-value="${value}"]`));
}

function toggleLocationSelection(key) {
  const [type, county, city] = key.split("::");
  const selection = appState.selection.locationKeys;

  if (selection.has(key)) {
    selection.delete(key);
    refreshSelectionsAndCount();
    return;
  }

  if (type === "county") {
    Array.from(selection).forEach((entry) => {
      if (entry.startsWith(`county::${county}`) || entry.startsWith(`city::${county}::`) || entry.startsWith(`neighborhood::${county}::`)) {
        selection.delete(entry);
      }
    });
    selection.add(key);
  } else if (type === "city") {
    selection.delete(`county::${county}`);
    Array.from(selection).forEach((entry) => {
      if (entry.startsWith(`city::${county}::${city}`) || entry.startsWith(`neighborhood::${county}::${city}::`)) {
        selection.delete(entry);
      }
    });
    selection.add(key);
  } else if (type === "neighborhood") {
    selection.delete(`county::${county}`);
    selection.delete(`city::${county}::${city}`);
    selection.add(key);
  }

  refreshSelectionsAndCount();
}

function toggleSetValue(targetSet, value) {
  if (targetSet.has(value)) {
    targetSet.delete(value);
  } else {
    targetSet.add(value);
  }
}

function removeChipValue(type, value) {
  switch (type) {
    case "location":
      appState.selection.locationKeys.delete(value);
      break;
    case "emtak":
      appState.selection.emtakCodes.delete(value);
      break;
    case "deletionReason":
      appState.selection.deletionReasons.delete(value);
      break;
    case "economicActivity":
      appState.selection.economicActivities.delete(value);
      break;
    case "operatingLicence":
      appState.selection.operatingLicences.delete(value);
      break;
    default:
      break;
  }
  refreshSelectionsAndCount();
}

function activeFilterLabels() {
  const labels = [];
  const payload = buildCheckDataCountPayload();
  if (!payload) return labels;

  if (payload.location) labels.push(`${payload.location.counties.length} location ${payload.location.counties.length === 1 ? "group" : "groups"}`);
  if (payload.emtak_codes) labels.push(`${payload.emtak_codes.values.length} EMTAK`);
  if (payload.legal_forms) labels.push(`${payload.legal_forms.values.length} legal forms`);
  if (payload.status) labels.push(`${payload.status.values.length} statuses`);
  if (payload.operating_licences) labels.push(`${payload.operating_licences.length} licences`);
  if (payload.economic_activities) labels.push(`${payload.economic_activities.length} activities`);
  if (payload.annual_reports) labels.push("annual reports");
  if (payload.beneficiaries) labels.push("beneficiaries");
  if (payload.board_members) labels.push("board members");
  if (payload.turnovers) labels.push("turnover");
  if (payload.tax_information) labels.push("tax");
  if (payload.registration) labels.push("registration");
  if (payload.website_available !== undefined) labels.push("website");
  if (payload.employees) labels.push("employees");
  return labels;
}

function mapLocalizedEntries(entries) {
  return Object.entries(entries).map(([key, value]) => ({
    value: key,
    label: value?.en || key,
    caption: value?.et && value.et !== value.en ? value.et : "Live legend",
    searchText: `${key} ${value?.en || ""} ${value?.et || ""}`.toLowerCase(),
  }));
}

function filterBySearch(items, term) {
  if (!term) return items;
  const query = term.toLowerCase();
  return items.filter((item) => item.searchText.includes(query));
}

function renderResultButtons(items, mapFn) {
  if (!items.length) {
    return '<p class="empty-inline">No matches yet. Try a broader search.</p>';
  }
  return items.map((item) => {
    const mapped = mapFn(item);
    return `
      <button class="result-row${mapped.active ? " is-active" : ""}" type="button" ${mapped.dataset}>
        ${mapped.label}
      </button>
    `;
  }).join("");
}

function renderSelectedPills(type, values) {
  if (!values.length) {
    return '<p class="empty-inline">Nothing selected.</p>';
  }
  return values.map((entry) => {
    const item = typeof entry === "string" ? { value: entry, label: entry } : entry;
    return `
      <button class="selected-pill" type="button" data-remove-chip="${type}" data-remove-value="${escapeAttribute(item.value)}">
        <span>${escapeHtml(item.label)}</span>
        <strong>&times;</strong>
      </button>
    `;
  }).join("");
}

function selectablePill({ label, dataset }) {
  return `<button class="toggle-pill" type="button" ${dataset}>${escapeHtml(label)}</button>`;
}

function syncPillSelection(selector, targetSet) {
  document.querySelectorAll(selector).forEach((node) => {
    const value = Object.values(node.dataset)[0];
    node.classList.toggle("is-active", targetSet.has(value));
  });
}

function locationLabelForKey(key) {
  const item = findLocationNode(key, appState.locationTree);
  if (!item) return null;
  return { value: key, label: item.label };
}

function emtakLabelForCode(code) {
  const item = findEmtakNode(code, appState.emtakTree);
  return item?.description || "EMTAK";
}

function normalizeEmtakTree(nodes) {
  return nodes.map((node) => ({
    code: node.Code || node.code || "",
    description: node.DescriptionEn || node.descriptionEn || node.DescriptionEt || node.descriptionEt || "",
    children: normalizeEmtakTree(node.children || []),
    expanded: false,
  }));
}

function renderEmtakTree(nodes, level = 0) {
  if (!nodes.length) {
    return '<p class="empty-inline">No EMTAK codes available.</p>';
  }

  return nodes.map((node) => {
    const selectable = level > 0;
    const selected = appState.selection.emtakCodes.has(node.code);
    const hasChildren = node.children.length > 0;
    const row = `
      <div class="emtak-node-row level-${level}${selectable ? "" : " emtak-node-row-root"}">
        ${selectable ? `
          <button class="tree-select-button${selected ? " is-active" : ""}" type="button" data-emtak-node="${escapeAttribute(node.code)}" aria-label="Select ${escapeAttribute(node.code)}">
            ${selected ? "✓" : "+"}
          </button>
        ` : ""}
        <button class="emtak-node${selected ? " is-active" : ""}${hasChildren ? " has-children" : ""}" type="button" ${hasChildren ? `data-emtak-expand="${escapeAttribute(node.code)}"` : ""}>
          <span class="emtak-node-copy">
            <span class="emtak-node-code">${escapeHtml(node.code)}</span>
            <span class="emtak-node-separator" aria-hidden="true">·</span>
            <span class="emtak-node-description">${escapeHtml(node.description)}</span>
          </span>
          ${hasChildren ? `<span class="tree-chevron" aria-hidden="true">${node.expanded ? "▾" : "▸"}</span>` : ""}
        </button>
      </div>
    `;

    const children = hasChildren && node.expanded
      ? `<div class="emtak-node-children">${renderEmtakTree(node.children, level + 1)}</div>`
      : "";

    return `<div class="emtak-node-group">${row}${children}</div>`;
  }).join("");
}

function toggleEmtakExpanded(code) {
  const node = findEmtakNode(code, appState.emtakTree);
  if (!node) return;
  node.expanded = !node.expanded;
  renderEmtakResults();
}

function toggleEmtakNodeSelection(code) {
  toggleSetValue(appState.selection.emtakCodes, code);
}

function findEmtakNode(code, nodes) {
  for (const node of nodes) {
    if (node.code === code) return node;
    const child = findEmtakNode(code, node.children);
    if (child) return child;
  }
  return null;
}

function applyEmployeePreset(min, max) {
  const minInput = document.getElementById("employees-min");
  const maxInput = document.getElementById("employees-max");
  if (!minInput || !maxInput) return;

  const alreadySelected = minInput.value.trim() === (min || "") && maxInput.value.trim() === (max || "");
  minInput.value = alreadySelected ? "" : (min || "");
  maxInput.value = alreadySelected ? "" : (max || "");
}

function normalizeLocationTree(locations) {
  return locations.map((county) => ({
    key: `county::${county.name}`,
    label: county.name,
    children: (county.cities || []).map((city) => ({
      key: `city::${county.name}::${city.name}`,
      label: city.name,
      children: (city.neighborhoods || []).map((neighborhood) => ({
        key: `neighborhood::${county.name}::${city.name}::${neighborhood.name}`,
        label: neighborhood.name,
        children: [],
        expanded: false,
      })),
      expanded: false,
    })),
    expanded: false,
  }));
}

function renderLocationTree(nodes, level = 0) {
  if (!nodes.length) {
    return '<p class="empty-inline">No locations available.</p>';
  }

  return nodes.map((node) => {
    const selected = appState.selection.locationKeys.has(node.key);
    const hasChildren = node.children.length > 0;
    const row = `
      <div class="location-node-row level-${level}">
        <button class="tree-select-button${selected ? " is-active" : ""}" type="button" data-location-node="${escapeAttribute(node.key)}" aria-label="Select ${escapeAttribute(node.label)}">
          ${selected ? "✓" : "+"}
        </button>
        <button class="location-node${selected ? " is-active" : ""}${hasChildren ? " has-children" : ""}" type="button" ${hasChildren ? `data-location-expand="${escapeAttribute(node.key)}"` : ""}>
          <span class="location-node-label">${escapeHtml(node.label)}</span>
          ${hasChildren ? `<span class="tree-chevron" aria-hidden="true">${node.expanded ? "▾" : "▸"}</span>` : ""}
        </button>
      </div>
    `;

    const children = hasChildren && node.expanded
      ? `<div class="location-node-children">${renderLocationTree(node.children, level + 1)}</div>`
      : "";

    return `<div class="location-node-group">${row}${children}</div>`;
  }).join("");
}

function toggleLocationExpanded(key) {
  const node = findLocationNode(key, appState.locationTree);
  if (!node) return;
  node.expanded = !node.expanded;
  renderLocationResults();
}

function toggleLocationNodeSelection(key) {
  toggleLocationSelection(key);
}

function findLocationNode(key, nodes) {
  for (const node of nodes) {
    if (node.key === key) return node;
    const child = findLocationNode(key, node.children);
    if (child) return child;
  }
  return null;
}

function optionToBoolean(value) {
  if (value === "include") return true;
  if (value === "exclude") return false;
  return null;
}

function numericRangePayload(values, keyMap = {}) {
  const payload = {};
  Object.entries(values).forEach(([key, rawValue]) => {
    const mappedKey = keyMap[key] || key;
    if (typeof rawValue === "boolean") {
      payload[mappedKey] = rawValue;
      return;
    }
    const parsed = parseInteger(rawValue);
    if (parsed !== null) {
      payload[mappedKey] = parsed;
    }
  });
  return Object.keys(payload).length ? payload : null;
}

function parseInteger(value) {
  if (value == null || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatDateForRequest(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return null;
  return `${day}.${month}.${year}`;
}

function stripUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value.map(stripUndefinedDeep);
  }
  if (value && typeof value === "object") {
    const next = {};
    Object.entries(value).forEach(([key, inner]) => {
      if (inner === undefined) return;
      next[key] = stripUndefinedDeep(inner);
    });
    return next;
  }
  return value;
}

function valueOf(id) {
  const node = document.getElementById(id);
  return node ? node.value.trim() : "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
