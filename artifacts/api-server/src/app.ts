import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import path from "path";
import fs from "fs/promises";
import { db, tenantsTable } from "@workspace/db";
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

// Dynamic SEO menu preview endpoint for crawlers / shared links
app.get("/menu/:slug", async (req, res, next) => {
  const { slug } = req.params;

  try {
    // 1. Fetch tenant details from DB
    const [tenant] = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, slug));

    if (!tenant || tenant.status === "suspended") {
      return next();
    }

    // 2. Locate index.html file in dev and production build structures
    const possiblePaths = [
      path.resolve(process.cwd(), "../flow-pos/dist/public/index.html"),
      path.resolve(process.cwd(), "../flow-pos/index.html"),
      path.resolve(process.cwd(), "dist/public/index.html"),
      path.resolve(process.cwd(), "artifacts/flow-pos/dist/public/index.html"),
      path.resolve(process.cwd(), "artifacts/flow-pos/index.html"),
      path.resolve(process.cwd(), "index.html"),
    ];

    let html = "";
    for (const p of possiblePaths) {
      try {
        html = await fs.readFile(p, "utf-8");
        break;
      } catch {}
    }

    if (!html) {
      return next();
    }

    // 3. Inject tenant profile metadata
    const title = `${tenant.name} - Menu Online`;
    const description = tenant.bio || `Menu digital online resmi dari ${tenant.name}. Silakan pesan menu favorit Anda secara online langsung dari smartphone Anda.`;
    
    const host = req.headers.host || "flowapp.id";
    const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const absoluteOrigin = `${protocol}://${host}`;

    const logoUrl = tenant.logoUrl
      ? (tenant.logoUrl.startsWith("http") ? tenant.logoUrl : `${absoluteOrigin}${tenant.logoUrl}`)
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

    res.setHeader("Content-Type", "text/html");
    return res.send(html);
  } catch (err) {
    logger.error({ err, slug }, "Error rendering dynamic SEO menu page");
    return next();
  }
});

app.use("/api", router);

export default app;
