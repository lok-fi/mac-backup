
"use strict";

const express = require("express");
const catalyst = require("zcatalyst-sdk-node");

const app = express();

// 🔹 Middleware
app.use(express.json());

// ===============================
// 🔥 COMMISSION API
// ===============================
app.post("/commission", async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const datastore = catalystApp.datastore();
    const zcql = catalystApp.zcql();

    const commissionTable = datastore.table("commission");

    const body = req.body;

    // ✅ Validate
    if (!body || !Array.isArray(body.CPOrders)) {
      return res.status(400).json({
        success: false,
        error: "Invalid payload. CPOrders array required"
      });
    }

    const orders = body.CPOrders;

    // 🚀 1. Get all SO_Numbers
    const soNumbers = orders.map(o => o.SO_Number);

    // 🚀 2. Fetch existing records
    const query = `
      SELECT ROWID, SO_Number FROM commission
      WHERE SO_Number IN (${soNumbers.map(so => `'${so}'`).join(",")})
    `;

    const existing = await zcql.executeZCQLQuery(query);

    // 🚀 3. Map for quick lookup
    const existingMap = new Map();
    existing.forEach(row => {
      existingMap.set(row.commission.SO_Number, row.commission.ROWID);
    });

    // 🚀 4. Insert / Update
    const operations = orders.map(async (order) => {

      const newRecord = {
        SO_Number: order.SO_Number,
        SO_Date: order.SO_Date,
        Customer_Code: order.Customer_Code,
        Customer_Name: order.Customer_Name,
        Registration_Date: order.Registration_Date,
        Registration_Num: order.Registration_Num,
        CP_Code: order.CP_Code,
        CP_Vendor_Name: order.CP_Vendor_Name,
        CP_Scheme: order.CP_Scheme,
        CP_Commission: String(order.CP_Commission),
        Building: order.Building,
        Unit_No: order.Unit_No,
        Project_Name: order.Project_Name,
        Agreement_Value: String(order.Agreement_Value),
        SO_CreateDate: order.SO_CreateDate,
        Registration_UpdateDate: order.Registration_UpdateDate,
        Commission_CalcDate: order.Commission_CalcDate
      };

      if (existingMap.has(order.SO_Number)) {
        return commissionTable.updateRow({
          ROWID: existingMap.get(order.SO_Number),
          ...newRecord
        });
      } else {
        return commissionTable.insertRow(newRecord);
      }
    });

    await Promise.all(operations);

    return res.status(200).json({
      success: true,
      message: "Commission sync completed"
    });

  } catch (err) {
    console.error("Commission Error:", err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ===============================
// 🔹 HEALTH CHECK (optional)
// ===============================
app.get("/health", (req, res) => {
  res.send("SAP API is running 🚀");
});

// ===============================
// ❌ 404 HANDLER
// ===============================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

// ===============================
// 🚀 EXPORT EXPRESS APP
// ===============================
module.exports = app;