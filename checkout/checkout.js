import { getOrFetchSessionCache, getSessionCache } from "../shared/session-bootstrap-cache.js";
import { formatCurrency, formatNumber, subscribeLocale, t, tl } from "../shared/i18n.js";

const CHECKOUT_DRAFT_KEY = "checkout-draft";
const DEV_API_PREFIX = "/__checkout_api";
const CHECKOUT_PACKAGES_CACHE_KEY = "checkout-packages-v2";
const CHECKOUT_PACKAGES_TTL_MS = 30 * 60 * 1000;
const API_BASE_URL = "https://leadlistscraper-524b3d937ddd.herokuapp.com";
const TEST_PUBLISHABLE_KEY_PREFIX = "pk_test_";
const state = {
  draft: null,
  packages: [],
  filteredPackages: [],
  selectedPackageId: null,
  currentStep: "package",
  recipientType: "individual",
  language: "en",
  paymentIntentClientSecret: null,
  paymentInitializedForPackageId: null,
  paymentInitializedForSessionKey: null,
  stripe: null,
  elements: null,
  paymentElement: null,
  config: null,
  submitting: false,
  invoiceSubmitting: false,
  checkoutCompleted: false,
};

const el = {};

document.addEventListener("DOMContentLoaded", async () => {
  cacheElements();
  bindEvents();
  loadDraft();

  if (!state.draft) {
    renderEmptyState();
    return;
  }

  renderDraftSummary();
  initializeFormDefaults();

  try {
    const [packages, config] = await Promise.all([fetchPackages(), fetchCheckoutConfig()]);
    state.packages = packages;
    state.config = config;
    state.filteredPackages = filterAvailablePackages(packages, state.draft.companyCount);
    if (state.filteredPackages.length) {
      state.selectedPackageId = state.filteredPackages.find((item) => item.isRecommended)?.id ?? state.filteredPackages[0].id;
    } else {
      state.selectedPackageId = null;
    }
    renderPackageChoices();
    renderSummary();
    showLayout();
  } catch (error) {
    setPaymentStatus(error instanceof Error ? error.message : tl("Failed to load checkout."), "error");
    renderPackageChoices();
    renderSummary();
    showLayout();
    setPackageStatus(error instanceof Error ? error.message : tl("Failed to load packages."), "error");
  }

  subscribeLocale(() => {
    renderDraftSummary();
    renderPackageChoices();
    renderSummary();
    syncStageHeader(state.currentStep);
  });
});

function cacheElements() {
  [
    "checkout-empty-state",
    "checkout-layout",
    "checkout-progress",
    "checkout-stage-label",
    "checkout-stage-title",
    "checkout-stage-copy",
    "checkout-stage-prompt",
    "checkout-stage-label-details",
    "checkout-stage-title-details",
    "checkout-stage-copy-details",
    "checkout-stage-prompt-details",
    "checkout-stage-label-payment",
    "checkout-stage-title-payment",
    "checkout-stage-copy-payment",
    "checkout-stage-prompt-payment",
    "checkout-package-status",
    "checkout-package-grid",
    "checkout-company-count",
    "checkout-filter-count",
    "checkout-package-summary",
    "checkout-price-subtotal",
    "checkout-price-vat",
    "checkout-price-total",
    "recipient-name",
    "recipient-email",
    "recipient-company-name",
    "company-name-field",
    "checkout-package-continue-button",
    "checkout-details-back-button",
    "checkout-details-continue-button",
    "checkout-back-button",
    "checkout-invoice-button",
    "checkout-pay-button",
    "checkout-payment-status",
    "checkout-invoice-loading",
    "checkout-payment-loading",
    "checkout-payment-loading-eyebrow",
    "checkout-payment-loading-title",
    "checkout-payment-loading-copy",
    "checkout-payment-placeholder",
    "checkout-stripe-host",
    "payment-element",
    "checkout-recipient-summary",
    "checkout-language-summary",
    "checkout-success",
    "checkout-success-badge",
    "checkout-success-title",
    "checkout-success-copy",
    "checkout-success-package",
    "checkout-success-recipient",
    "checkout-success-next-step",
  ].forEach((id) => {
    el[id] = document.getElementById(id);
  });
}

