const BASE_URL = "https://leadlistscraper-524b3d937ddd.herokuapp.com";

async function fetchJson(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }
  return response.json();
}

module.exports = async function handler(_req, res) {
  try {
    const [trending, leaderboards, catalog, counties] = await Promise.all([
      fetchJson("/api/trending"),
      fetchJson("/api/leaderboards"),
      fetchJson("/api/catalog"),
      fetchJson("/api/counties"),
    ]);
    const essentials = await fetchJson("/api/essentials");

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    res.status(200).json({
      trending: trending.message,
      leaderboards: leaderboards.message,
      catalog: catalog.message,
      counties: counties.message,
      testimonials: essentials.message.testimonials,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to load home data",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
};
