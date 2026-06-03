"use strict";

const getSalesOrder = async (req, res) => {
  try {
    const app = req.catalystApp;
    const datastore = app.datastore();

    const salesOrderTable = datastore.table("sales_order");
    const cpTable = datastore.table("channel_partner");

    // 1. Get logged-in Catalyst user
    const user = await app.userManagement().getCurrentUser();
    if (!user || !user.email_id) {
      return res.status(401).json({
        success: false,
        error: "Unauthenticated user"
      });
    }

    const loginEmail = user.email_id;

    // 2. Find channel_partner by email → resolve ROWID
    const cpRows = await cpTable.getAllRows();
    const cp = cpRows.find(r => r.email === loginEmail);

    if (!cp) {
      return res.status(404).json({
        success: false,
        error: "Channel Partner not found for this login"
      });
    }

    const cpROWID = cp.ROWID;

    // 3. Get all sales order rows
    const rows = await salesOrderTable.getAllRows();

    // 4. Filter only logged-in CP's orders
    const filtered = rows.filter(r => r.cp_id === cpROWID);

    // 5. No content scenario
    if (!filtered || filtered.length === 0) {
      return res.status(204).json({
        success: true,
        message: "No sales orders found",
        data: []
      });
    }

    // 6. Return filtered orders (FORMAT UNCHANGED)
    return res.status(200).json({
      success: true,
      data: filtered
    });

  } catch (err) {
    console.error("Sales Order Fetch Error:", err);

    return res.status(500).json({
      success: false,
      error: err.message || "Internal Server Error"
    });
  }
};

module.exports = { getSalesOrder };