function bindEvents() {
  document.addEventListener("click", handleClick);
  el["checkout-package-continue-button"]?.addEventListener("click", continueFromPackageStep);
  el["checkout-details-back-button"]?.addEventListener("click", () => setCurrentStep("package"));
  el["checkout-details-continue-button"]?.addEventListener("click", continueFromDetailsStep);
  el["checkout-back-button"]?.addEventListener("click", () => setCurrentStep("details"));
  el["checkout-invoice-button"]?.addEventListener("click", submitInvoiceRequest);
  el["checkout-pay-button"]?.addEventListener("click", submitPayment);
  ["recipient-name", "recipient-email", "recipient-company-name"].forEach((id) => {
    el[id]?.addEventListener("input", () => {
      resetPaymentSession();
      renderSummary();
      updateContinueState();
    });
  });
}

function loadDraft() {
  const draft = getSessionCache(CHECKOUT_DRAFT_KEY);
  if (!draft || !draft.filters || !draft.companyCount) return;
  state.draft = draft;
}

function renderEmptyState() {
  el["checkout-empty-state"].hidden = false;
  el["checkout-layout"].hidden = true;
}

function showLayout() {
  el["checkout-empty-state"].hidden = true;
  el["checkout-layout"].hidden = false;
  el["checkout-layout"].classList.remove("is-success");
  el["checkout-success"].hidden = true;
  el["checkout-progress"]?.classList.remove("is-complete");
  state.checkoutCompleted = false;
  setCurrentStep("package");
  updateContinueState();
}

function initializeFormDefaults() {
  state.recipientType = "individual";
  state.language = "en";
  state.checkoutCompleted = false;
  el["recipient-name"].value = "";
  el["recipient-email"].value = "";
  el["recipient-company-name"].value = "";
  syncChoiceStates();
}

function handleClick(event) {
  const recipientButton = event.target.closest("[data-recipient-type]");
  if (recipientButton) {
    state.recipientType = recipientButton.getAttribute("data-recipient-type");
    resetPaymentSession();
    syncChoiceStates();
    renderSummary();
    updateContinueState();
    return;
  }

  const languageButton = event.target.closest("[data-language]");
  if (languageButton) {
    state.language = languageButton.getAttribute("data-language");
    resetPaymentSession();
    syncChoiceStates();
    renderSummary();
    return;
  }

  const packageButton = event.target.closest("[data-package-id]");
  if (packageButton) {
    state.selectedPackageId = Number.parseInt(packageButton.getAttribute("data-package-id"), 10);
    resetPaymentSession();
    renderPackageChoices();
    renderSummary();
    updateContinueState();
  }
}

function syncChoiceStates() {
  document.querySelectorAll("[data-recipient-type]").forEach((node) => {
    node.classList.toggle("is-active", node.getAttribute("data-recipient-type") === state.recipientType);
    const input = node.querySelector('input[type="radio"]');
    if (input) input.checked = node.getAttribute("data-recipient-type") === state.recipientType;
  });
  document.querySelectorAll("[data-language]").forEach((node) => {
    node.classList.toggle("is-active", node.getAttribute("data-language") === state.language);
    const input = node.querySelector('input[type="radio"]');
    if (input) input.checked = node.getAttribute("data-language") === state.language;
  });
  const showCompanyName = state.recipientType === "company";
  el["company-name-field"].hidden = !showCompanyName;
}

function renderDraftSummary() {
  el["checkout-company-count"].textContent = formatNumber(state.draft.companyCount, { maximumFractionDigits: 0 });
  el["checkout-filter-count"].textContent = String((state.draft.activeFilters || []).length);
}

