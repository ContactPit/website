module.exports = async function handler(_req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
      merchantCountry: process.env.STRIPE_MERCHANT_COUNTRY || "EE",
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to load checkout config",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
};
