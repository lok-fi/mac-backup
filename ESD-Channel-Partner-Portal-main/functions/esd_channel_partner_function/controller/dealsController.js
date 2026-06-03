"use strict";

// Helper: safely escape single quotes in string values to prevent ZCQL injection
const escapeZCQL = (value) => String(value).replace(/'/g, "\\'");

const getDeals = async (req, res) => {
  try {
    const app = req.catalystApp;
    const zcql = app.zcql();

    // 1. Get logged-in Catalyst user
    const user = await app.userManagement().getCurrentUser();
    if (!user || !user.email_id) {
      return res.status(401).json({
        success: false,
        error: "Unauthenticated user",
      });
    }

    const loginEmail = escapeZCQL(user.email_id);

    // 2. Resolve channel_partner ROWID via ZCQL (only fetch ROWID — faster)
    const cpQuery = `SELECT ROWID FROM channel_partner WHERE email = '${loginEmail}' LIMIT 1`;
    const cpResult = await zcql.executeZCQLQuery(cpQuery);

    if (!cpResult || cpResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Channel Partner not found for this login",
      });
    }

    const cpROWID = cpResult[0].channel_partner.ROWID;

    // 3. Fetch deals for this channel partner directly via ZCQL
    const dealQuery = `SELECT * FROM deal WHERE cp_id = '${cpROWID}'`;
    const dealResult = await zcql.executeZCQLQuery(dealQuery);

    // 4. Unwrap rows (ZCQL wraps each row under table name)
    const filtered = (dealResult || []).map(row => row.deal);

    if (filtered.length === 0) {
      return res.status(204).json({
        success: true,
        message: "No deals found",
        data: [],
      });
    }

    // 5. Return filtered deals
    return res.status(200).json({
      success: true,
      data: filtered, // same response format as before
    });
  } catch (err) {
    console.error("Deals Fetch Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Internal Server Error",
    });
  }
};

module.exports = {
  getDeals,
};