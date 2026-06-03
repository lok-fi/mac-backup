"use strict";
const catalyst = require("zcatalyst-sdk-node");

// Helper: safely escape single quotes in email to prevent ZCQL injection
const escapeZCQL = (value) => String(value).replace(/'/g, "\\'");

// Controller to get Channel Partner data filtered by logged-in email
const getChannelPartners = async (req, res) => {
  try {
    const app = req.catalystApp;
    const zcql = app.zcql();

    // Get the authenticated Catalyst user
    const user = await app.userManagement().getCurrentUser();
    if (!user || !user.email_id) {
      return res.json({
        success: false,
        error: "No authenticated user / email not found",
      });
    }

    const loginEmail = escapeZCQL(user.email_id);

    // ZCQL query — filter at DB level instead of fetching all rows
    const query = `SELECT * FROM channel_partner WHERE email = '${loginEmail}' LIMIT 1`;
    const result = await zcql.executeZCQLQuery(query);

    if (!result || result.length === 0) {
      return res.json({
        success: false,
        error: `No channel_partner linked to email ${user.email_id}`,
      });
    }

    // ZCQL wraps each row under the table name
    const match = result[0].channel_partner;

    return res.json({
      success: true,
      data: match,
    });
  } catch (err) {
    console.error("Error fetching channel partners:", err);
    return res.json({
      success: false,
      error: err.message,
    });
  }
};

// post / patch — update user profile
const updateUser = async (req, res) => {
  try {
    console.log("---- UPDATE PROFILE CALLED ----");
    console.log("REQ.BODY =", req.body);

    const app = req.catalystApp;
    const datastore = app.datastore();
    const zcql = app.zcql();
    const cpTable = datastore.table("channel_partner");

    // 1. Auth
    const user = await app.userManagement().getCurrentUser();
    if (!user?.email_id) {
      return res.status(401).json({
        success: false,
        error: "Unauthenticated",
      });
    }

    const loginEmail = user.email_id;
    console.log("Login Email =", loginEmail);

    // 2. Find CP row using ZCQL (only fetch ROWID — faster)
    const safeEmail = escapeZCQL(loginEmail);
    const query = `SELECT ROWID FROM channel_partner WHERE email = '${safeEmail}' LIMIT 1`;
    const result = await zcql.executeZCQLQuery(query);

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Channel Partner not found",
      });
    }

    const cpROWID = result[0].channel_partner.ROWID;
    console.log("CP ROWID =", cpROWID);

    // 3. Build updates safely
    const updates = {};
    if (req.body.cp_name) updates.cp_name = req.body.cp_name;
    if (req.body.mobile) updates.mobile = req.body.mobile;
    if (req.body.agency_name) updates.agency_name = req.body.agency_name;
    if (req.body.city) updates.city = req.body.city;
    if (req.body.address) updates.address = req.body.address;

    if (typeof req.body.OTL === "boolean") {
      updates.OTL = req.body.OTL;
      console.log("🟢 OTL UPDATE REQUESTED =", req.body.OTL);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: "No valid update fields",
      });
    }

    // 4. Apply update
    const updated = await cpTable.updateRow({
      ROWID: cpROWID,
      ...updates,
    });

    console.log("---- UPDATE PROFILE SUCCESS ----");
    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Profile Update Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Internal Server Error",
    });
  }
};

module.exports = {
  getChannelPartners,
  updateUser,
};