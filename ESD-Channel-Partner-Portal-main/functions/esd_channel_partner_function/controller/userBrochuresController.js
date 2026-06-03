"use strict";

/*the admin brochures code is available in the esk_function, index.js code */

// Helper: safely escape single quotes in string values to prevent ZCQL injection
const escapeZCQL = (value) => String(value).replace(/'/g, "\\'");

/* ===========================
   FETCH USER BROCHURES
   =========================== */
const getUserBrochures = async (req, res) => {
  try {
    const app = req.catalystApp;
    const zcql = app.zcql();

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 6;
    const search = (req.query.search || "").trim();
    const category = req.query.category || "All";
    const offset = (page - 1) * pageSize;

    // Auth
    const user = await app.userManagement().getCurrentUser();
    if (!user || !user.email_id) {
      return res.status(401).json({
        success: false,
        error: "Unauthenticated user",
      });
    }

    // Build WHERE clauses dynamically
    const whereClauses = ["is_active = true"];

    if (category && category !== "All") {
      whereClauses.push(`project_type = '${escapeZCQL(category)}'`);
    }

    if (search) {
      const safeSearch = escapeZCQL(search);
      whereClauses.push(`(
        project_name LIKE '%${safeSearch}%'
        OR city LIKE '%${safeSearch}%'
        OR locality LIKE '%${safeSearch}%'
      )`);
    }

    const whereSQL = whereClauses.join(" AND ");

    // Fetch total count + paginated data in parallel
    const [countResult, dataResult] = await Promise.all([
      zcql.executeZCQLQuery(`
        SELECT COUNT(ROWID)
        FROM brochures
        WHERE ${whereSQL}
      `),
      zcql.executeZCQLQuery(`
        SELECT *
        FROM brochures
        WHERE ${whereSQL}
        ORDER BY CREATEDTIME DESC
        LIMIT ${pageSize}
        OFFSET ${offset}
      `),
    ]);

    const total = countResult[0].brochures["COUNT(ROWID)"];
    const brochures = (dataResult || []).map(r => r.brochures);

    return res.status(200).json({
      success: true,
      data: brochures,
      total,
      page,
      pageSize,
    });
  } catch (err) {
    console.error("Brochure Fetch Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Internal server error",
    });
  }
};

/* ===========================
   DOWNLOAD BROCHURE (PDF)
   =========================== */
const downloadBrochure = async (req, res) => {
  try {
    const app = req.catalystApp;

    // Auth
    const user = await app.userManagement().getCurrentUser();
    if (!user || !user.email_id) {
      return res.status(401).json({
        success: false,
        error: "Unauthenticated user",
      });
    }

    // Path validation
    if (!req.query.path) {
      return res.status(400).json({
        success: false,
        error: "Missing file path",
      });
    }

    const key = decodeURIComponent(req.query.path);
    const mode = req.query.mode || "download";

    // Defense: prevent path traversal / access to arbitrary bucket keys
    if (key.includes("..") || key.startsWith("/")) {
      return res.status(400).json({
        success: false,
        error: "Invalid file path",
      });
    }

    // Optional: restrict to brochures folder only (adjust prefix to match your bucket)
    // if (!key.startsWith("brochures/")) {
    //   return res.status(403).json({ success: false, error: "Access denied" });
    // }

    // Fetch from Stratus
    const bucket = app.stratus().bucket("esd-channel-partner");

    let objectStream;
    try {
      objectStream = await bucket.getObject(key);
    } catch (err) {
      console.error("Stratus getObject failed:", err.message);
      return res.status(404).json({
        success: false,
        error: "File not found in bucket",
      });
    }

    // Headers
    res.setHeader("Content-Type", "application/pdf");

    const filename = path.basename(key); // safer than split("/").pop()
    if (mode === "preview") {
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    } else {
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    }

    // Stream with error handling
    objectStream.on("error", (err) => {
      console.error("Stream error:", err);
      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.end();
      }
    });

    objectStream.pipe(res);
  } catch (err) {
    console.error("Download Fatal Error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
};

module.exports = {
  getUserBrochures,
  downloadBrochure,
};