function renderPackageChoices() {
  clearPackageStatus();

  if (!state.filteredPackages.length) {
    el["checkout-package-grid"].innerHTML = `
      <div class="checkout-inline-empty">
        ${escapeHtml(t("checkout.package.noneAvailable"))}
      </div>
    `;
    return;
  }

  el["checkout-package-grid"].innerHTML = state.filteredPackages.map((item) => {
    const isActive = item.id === state.selectedPackageId;
    return `
      <label class="checkout-package-option${isActive ? " is-active" : ""}" data-package-id="${item.id}">
        <input name="checkout-package" type="radio" value="${item.id}" ${isActive ? "checked" : ""} />
        <span class="checkout-radio-control" aria-hidden="true"></span>
        <span class="checkout-package-copy">
          <span class="checkout-package-line">
            <span class="checkout-package-name">${escapeHtml(item.name)}</span>
            ${item.isRecommended ? `<span class="checkout-package-badge">${escapeHtml(t("checkout.package.recommended"))}</span>` : ""}
          </span>
          <span class="checkout-package-meta">
            ${formatCurrency(item.totalPrice, { maximumFractionDigits: 2 })} · ${escapeHtml(t("checkout.package.contactsLimit", { count: formatNumber(item.limit, { maximumFractionDigits: 0 }) }))}
          </span>
        </span>
      </label>
    `;
  }).join("");
}

function renderSummary() {
  const selectedPackage = getSelectedPackage();
  const recipient = getRecipientData();
  const languageLabel = state.language === "et" ? t("site.lang.estonian") : t("site.lang.english");

  if (!selectedPackage) {
    el["checkout-package-summary"].innerHTML = `<div class="checkout-summary-placeholder">${escapeHtml(t("checkout.summary.packagePrompt"))}</div>`;
    el["checkout-price-subtotal"].textContent = formatCurrency(0, { maximumFractionDigits: 2 });
    el["checkout-price-vat"].textContent = formatCurrency(0, { maximumFractionDigits: 2 });
    el["checkout-price-total"].textContent = formatCurrency(0, { maximumFractionDigits: 2 });
  } else {
    el["checkout-package-summary"].innerHTML = `
      <div class="checkout-price-row">
        <span>${escapeHtml(t("checkout.summary.package"))}</span>
        <strong>${escapeHtml(selectedPackage.name)}</strong>
      </div>
      <div class="checkout-price-row">
        <span>${escapeHtml(tl("Delivery cap"))}</span>
        <strong>${formatNumber(selectedPackage.limit, { maximumFractionDigits: 0 })}</strong>
      </div>
      <div class="checkout-price-divider checkout-price-divider-section" aria-hidden="true"></div>
    `;
    el["checkout-price-subtotal"].textContent = formatCurrency(selectedPackage.price, { maximumFractionDigits: 2 });
    el["checkout-price-vat"].textContent = formatCurrency(selectedPackage.vat, { maximumFractionDigits: 2 });
    el["checkout-price-total"].textContent = formatCurrency(selectedPackage.totalPrice, { maximumFractionDigits: 2 });
  }

  if (el["checkout-recipient-summary"]) {
    el["checkout-recipient-summary"].innerHTML = `
      ${definitionRow(tl("Name"), recipient.name || tl("Not filled"))}
      ${definitionRow(t("checkout.field.email"), recipient.email || tl("Not filled"))}
      ${recipient.recipient_type === "company" ? definitionRow(t("checkout.field.companyName"), recipient.company_name || tl("Not filled")) : ""}
    `;
  }
  if (el["checkout-language-summary"]) {
    el["checkout-language-summary"].innerHTML = definitionRow(t("checkout.summary.language"), languageLabel);
  }
}

function continueFromPackageStep() {
  if (!packageStepIsValid()) {
    setPackageStatus(tl("Choose a package before continuing."), "error");
    return;
  }
  setCurrentStep("details");
}

