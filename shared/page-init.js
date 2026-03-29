import { applyI18n, applyPageMetadata, setupLanguageSelector, subscribeLocale } from "./i18n.js";

function currentPageKey() {
  return document.body?.dataset?.pageKey || "";
}

function applyStaticLocalization() {
  applyI18n(document);
  setupLanguageSelector(document);
  applyPageMetadata(currentPageKey());
}

document.addEventListener("DOMContentLoaded", () => {
  applyStaticLocalization();
  subscribeLocale(() => {
    applyStaticLocalization();
  });
});
