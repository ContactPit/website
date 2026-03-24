const BASE_URL = "https://leadlistscraper-524b3d937ddd.herokuapp.com";

async function fetchJson(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed ${path}: ${response.status} ${detail}`.trim());
  }
  return response.json();
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

    const payload = await fetchJson(`/api/company/full?slug=${encodeURIComponent(slug)}`);

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const notFound = message.includes("404");
    res.status(notFound ? 404 : 500).json({
      error: notFound ? "Company not found" : "Failed to load company",
      detail: message,
    });
  }
};