async function continueFromDetailsStep() {
  if (!detailsStepIsValid()) {
    setPaymentStatus(tl("Complete the recipient fields before continuing."), "error");
    return;
  }

  const selectedPackage = getSelectedPackage();
  if (!selectedPackage) {
    setCurrentStep("package");
    setPackageStatus(tl("Choose a package before continuing to payment."), "error");
    return;
  }

  await preparePayment();
  setCurrentStep("payment");
}

function setCurrentStep(step) {
  state.currentStep = step;
  document.querySelectorAll("[data-checkout-stage]").forEach((node) => {
    node.hidden = node.getAttribute("data-checkout-stage") !== step;
  });
  syncStageHeader(step);
  if (step !== "payment") {
    setPaymentStatus("", "idle");
  }
  updateStepActions();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function preparePayment() {
  if (!detailsStepIsValid()) return;
  if (!state.config?.publishableKey) {
    setPaymentStatus(tl("Stripe publishable key missing. Add STRIPE_PUBLISHABLE_KEY to Vercel and reload."), "warning");
    setPaymentLoading(false);
    el["checkout-payment-placeholder"].hidden = false;
    el["checkout-stripe-host"].hidden = true;
    return;
  }

  const selectedPackage = getSelectedPackage();
  if (!selectedPackage) {
    setPaymentStatus(tl("Select a package before opening payment."), "error");
    return;
  }

  const sessionKey = currentPaymentSessionKey(selectedPackage.id);
  if (state.paymentIntentClientSecret && state.paymentInitializedForSessionKey === sessionKey && state.paymentElement) {
    setPaymentLoading(false);
    el["checkout-payment-placeholder"].hidden = true;
    el["checkout-stripe-host"].hidden = false;
    return;
  }

  setPaymentStatus(tl("Preparing secure payment session."), "loading");
  setPaymentLoading(true, {
    eyebrow: t("checkout.payment.loadingEyebrow"),
    title: t("checkout.payment.loadingTitle"),
    copy: t("checkout.payment.loadingCopy"),
  });
  el["checkout-payment-placeholder"].hidden = true;
  el["checkout-stripe-host"].hidden = true;
  togglePayButton(true);

  try {
    const payloadBody = JSON.stringify(buildPaymentRequest(selectedPackage.id));
    const headers = {
      "Content-Type": "application/json",
      "Idempotency-Key": paymentIdempotencyKey(selectedPackage.id),
      "X-Debug-Mode": usesStripeTestMode() ? "true" : "false",
    };
    const local = await fetchJsonResponse(`${DEV_API_PREFIX}/create-order-and-payment`, {
      method: "POST",
      headers,
      body: payloadBody,
    });
    const serverless = local.ok ? local : await fetchJsonResponse("/api/create-order-and-payment", {
      method: "POST",
      headers,
      body: payloadBody,
    });
    const result = serverless.ok ? serverless : await fetchJsonResponse(`${API_BASE_URL}/api/create-order-and-payment`, {
      method: "POST",
      headers,
      body: payloadBody,
    });

    if (!result.ok) {
      throw new Error(extractApiError(result) || tl("Failed to initialize payment."));
    }
    const clientSecret = result.payload?.message || result.payload?.clientSecret;
    if (!clientSecret) {
      throw new Error(tl("Payment intent client secret was missing."));
    }
    state.paymentIntentClientSecret = clientSecret;
    state.paymentInitializedForPackageId = selectedPackage.id;
    state.paymentInitializedForSessionKey = sessionKey;
    await mountPaymentElement(clientSecret);
    setPaymentStatus("", "idle");
  } catch (error) {
    setPaymentLoading(false);
    setPaymentStatus(error instanceof Error ? error.message : tl("Failed to initialize payment."), "error");
  } finally {
    togglePayButton(false);
  }
}

async function mountPaymentElement(clientSecret) {
  destroyPaymentElement();

  state.stripe = window.Stripe(state.config.publishableKey);
  state.elements = state.stripe.elements({
    clientSecret,
    appearance: {
      theme: "stripe",
      variables: {
        colorPrimary: "#7a1ce1",
        colorBackground: "#ffffff",
        colorText: "#171320",
        colorDanger: "#b42318",
        borderRadius: "20px",
        fontFamily: 'ui-rounded, "SF Pro Rounded", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
      },
      rules: {
        ".Input": {
          boxShadow: "none",
          borderColor: "rgba(122, 28, 225, 0.18)",
        },
      },
    },
  });
  state.paymentElement = state.elements.create("payment", {
    layout: {
      type: "accordion",
      defaultCollapsed: false,
    },
  });
  state.paymentElement.mount("#payment-element");
  setPaymentLoading(false);
  el["checkout-payment-placeholder"].hidden = true;
  el["checkout-stripe-host"].hidden = false;
}

function destroyPaymentElement() {
  if (state.paymentElement) {
    state.paymentElement.destroy();
  }
  state.elements = null;
  state.paymentElement = null;
}

function resetPaymentSession() {
  state.paymentIntentClientSecret = null;
  state.paymentInitializedForPackageId = null;
  state.paymentInitializedForSessionKey = null;
  destroyPaymentElement();
  setPaymentLoading(false);
  el["checkout-payment-placeholder"].hidden = true;
  el["checkout-stripe-host"].hidden = true;
}

async function submitPayment() {
  if (state.submitting) return;
  if (!state.stripe || !state.elements || !state.paymentIntentClientSecret) {
    await preparePayment();
    if (!state.stripe || !state.elements || !state.paymentIntentClientSecret) return;
  }

  state.submitting = true;
  togglePayButton(true);
  setPaymentLoading(true, {
    eyebrow: tl("Confirming payment"),
    title: tl("Processing the card payment."),
    copy: tl("Stripe is confirming the payment details and finalizing the order now."),
  });
  setPaymentStatus(tl("Confirming payment."), "loading");

  try {
    const { error: submitError } = await state.elements.submit();
    if (submitError) {
      throw submitError;
    }

    const { error } = await state.stripe.confirmPayment({
      elements: state.elements,
      clientSecret: state.paymentIntentClientSecret,
      confirmParams: {
        receipt_email: el["recipient-email"].value.trim(),
      },
      redirect: "if_required",
    });

    if (error) {
      throw error;
    }

    setPaymentStatus(tl("Payment completed."), "success");
    showSuccessState({
      tone: "paid",
      badge: t("checkout.summary.paid"),
      title: t("checkout.success.badge"),
      copy: t("checkout.success.title"),
      nextStep: tl("We are processing the paid order now."),
    });
  } catch (error) {
    setPaymentLoading(false);
    setPaymentStatus(error?.message || tl("Payment failed."), "error");
  } finally {
    state.submitting = false;
    togglePayButton(false);
  }
}

async function submitInvoiceRequest() {
  if (state.invoiceSubmitting) return;
  if (!detailsStepIsValid()) {
    setPaymentStatus(tl("Complete the recipient fields before requesting an invoice."), "error");
    return;
  }

  const selectedPackage = getSelectedPackage();
  if (!selectedPackage) {
    setPaymentStatus(tl("Select a package before requesting an invoice."), "error");
    return;
  }

  if (state.recipientType !== "company") {
    setPaymentStatus(tl("Invoice checkout is available only for company recipients."), "error");
    return;
  }

  state.invoiceSubmitting = true;
  toggleInvoiceButton(true);
  el["checkout-pay-button"].disabled = true;
  setInvoiceLoading(true);
  setPaymentStatus("", "idle");

  try {
    const payloadBody = JSON.stringify(buildInvoiceRequest(selectedPackage.id));
    const headers = {
      "Content-Type": "application/json",
      "Idempotency-Key": invoiceIdempotencyKey(selectedPackage.id),
    };
    const local = await fetchJsonResponse(`${DEV_API_PREFIX}/send/request`, {
      method: "POST",
      headers,
      body: payloadBody,
    });
    const serverless = local.ok ? local : await fetchJsonResponse("/api/send/request", {
      method: "POST",
      headers,
      body: payloadBody,
    });
    const result = serverless;

    if (!result.ok) {
      throw new Error(extractApiError(result) || tl("Failed to request invoice."));
    }

    showSuccessState({
      tone: "invoice",
      badge: tl("Invoice requested"),
      title: tl("Invoice request submitted."),
      copy: tl("We created the order and will send the invoice to your email."),
      nextStep: tl("Check your email for the invoice and follow-up details."),
    });
  } catch (error) {
    setInvoiceLoading(false);
    setPaymentStatus(error?.message || tl("Failed to request invoice."), "error");
  } finally {
    state.invoiceSubmitting = false;
    toggleInvoiceButton(false);
    el["checkout-pay-button"].disabled = false;
  }
}

function togglePayButton(disabled) {
  el["checkout-pay-button"].disabled = disabled;
  el["checkout-pay-button"].classList.toggle("is-loading", disabled);
}

function toggleInvoiceButton(disabled) {
  el["checkout-invoice-button"].disabled = disabled;
  el["checkout-invoice-button"].classList.toggle("is-loading", disabled);
}

function setInvoiceLoading(loading) {
  if (!el["checkout-invoice-loading"]) return;
  el["checkout-invoice-loading"].hidden = !loading;

  if (loading) {
    setPaymentLoading(false);
    el["checkout-payment-placeholder"].hidden = true;
    el["checkout-stripe-host"].hidden = true;
    return;
  }

  if (state.paymentElement && state.paymentIntentClientSecret) {
    el["checkout-stripe-host"].hidden = false;
    return;
  }

  if (!state.config?.publishableKey) {
    el["checkout-payment-placeholder"].hidden = false;
  }
}

function setPaymentLoading(loading, content = {}) {
  if (!el["checkout-payment-loading"]) return;
  el["checkout-payment-loading"].hidden = !loading;

  if (el["checkout-payment-loading-eyebrow"] && content.eyebrow) {
    el["checkout-payment-loading-eyebrow"].textContent = content.eyebrow;
  }
  if (el["checkout-payment-loading-title"] && content.title) {
    el["checkout-payment-loading-title"].textContent = content.title;
  }
  if (el["checkout-payment-loading-copy"] && content.copy) {
    el["checkout-payment-loading-copy"].textContent = content.copy;
  }

  if (loading) {
    el["checkout-stripe-host"].hidden = true;
    el["checkout-payment-placeholder"].hidden = true;
  }
}

function showSuccessState({ tone = "paid", badge, title, copy, nextStep }) {
  state.checkoutCompleted = true;
  setInvoiceLoading(false);
  setPaymentLoading(false);
  document.querySelector("[data-checkout-stage='payment']").hidden = true;
  el["checkout-success"].hidden = false;
  el["checkout-layout"].classList.add("is-success");
  el["checkout-progress"]?.classList.add("is-complete");
  el["checkout-success"]?.setAttribute("data-tone", tone);
  if (el["checkout-success-badge"]) el["checkout-success-badge"].textContent = badge;
  if (el["checkout-success-title"]) el["checkout-success-title"].textContent = title;
  if (el["checkout-success-copy"]) el["checkout-success-copy"].textContent = copy;
  if (el["checkout-success-package"]) {
    el["checkout-success-package"].textContent = getSelectedPackage()?.name || tl("Custom");
  }
  if (el["checkout-success-recipient"]) {
    el["checkout-success-recipient"].textContent = el["recipient-email"]?.value.trim() || tl("Not provided");
  }
  if (el["checkout-success-next-step"]) {
    el["checkout-success-next-step"].textContent = nextStep || t("checkout.success.nextCopy");
  }
  el["checkout-stage-label"].textContent = tl("Completed");
  el["checkout-stage-title"].textContent = title;
  el["checkout-stage-copy"].textContent = copy;
  el["checkout-stage-prompt"].textContent = tl("Current task: complete.");
  syncProgressRail("payment");
}

function updateContinueState() {
  updateStepActions();
}

function packageStepIsValid() {
  return Boolean(getSelectedPackage());
}

function detailsStepIsValid() {
  const name = el["recipient-name"].value.trim();
  const email = el["recipient-email"].value.trim();
  if (!name || !email) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  if (state.recipientType === "company" && !el["recipient-company-name"].value.trim()) return false;
  return true;
}

function updateStepActions() {
  if (el["checkout-package-continue-button"]) {
    el["checkout-package-continue-button"].disabled = !packageStepIsValid();
  }
  if (el["checkout-details-continue-button"]) {
    el["checkout-details-continue-button"].disabled = !detailsStepIsValid();
  }
  if (el["checkout-invoice-button"]) {
    const invoiceVisible = state.recipientType === "company";
    el["checkout-invoice-button"].hidden = !invoiceVisible;
  }
  syncStageHeader(state.currentStep);
}

function getSelectedPackage() {
  return state.filteredPackages.find((item) => item.id === state.selectedPackageId) || null;
}

function getRecipientData() {
  return {
    name: el["recipient-name"].value.trim(),
    email: el["recipient-email"].value.trim(),
    company_name: state.recipientType === "company" ? el["recipient-company-name"].value.trim() : undefined,
    recipient_type: state.recipientType,
  };
}

function buildPaymentRequest(packageId) {
  return {
    author: {
      type: "website",
      name: el["recipient-name"].value.trim(),
      email: el["recipient-email"].value.trim(),
    },
    recipient: getRecipientData(),
    package_id: packageId,
    send_invoice: false,
    order_type: "direct_payment",
    language: state.language,
    filters: state.draft.filters,
  };
}

function buildInvoiceRequest(packageId) {
  return {
    author: {
      type: "website",
      name: el["recipient-name"].value.trim(),
      email: el["recipient-email"].value.trim(),
    },
    recipient: getRecipientData(),
    package_id: packageId,
    send_invoice: true,
    order_type: "invoice",
    language: state.language,
    filters: state.draft.filters,
  };
}

function usesStripeTestMode() {
  return Boolean(state.config?.publishableKey?.startsWith(TEST_PUBLISHABLE_KEY_PREFIX));
}

function paymentIdempotencyKey(packageId) {
  const mode = usesStripeTestMode() ? "test" : "live";
  return `website-checkout:${mode}:${currentPaymentSessionKey(packageId)}`;
}

function invoiceIdempotencyKey(packageId) {
  return `website-invoice:${currentPaymentSessionKey(packageId)}`;
}

function currentPaymentSessionKey(packageId) {
  const recipient = getRecipientData();
  return [
    state.draft?.createdAt || "draft",
    packageId,
    state.language,
    recipient.recipient_type,
    recipient.name.toLowerCase(),
    recipient.email.toLowerCase(),
    (recipient.company_name || "").toLowerCase(),
  ].join(":");
}

function setPaymentStatus(message, tone) {
  el["checkout-payment-status"].textContent = message;
  el["checkout-payment-status"].dataset.tone = tone;
  el["checkout-payment-status"].hidden = !message;
}

function setPackageStatus(message, tone) {
  if (!el["checkout-package-status"]) return;
  el["checkout-package-status"].textContent = message;
  el["checkout-package-status"].dataset.tone = tone;
  el["checkout-package-status"].hidden = !message;
}

function clearPackageStatus() {
  setPackageStatus("", "idle");
}

async function fetchPackages() {
  return getOrFetchSessionCache(CHECKOUT_PACKAGES_CACHE_KEY, CHECKOUT_PACKAGES_TTL_MS, async () => {
    const homePackages = await fetchPackagesFromHomePayload();
    if (homePackages.length) {
      return homePackages;
    }

    const serverless = await fetchJsonResponse("/api/packages");
    if (serverless.ok && Array.isArray(serverless.payload?.message)) {
      return serverless.payload.message.map(normalizePackage);
    }

    throw new Error(extractApiError(serverless) || tl("Failed to load packages."));
  });
}

async function fetchPackagesFromHomePayload() {
  const sources = ["/api/home", "/data/home.json", "./data/home.json"];

  for (const source of sources) {
    const result = await fetchJsonResponse(source);
    if (result.ok && Array.isArray(result.payload?.packages)) {
      return result.payload.packages.map(normalizePackage);
    }
  }

  return [];
}

async function fetchCheckoutConfig() {
  const local = await fetchJsonResponse(`${DEV_API_PREFIX}/checkout-config`);
  if (local.ok && local.payload && typeof local.payload === "object") {
    return local.payload;
  }
  const serverless = await fetchJsonResponse("/api/checkout-config");
  if (serverless.ok && serverless.payload && typeof serverless.payload === "object") {
    return serverless.payload;
  }
  return {
    publishableKey: "",
    merchantCountry: "EE",
  };
}

function normalizePackage(item) {
  return {
    id: Number(item.id),
    name: String(item.name || ""),
    price: Number(item.price || 0),
    vat: Number(item.vat || 0),
    totalPrice: Number(item.total_price || 0),
    limit: Number(item.contact_limit || item.limit || 0),
    min: Number(item.contact_min || item.min || 0),
    isRecommended: Boolean(item.is_recommended),
    keyPoints: Array.isArray(item.key_points) ? item.key_points : [],
  };
}

function definitionRow(label, value) {
  return `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `;
}

function filterAvailablePackages(packages, companyCount) {
  return packages.filter((item) => item.min <= companyCount);
}

function syncStageHeader(step) {
  syncProgressRail(step);

  if (step === "payment") {
    if (el["checkout-stage-label-payment"]) el["checkout-stage-label-payment"].textContent = t("checkout.step3");
    if (el["checkout-stage-title-payment"]) el["checkout-stage-title-payment"].textContent = t("checkout.title.payment");
    if (el["checkout-stage-prompt-payment"]) el["checkout-stage-prompt-payment"].textContent = getSelectedPackage()
      ? t("checkout.package.currentTaskPayment")
      : t("checkout.package.blockedPayment");
    return;
  }

  if (step === "details") {
    if (el["checkout-stage-label-details"]) el["checkout-stage-label-details"].textContent = t("checkout.step2");
    if (el["checkout-stage-title-details"]) el["checkout-stage-title-details"].textContent = t("checkout.title.details");
    if (el["checkout-stage-prompt-details"]) el["checkout-stage-prompt-details"].textContent = detailsStepIsValid()
      ? t("checkout.package.currentTaskDetailsDone")
      : t("checkout.package.currentTaskDetailsPending");
    return;
  }

  if (el["checkout-stage-label"]) el["checkout-stage-label"].textContent = t("checkout.step1");
  if (el["checkout-stage-title"]) el["checkout-stage-title"].textContent = t("checkout.title.package");
}

function syncProgressRail(step, allComplete = false) {
  const stepOrder = { package: 1, details: 2, payment: 3 };
  const currentIndex = stepOrder[step] || 1;
  document.querySelectorAll("[data-progress-step]").forEach((node) => {
    const nodeStep = node.getAttribute("data-progress-step");
    const nodeIndex = stepOrder[nodeStep] || 0;
    node.dataset.state = allComplete || state.checkoutCompleted
      ? "complete"
      : nodeIndex < currentIndex
        ? "complete"
        : nodeIndex === currentIndex
          ? "active"
          : "idle";
  });
}

async function fetchJsonResponse(url, options) {
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (_error) {
        payload = null;
      }
    }
    return {
      ok: response.ok,
      status: response.status,
      payload,
      text,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      payload: null,
      text: "",
      error,
    };
  }
}

function extractApiError(result) {
  if (!result) return "";
  if (result.payload?.detail) return result.payload.detail;
  if (result.payload?.error) return result.payload.error;
  if (typeof result.text === "string" && result.text.trim()) return "";
  return result.error instanceof Error ? result.error.message : "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
