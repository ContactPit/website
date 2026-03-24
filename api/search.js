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

    const query = String(req.query?.q || "").trim();
    const payload = await fetchJson(`/api/search?q=${encodeURIComponent(query)}`);

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({
      error: "Failed to search",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
};
