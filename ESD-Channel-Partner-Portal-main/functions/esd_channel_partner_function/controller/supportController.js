"use strict";

const getSupport = async (req, res) => {
  try {
    const app = req.catalystApp;
    const datastore = app.datastore();

    const supportTable = datastore.table("support_ticket");
    const cpTable = datastore.table("channel_partner");

    // 1. Get logged-in user from Catalyst
    const user = await app.userManagement().getCurrentUser();
    if (!user || !user.email_id) {
      return res.status(401).json({
        success: false,
        error: "Unauthenticated user"
      });
    }

    const loginEmail = user.email_id;

    // 2. Resolve Channel Partner (ROWID)
    const cpRows = await cpTable.getAllRows();
    const cp = cpRows.find(r => r.email === loginEmail);

    if (!cp) {
      return res.status(404).json({
        success: false,
        error: "Channel Partner not found for this login"
      });
    }

    const cpROWID = cp.ROWID;

    // 3. Fetch all support tickets
    const rows = await supportTable.getAllRows();

    // 4. Filter only this CP's tickets
    const filtered = rows.filter(r => r.cp_id === cpROWID);

    // 5. No content scenario
    if (!filtered || filtered.length === 0) {
      return res.status(204).json({
        success: true,
        message: "No support tickets found",
        data: []
      });
    }

    // 6. Return filtered tickets
    return res.status(200).json({
      success: true,
      data: filtered
    });

  } catch (err) {
    console.error("Support Fetch Error:", err);

    return res.status(500).json({
      success: false,
      error: err.message || "Internal Server Error"
    });
  }
};

module.exports = { getSupport };
