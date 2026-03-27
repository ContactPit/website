const BASE_URL = "https://leadlistscraper-524b3d937ddd.herokuapp.com";

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) return JSON.parse(req.body);

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = await readBody(req);
    const response = await fetch(`${BASE_URL}/api/create-order-and-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": req.headers["idempotency-key"] || crypto.randomUUID(),
        "X-Debug-Mode": req.headers["x-debug-mode"] || "false",
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    if (!response.ok) {
      res.status(response.status).json(payload);
      return;
    }

    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({
      error: "Failed to create order payment session",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
};
