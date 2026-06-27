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
import { verifySession, verifyToken } from "./routes/auth";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

const app: Express = express();

app.set("trust proxy", true);

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
// Helmet HTTP Security Headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: [
          "'self'", 
          "data:", 
          "https://*", 
          "http://*"
        ],
        connectSrc: ["'self'", "https://*", "http://*", "ws://*", "wss://*"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Dynamic CORS Origin validation
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      // In development or when no origin is passed (e.g. mobile app, server to server), allow it
      if (process.env.NODE_ENV !== "production" || !origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes("*")) {
        callback(null, true);
      } else {
        logger.warn({ origin }, "Blocked by CORS policy");
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Rate Limiting Config
const whitelistedIps = process.env.WHITELISTED_IPS
  ? process.env.WHITELISTED_IPS.split(",").map(ip => ip.trim())
  : [];

const skipRateLimit = (req: any) => {
  // Always skip rate limiting to ensure owners and tenants can always log in and use the API without blocks
  return true;
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Limit each IP to 5000 requests per windowMs (prevents DDoS/scraping, but safe for busy store Wi-Fi)
  message: { error: "Terlalu banyak permintaan dari IP ini, silakan coba lagi setelah 15 menit." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 auth attempts per windowMs
  message: { error: "Terlalu banyak percobaan masuk/daftar. Silakan coba lagi setelah 15 menit demi keamanan akun Anda." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
});

// Apply rate limiting
app.use("/api", apiLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);

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

    if (!tenant || tenant.status === "suspended" || tenant.status === "frozen") {
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

// Session validation middleware for all authenticated /api routes
app.use("/api", async (req: any, res: any, next: any) => {
  const publicPaths = [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/health",
  ];

  // Exclude public paths and public menu routes
  const isPublicPath = publicPaths.some(p => req.originalUrl.startsWith(p)) || req.originalUrl.startsWith("/api/menu/");

  if (isPublicPath) {
    return next();
  }

  try {
    const claims = await verifySession(req);
    if (!claims) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Check if subscription has expired for trial users
    if (claims.tenantId) {
      const [tenant] = await db
        .select({
          id: tenantsTable.id,
          subscriptionPlan: tenantsTable.subscriptionPlan,
          subscriptionExpiresAt: tenantsTable.subscriptionExpiresAt,
          status: tenantsTable.status,
        })
        .from(tenantsTable)
        .where(eq(tenantsTable.id, claims.tenantId))
        .limit(1);

      if (tenant) {
        if (tenant.status === "suspended" || tenant.status === "frozen") {
          const isAllowedPath = [
            "/api/auth/logout",
          ].some(p => req.originalUrl.startsWith(p));

          if (!isAllowedPath) {
            res.status(403).json({
              error: "tenant_blocked",
              message: tenant.status === "suspended"
                ? "Akun bisnis Anda sedang ditangguhkan (Suspended). Silakan hubungi dukungan FlowApp."
                : "Akun bisnis Anda sedang dibekukan (Frozen). Silakan hubungi dukungan FlowApp."
            });
            return;
          }
        }

        if (tenant.subscriptionPlan === "trial") {
        const now = new Date();
        const expiresAt = tenant.subscriptionExpiresAt ? new Date(tenant.subscriptionExpiresAt) : null;
        if (expiresAt && expiresAt < now) {
          // Allow certain paths for expired trial users to fetch status, logout, or view subscription plans
          const isAllowedPath = [
            "/api/auth/me",
            "/api/auth/logout",
            "/api/tenant",
            "/api/tenant/subscription",
            "/api/subscriptions/plans",
          ].some(p => req.originalUrl.startsWith(p));

          if (!isAllowedPath) {
            res.status(402).json({ error: "trial_expired", message: "Masa uji coba gratis Anda telah habis. Silakan hubungi admin atau lakukan upgrade ke FlowApp UMKM." });
            return;
          }
        }
      }
    }
  }

    // Attach claims to request so downstream route handlers don't need to query db again
    req.claims = claims;
    next();
  } catch (err) {
    logger.error(err, "Error in global session validation middleware");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

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
