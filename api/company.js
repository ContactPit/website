const BASE_URL = "https://leadlistscraper-524b3d937ddd.herokuapp.com";

async function fetchJson(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed ${path}: ${response.status} ${detail}`.trim());
  }
  return response.json();
}

function buildEmtakDescriptions(...trees) {
  const descriptions = {};
  const visit = (nodes) => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const code = String(node.Code || node.code || "").trim();
      const description = String(node.DescriptionEn || node.descriptionEn || node.DescriptionEt || node.descriptionEt || "").trim();
      if (code && description) descriptions[code] = description;
      visit(node.children);
    }
  };
  trees.forEach(visit);
  return descriptions;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const slug = String(req.query?.slug || "").trim();
    if (!slug) {
      res.status(400).json({ error: "Missing slug query parameter" });
      return;
    }

    const [payload, legends] = await Promise.all([
      fetchJson(`/api/company/full?slug=${encodeURIComponent(slug)}`),
      fetchJson("/api/legends"),
    ]);

    res.setHeader("Cache-Control", "no-store");
    const legendPayload = legends.message || {};
    res.status(200).json({
      ...payload,
      legends: {
        ...legendPayload,
        emtak_descriptions: buildEmtakDescriptions(legendPayload.emtaks, legendPayload.emtaks_old),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const notFound = message.includes("404");
    res.status(notFound ? 404 : 500).json({
      error: notFound ? "Company not found" : "Failed to load company",
      detail: message,
    });
  }
};
