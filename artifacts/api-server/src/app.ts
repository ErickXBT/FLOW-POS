import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { db, tenantsTable, publicMenusTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use("/api/uploads", express.static(path.join(process.cwd(), "uploads")));

// Find the frontend public build directory
const possibleStaticDirs = [
  path.resolve(process.cwd(), "../flow-pos/dist/public"),
  path.resolve(process.cwd(), "dist/public"),
  path.resolve(process.cwd(), "artifacts/flow-pos/dist/public"),
  path.resolve(process.cwd(), "flow-pos/dist/public"),
];

let staticDir = "";
for (const dir of possibleStaticDirs) {
  if (fsSync.existsSync(dir) && fsSync.statSync(dir).isDirectory()) {
    staticDir = dir;
    break;
  }
}

if (staticDir) {
  logger.info({ staticDir }, "Found frontend static files directory");
}

// Dynamic SEO menu preview endpoint for crawlers / shared links
app.get("/menu/:slug", async (req, res, next) => {
  const { slug } = req.params;

  try {
    let tenant = null;
    let title = "";
    let logoUrlSource = "";

    // 1. Try to find the public menu by slug directly (handles branch-specific slugs like kebab-central-ende-2)
    const [menu] = await db
      .select()
      .from(publicMenusTable)
      .where(eq(publicMenusTable.slug, slug))
      .limit(1);

    if (menu) {
      const [t] = await db
        .select()
        .from(tenantsTable)
        .where(eq(tenantsTable.id, menu.tenantId))
        .limit(1);
      tenant = t;
      title = `${menu.name} - Menu Online`;
      logoUrlSource = menu.logoUrl || tenant?.logoUrl || "";
    } else {
      // 2. Fall back to finding tenant by slug
      const [t] = await db
        .select()
        .from(tenantsTable)
        .where(eq(tenantsTable.slug, slug))
        .limit(1);
      tenant = t;
      if (tenant) {
        title = `${tenant.name} - Menu Online`;
        logoUrlSource = tenant.logoUrl || "";
      }
    }

    if (!tenant || tenant.status === "suspended") {
      return next();
    }

    // 2. Locate index.html file in dev and production build structures
    const htmlPaths = [];
    if (staticDir) {
      htmlPaths.push(path.join(staticDir, "index.html"));
    }
    htmlPaths.push(
      path.resolve(process.cwd(), "../flow-pos/dist/public/index.html"),
      path.resolve(process.cwd(), "../flow-pos/index.html"),
      path.resolve(process.cwd(), "dist/public/index.html"),
      path.resolve(process.cwd(), "artifacts/flow-pos/dist/public/index.html"),
      path.resolve(process.cwd(), "artifacts/flow-pos/index.html"),
      path.resolve(process.cwd(), "index.html")
    );

    let html = "";
    for (const p of htmlPaths) {
      try {
        html = await fs.readFile(p, "utf-8");
        break;
      } catch {}
    }

    if (!html) {
      return next();
    }

    // 3. Inject tenant profile metadata
    const description = tenant.bio || `Menu digital online resmi dari ${tenant.name}. Silakan pesan menu favorit Anda secara online langsung dari smartphone Anda.`;
    
    const host = req.headers.host || "flowapp.id";
    const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const absoluteOrigin = `${protocol}://${host}`;

    const logoUrl = logoUrlSource
      ? (logoUrlSource.startsWith("http") ? logoUrlSource : `${absoluteOrigin}${logoUrlSource}`)
      : `${absoluteOrigin}/flow_logo.png`;

    // Replace Title
    html = html.replace(/<title>.*?<\/title>/g, `<title>${title}</title>`);

    // Replace Description
    html = html.replace(
      /<meta name="description" content=".*?" \/>/g,
      `<meta name="description" content="${description}" />`
    );

    // Replace Open Graph Title
    html = html.replace(
      /<meta property="og:title" content=".*?" \/>/g,
      `<meta property="og:title" content="${title}" />`
    );

    // Replace Open Graph Description
    html = html.replace(
      /<meta property="og:description" content=".*?" \/>/g,
      `<meta property="og:description" content="${description}" />`
    );

    // Replace Open Graph Image
    if (html.includes('property="og:image"')) {
      html = html.replace(
        /<meta property="og:image" content=".*?" \/>/g,
        `<meta property="og:image" content="${logoUrl}" />`
      );
    } else {
      html = html.replace(
        "</head>",
        `    <meta property="og:image" content="${logoUrl}" />\n    <meta property="og:image:type" content="image/png" />\n  </head>`
      );
    }

    // Replace Twitter Title
    html = html.replace(
      /<meta name="twitter:title" content=".*?" \/>/g,
      `<meta name="twitter:title" content="${title}" />`
    );

    // Replace Twitter Description
    html = html.replace(
      /<meta name="twitter:description" content=".*?" \/>/g,
      `<meta name="twitter:description" content="${description}" />`
    );

    // Replace Twitter Image
    if (html.includes('name="twitter:image"')) {
      html = html.replace(
        /<meta name="twitter:image" content=".*?" \/>/g,
        `<meta name="twitter:image" content="${logoUrl}" />`
      );
    } else {
      html = html.replace(
        "</head>",
        `    <meta name="twitter:image" content="${logoUrl}" />\n  </head>`
      );
    }

    res.setHeader("X-Served-By", "Express-SEO-Preview");
    res.setHeader("Content-Type", "text/html");
    return res.send(html);
  } catch (err: any) {
    logger.error({ err, message: err?.message, slug }, "Error rendering dynamic SEO menu page");
    return next();
  }
});

// Serve frontend static assets in production/cloud environments
if (staticDir) {
  app.use(express.static(staticDir));
}

app.use("/api", router);

// Fallback for SPA routing to handle routes like /login or /dashboard
if (staticDir) {
  app.get("/{*splat}", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.join(staticDir, "index.html"), (err) => {
      if (err) {
        next();
      }
    });
  });
}

export default app;
