const leadJourney = async (req, res) => {
  try {
    const catalyst = require("zcatalyst-sdk-node");
    const app = catalyst.initialize(req);
    const zcql = app.zcql();

    const leadId = req.query.leadId;

    if (!leadId) {
      return res.status(400).send({
        success: false,
        message: "leadId is required"
      });
    }

    /* ===============================
       1️⃣ FETCH LEAD
    =============================== */
    const leadResp = await zcql.executeZCQLQuery(`
      SELECT * FROM lead WHERE ROWID = '${leadId}' LIMIT 1
    `);
    console.log("LEADSSSS",leadResp);

    const lead = leadResp[0]?.lead || null;

    /* ===============================
       2️⃣ FETCH DEAL
    =============================== */
    let deal = null;

    if (lead) {
      const dealResp = await zcql.executeZCQLQuery(`
        SELECT * FROM deal WHERE lead_id = '${leadId}' LIMIT 1
      `);

      deal = dealResp[0]?.deal || null;
    }

    /* ===============================
       3️⃣ FETCH SALES ORDER
    =============================== */
    let salesOrder = null;

if (deal && deal.ROWID) {

  console.log("deal.ROWID", deal.ROWID);

  const soResp = await zcql.executeZCQLQuery(`
    SELECT * FROM sales_order WHERE deal_id = '${deal.ROWID}' LIMIT 1
  `);

  salesOrder = soResp?.[0]?.sales_order || null;

  console.log("SOOOOO", soResp);
}

//console.log("SOOOOO1", salesOrder);

    /* ===============================
       4️⃣ COMPUTE OVERALL STATUS
    =============================== */
    const getOverallStatus = () => {

      // ❌ Rejected
      if (
        ["Unqualified", "Closed Lost"].includes(lead?.lead_status) ||
        ["Unqualified", "Closed Lost"].includes(deal?.deal_stage) ||
        ["Cancelled", "Rejected", "Approved-Cancelled"].includes(
          salesOrder?.booking_status
        )
      ) {
        return "Rejected";
      }

      // ✅ Possession
      if (salesOrder?.booking_status === "Possesion completed") {
        return "Possession Completed";
      }

      // ✅ SAP
      if (
        [
          "Updated in SAP",
          "Registration planned",
          "Collection Stage",
          "Ready for Handover",
          "Handover Planned"
        ].includes(salesOrder?.booking_status)
      ) {
        return "Updated in SAP";
      }

      // ✅ Sales Order
      if (salesOrder) {
        return "Sales Order Created";
      }

      // ✅ Deal
      if (deal) {
        return "Site Visit Done";
      }

      // ✅ Lead Progress
      if (
        ["In process", "Site Visit Confirmed", "Converted"].includes(
          lead?.lead_status
        )
      ) {
        return "In Process";
      }

      // ✅ Default
      return "Lead Created";
    };

    const overall_status = getOverallStatus();

    /* ===============================
       5️⃣ RESPONSE
    =============================== */
    return res.send({
      success: true,
      data: {
        lead,
        deal,
        salesOrder,
        overall_status
      }
    });

  } catch (error) {
    console.error("Lead Journey Error:", error);

    return res.status(500).send({
      success: false,
      message: "Internal Server Error"
    });
  }
};

module.exports={leadJourney};