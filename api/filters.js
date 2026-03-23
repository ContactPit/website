const BASE_URL = "https://leadlistscraper-524b3d937ddd.herokuapp.com";

async function fetchJson(path, options) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed ${path}: ${response.status} ${detail}`.trim());
  }
  return response.json();
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }
  if (typeof req.body === "string" && req.body) {
    return JSON.parse(req.body);
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const [filtersConfiguration, legends] = await Promise.all([
        fetchJson("/api/filters-configuration"),
        fetchJson("/api/legends"),
      ]);

      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
      res.status(200).json({
        filtersConfiguration: filtersConfiguration.message || [],
        legends: legends.message || {},
      });
      return;
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const count = await fetchJson("/api/count-companies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      res.status(200).json(count);
      return;
    }

    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({
      error: "Failed to load filters data",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
};
