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
    const identificationCode = person.identification_code || "Unknown";

    document.title = `ContactPit | ${fullName}`;

    renderState(`
      <p class="detail-eyebrow">Person</p>
      <h1 class="detail-title">${escapeHtml(fullName)}</h1>
      <p class="detail-summary">
        Placeholder person route wired from homepage search. Rich person presentation can be added later without changing the slug-based navigation contract.
      </p>
      <div class="detail-metadata">
        <article class="detail-metadata-card">
          <p class="detail-metadata-label">Identification Code</p>
          <p class="detail-metadata-value">${escapeHtml(identificationCode)}</p>
        </article>
        <article class="detail-metadata-card">
          <p class="detail-metadata-label">Slug</p>
          <p class="detail-metadata-value">${escapeHtml(person.slug || slug)}</p>
        </article>
      </div>
    `);
  } catch (error) {
    renderState(`<p class="detail-state">${escapeHtml(error instanceof Error ? error.message : "Failed to load person.")}</p>`);
  }
}

void loadPerson();
