import { defineConfig } from "vite";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";

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
          const pathname = (req.url || "").split("?")[0];

          if (req.method === "GET" && /^\/company\/[^/.]+\/?$/.test(pathname)) {
            const template = await readFile(resolve(process.cwd(), "company/index.html"), "utf8");
            const html = await server.transformIndexHtml(pathname, template, req.originalUrl);
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(html);
            return;
          }

          if (req.method === "GET" && /^\/person\/[^/.]+\/?$/.test(pathname)) {
            const template = await readFile(resolve(process.cwd(), "person/index.html"), "utf8");
            const html = await server.transformIndexHtml(pathname, template, req.originalUrl);
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(html);
            return;
          }

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

          if (req.url === "/api/legends" && req.method === "GET") {
            const legends = await upstreamJson("/api/legends");
            const legendPayload = legends.message || {};
            sendJson(res, 200, {
              ...legends,
              message: {
                ...legendPayload,
                emtak_descriptions: buildEmtakDescriptions(legendPayload.emtaks, legendPayload.emtaks_old),
              },
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

          if (req.method === "GET" && req.url?.startsWith("/api/search")) {
            const requestUrl = new URL(req.url, "http://localhost");
            const query = requestUrl.searchParams.get("q") || "";
            const payload = await upstreamJson(`/api/search?q=${encodeURIComponent(query)}`);
            sendJson(res, 200, payload);
            return;
          }

          if (req.method === "GET" && req.url?.startsWith("/api/company")) {
            const requestUrl = new URL(req.url, "http://localhost");
            const slug = requestUrl.searchParams.get("slug") || "";
            if (!slug) {
              sendJson(res, 400, { error: "Missing slug query parameter" });
              return;
            }

            const [payload, legends] = await Promise.all([
              upstreamJson(`/api/company/full?slug=${encodeURIComponent(slug)}`),
              upstreamJson("/api/legends"),
            ]);
            const legendPayload = legends.message || {};
            sendJson(res, 200, {
              ...payload,
              legends: {
                ...legendPayload,
                emtak_descriptions: buildEmtakDescriptions(legendPayload.emtaks, legendPayload.emtaks_old),
              },
            });
            return;
          }

          if (req.method === "GET" && req.url?.startsWith("/api/person")) {
            const requestUrl = new URL(req.url, "http://localhost");
            const slug = requestUrl.searchParams.get("slug") || "";
            if (!slug) {
              sendJson(res, 400, { error: "Missing slug query parameter" });
              return;
            }

            const payload = await upstreamJson(`/api/person?slug=${encodeURIComponent(slug)}`);
            sendJson(res, 200, payload);
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
        company: resolve(process.cwd(), "company/index.html"),
        person: resolve(process.cwd(), "person/index.html"),
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
