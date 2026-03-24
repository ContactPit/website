import { defineConfig } from "vite";
import { resolve } from "node:path";

const BASE_URL = "https://leadlistscraper-524b3d937ddd.herokuapp.com";
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

async function upstreamJson(path, init) {
  const response = await fetch(`${BASE_URL}${path}`, init);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Upstream ${path} failed: ${response.status} ${detail}`.trim());
  }
  return response.json();
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function apiRoutesPlugin() {
  return {
    name: "contactpit-local-api-routes",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          if (req.method === "GET" && req.url === "/api/home") {
            const [trending, leaderboards, catalog, counties, essentials] = await Promise.all([
              upstreamJson("/api/trending"),
              upstreamJson("/api/leaderboards"),
              upstreamJson("/api/catalog"),
              upstreamJson("/api/counties"),
              upstreamJson("/api/essentials"),
            ]);

            sendJson(res, 200, {
              trending: trending.message,
              leaderboards: leaderboards.message,
              catalog: catalog.message,
              counties: counties.message,
              testimonials: essentials.message.testimonials,
            });
            return;
          }

          if (req.url === "/api/filters" && req.method === "GET") {
            const [filtersConfiguration, legends] = await Promise.all([
              upstreamJson("/api/filters-configuration"),
              upstreamJson("/api/legends"),
            ]);

            sendJson(res, 200, {
              filtersConfiguration: filtersConfiguration.message || [],
              legends: legends.message || {},
            });
            return;
          }

          if (req.url === "/api/filters" && req.method === "POST") {
            const body = await readJsonBody(req);
            const count = await upstreamJson("/api/count-companies", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
            });

            sendJson(res, 200, count);
            return;
          }

          next();
        } catch (error) {
          sendJson(res, 500, {
            error: "Local API route failed",
            detail: error instanceof Error ? error.message : String(error),
          });
        }
      });
    },
  };
}

function assetVersionPlugin() {
  return {
    name: "contactpit-asset-version",
    transformIndexHtml(html) {
      return html.replaceAll("__ASSET_VERSION__", Date.now().toString());
    },
  };
}

export default defineConfig({
  plugins: [apiRoutesPlugin(), assetVersionPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), "index.html"),
        about: resolve(process.cwd(), "about/index.html"),
        blog: resolve(process.cwd(), "blog/index.html"),
        filters: resolve(process.cwd(), "filters/index.html"),
        builder: resolve(process.cwd(), "builder/index.html"),
      },
    },
  },
  server: {
    headers: NO_STORE_HEADERS,
    port: 4173,
  },
  preview: {
    headers: NO_STORE_HEADERS,
    port: 4173,
  },
});
