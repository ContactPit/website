const BASE_URL = "https://leadlistscraper-524b3d937ddd.herokuapp.com";

module.exports = async function handler(_req, res) {
  try {
    const response = await fetch(`${BASE_URL}/api/packages`);
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Failed /api/packages: ${response.status} ${detail}`.trim());
    }

    const payload = await response.json();
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({
      error: "Failed to load packages",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
};
