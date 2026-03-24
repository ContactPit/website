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

    const payload = await response.json();
    const company = payload?.message?.general_data;
    if (!company) {
      throw new Error("Company payload is missing general data.");
    }

    const companyName = company.name || "Unknown company";
    const registryCode = company.registry_code || "Unknown";

    document.title = `ContactPit | ${companyName}`;

    renderState(`
      <p class="detail-eyebrow">Company</p>
      <h1 class="detail-title">${escapeHtml(companyName)}</h1>
      <p class="detail-summary">
        Placeholder company route wired from homepage search. Rich company presentation can be added on top of this slug-based fetch flow later.
      </p>
      <div class="detail-metadata">
        <article class="detail-metadata-card">
          <p class="detail-metadata-label">Registry Code</p>
          <p class="detail-metadata-value">${escapeHtml(registryCode)}</p>
        </article>
        <article class="detail-metadata-card">
          <p class="detail-metadata-label">Slug</p>
          <p class="detail-metadata-value">${escapeHtml(company.slug || slug)}</p>
        </article>
      </div>
    `);
  } catch (error) {
    renderState(`<p class="detail-state">${escapeHtml(error instanceof Error ? error.message : "Failed to load company.")}</p>`);
  }
}

void loadCompany();
