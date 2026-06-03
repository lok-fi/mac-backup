"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");

// Helper: safely escape single quotes in string values to prevent ZCQL injection
const escapeZCQL = (value) => String(value).replace(/'/g, "\\'");

const uploadProfilePicture = async (req, res) => {
  let tempPath = null;

  try {
    const app = req.catalystApp;
    const datastore = app.datastore();
    const zcql = app.zcql();
    const table = datastore.table("channel_partner");

    // =========================
    // AUTH
    // =========================
    const user = await app.userManagement().getCurrentUser();
    if (!user || !user.email_id) {
      return res.status(401).json({
        success: false,
        error: "Unauthenticated user",
      });
    }

    // =========================
    // FIND CHANNEL PARTNER ROW (ZCQL instead of getAllRows)
    // =========================
    const safeEmail = escapeZCQL(user.email_id);
    const cpQuery = `
      SELECT ROWID, profile_path
      FROM channel_partner
      WHERE email = '${safeEmail}'
      LIMIT 1
    `;
    const cpResult = await zcql.executeZCQLQuery(cpQuery);

    if (!cpResult || cpResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User record not found",
      });
    }

    const cp = cpResult[0].channel_partner;

    // =========================
    // FILE VALIDATION
    // =========================
    const file = req.files?.profile_picture;
    if (!file) {
      return res.status(400).json({
        success: false,
        error: "Profile picture not provided",
      });
    }

    // Validate mimetype (defense in depth)
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}`,
      });
    }

    // Validate size (e.g., 5MB cap)
    const MAX_SIZE_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      return res.status(400).json({
        success: false,
        error: "File too large. Max size: 5MB",
      });
    }

    const bucket = app.stratus().bucket("esd-channel-partner");

    // =========================
    // WRITE NEW IMAGE TO TEMP → UPLOAD TO STRATUS
    // (We upload the NEW file first, delete OLD only after success)
    // =========================
    const safeFileName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${Date.now()}_${safeFileName}`;
    tempPath = path.join(os.tmpdir(), fileName);
    await file.mv(tempPath);

    const key = `profile_picture/${cp.ROWID}_${fileName}`;
    console.log("Uploading new profile picture to Stratus:", key);

    await bucket.putObject(key, fs.createReadStream(tempPath), {
      overwrite: true,
      contentType: file.mimetype,
    });

    // =========================
    // UPDATE DB WITH NEW PATH
    // =========================
    const updated = await table.updateRow({
      ROWID: cp.ROWID,
      profile_path: key,
    });

    // =========================
    // DELETE OLD IMAGE (best-effort, after new one is saved)
    // =========================
    if (cp.profile_path && cp.profile_path !== key) {
      try {
        await bucket.deleteObject(cp.profile_path);
        console.log("Old profile picture deleted:", cp.profile_path);
      } catch (deleteErr) {
        // Non-fatal — new image is already saved. Just log it.
        console.warn("Could not delete old image:", deleteErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      profile_path: key,
      data: updated,
    });
  } catch (err) {
    console.error("Profile Picture Upload Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  } finally {
    // =========================
    // ALWAYS CLEAN UP TEMP FILE (even on error)
    // =========================
    if (tempPath) {
      try {
        await fs.promises.unlink(tempPath);
      } catch (_) {
        // temp file might not exist if mv() failed — ignore
      }
    }
  }
};

module.exports = { uploadProfilePicture };