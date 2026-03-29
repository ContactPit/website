import { iosMessages } from "./ios-messages.generated.js";
import { literalMessages, webMessages } from "./web-messages.js";

const STORAGE_KEY = "contactpit.site-locale";
const DEFAULT_LOCALE = "en";
const SUPPORTED_LOCALES = new Set(["en", "et"]);
const listeners = new Set();

const messages = {
  en: {
    ...(iosMessages.en || {}),
    ...(webMessages.en || {}),
  },
  et: {
    ...(iosMessages.et || {}),
    ...(webMessages.et || {}),
  },
};

let currentLocale = detectInitialLocale();

function normalizeLocale(locale) {
  const value = String(locale || "").trim().toLowerCase();
  if (value.startsWith("et")) return "et";
  return "en";
}

function detectInitialLocale() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED_LOCALES.has(normalizeLocale(stored))) {
      return normalizeLocale(stored);
    }
  } catch (_error) {
    // Ignore storage access failures.
  }

  const browserCandidates = [
    ...(Array.isArray(window.navigator.languages) ? window.navigator.languages : []),
    window.navigator.language,
    window.navigator.userLanguage,
  ].filter(Boolean);

  for (const locale of browserCandidates) {
    const normalized = normalizeLocale(locale);
    if (SUPPORTED_LOCALES.has(normalized)) return normalized;
  }

  return DEFAULT_LOCALE;
}

function persistLocale(locale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch (_error) {
    // Ignore storage failures.
  }
}

function messageValue(key) {
  return messages[currentLocale]?.[key] || messages.en?.[key] || "";
}

function interpolate(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_match, key) => {
    const value = params[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

export function getLocale() {
  return currentLocale;
}

export function getLocaleLabel(locale = currentLocale) {
  return locale === "et" ? t("site.lang.estonian") : t("site.lang.english");
}

export function getLocaleFlag(locale = currentLocale) {
  return normalizeLocale(locale) === "et" ? "🇪🇪" : "🇬🇧";
}

export function setLocale(locale) {
  const nextLocale = normalizeLocale(locale);
  if (!SUPPORTED_LOCALES.has(nextLocale) || nextLocale === currentLocale) return;
  currentLocale = nextLocale;
  persistLocale(nextLocale);
  updateDocumentLanguage();
  listeners.forEach((listener) => listener(nextLocale));
}

export function subscribeLocale(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function t(key, params) {
  const template = messageValue(key);
  if (template) {
    return interpolate(template, params);
  }
  return tl(key, params);
}

export function tl(value, params) {
  const text = String(value ?? "");
  const translated = literalMessages[currentLocale]?.[text] || literalMessages.en?.[text] || text;
  return interpolate(translated, params);
}

export function localizedText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return String(value);
  return value[currentLocale] || value.en || value.et || value.english || value.estonian || "";
}

export function formatNumber(value, options = {}) {
  return new Intl.NumberFormat(currentLocale === "et" ? "et-EE" : "en-US", options).format(value);
}

export function formatCurrency(value, options = {}) {
  return new Intl.NumberFormat(currentLocale === "et" ? "et-EE" : "en-US", {
    style: "currency",
    currency: "EUR",
    ...options,
  }).format(value);
}

export function formatDate(value, options = {}) {
  return new Intl.DateTimeFormat(currentLocale === "et" ? "et-EE" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...options,
  }).format(value);
}

export function formatDateValue(value, options = {}) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value ?? "");
  return formatDate(date, options);
}

export function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.getAttribute("data-i18n"));
  });
  root.querySelectorAll("[data-i18n-html]").forEach((node) => {
    node.innerHTML = t(node.getAttribute("data-i18n-html"));
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.setAttribute("placeholder", t(node.getAttribute("data-i18n-placeholder")));
  });
  root.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    node.setAttribute("aria-label", t(node.getAttribute("data-i18n-aria-label")));
  });
  root.querySelectorAll("[data-i18n-title]").forEach((node) => {
    node.setAttribute("title", t(node.getAttribute("data-i18n-title")));
  });
  root.querySelectorAll("[data-i18n-content]").forEach((node) => {
    node.setAttribute("content", t(node.getAttribute("data-i18n-content")));
  });
}

export function applyPageMetadata(pageKey) {
  if (!pageKey) return;
  document.title = t(`meta.${pageKey}.title`);
  const descriptionNode = document.querySelector('meta[name="description"]');
  if (descriptionNode) {
    descriptionNode.setAttribute("content", t(`meta.${pageKey}.description`));
  }
}

export function setupLanguageSelector(root = document) {
  const container = root.querySelector("[data-language-switcher]");
  if (!container) return;
  const button = container.querySelector("[data-language-trigger]");
  const menu = container.querySelector("[data-language-menu]");
  const current = container.querySelector("[data-language-current]");
  const label = container.querySelector("[data-language-label]");
  if (label) label.textContent = t("site.lang.menu");

  const sync = () => {
    if (current) current.textContent = getLocaleFlag();
    if (button) button.setAttribute("aria-label", `${t("site.lang.menu")}: ${getLocaleLabel()}`);
    container.querySelectorAll("[data-set-locale]").forEach((item) => {
      const locale = item.getAttribute("data-set-locale");
      const active = locale === currentLocale;
      item.setAttribute("aria-checked", active ? "true" : "false");
      item.classList.toggle("is-active", active);
      item.textContent = getLocaleFlag(locale);
      item.setAttribute("aria-label", getLocaleLabel(locale));
      item.setAttribute("title", getLocaleLabel(locale));
    });
  };

  sync();

  if (container.dataset.bound === "true") {
    return;
  }
  container.dataset.bound = "true";

  button?.addEventListener("click", () => {
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", expanded ? "false" : "true");
    menu.hidden = expanded;
  });

  container.querySelectorAll("[data-set-locale]").forEach((item) => {
    item.addEventListener("click", () => {
      const locale = item.getAttribute("data-set-locale");
      setLocale(locale);
      if (button) button.setAttribute("aria-expanded", "false");
      if (menu) menu.hidden = true;
    });
  });

  document.addEventListener("click", (event) => {
    if (!container.contains(event.target)) {
      if (button) button.setAttribute("aria-expanded", "false");
      if (menu) menu.hidden = true;
    }
  });

  subscribeLocale(sync);
}

export function updateDocumentLanguage() {
  document.documentElement.lang = currentLocale;
}

updateDocumentLanguage();
