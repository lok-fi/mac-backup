"use strict";

const express = require("express");
const app = express();
const cors = require("cors");
const axios = require("axios");
const catalyst = require("zcatalyst-sdk-node");

const { getCrmAccessToken } = require("./crmTokenManager");

app.use(cors());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Helper: safely escape single quotes in string values to prevent ZCQL injection
const escapeZCQL = (value) => String(value).replace(/'/g, "\\'");

/* ================================================================
   GET LEADS (paginated, filtered by logged-in channel partner)
================================================================ */
const getLeads = async (req, res) => {
  try {
    const catalystApp = req.catalystApp;
    const zcql = catalystApp.zcql();

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    // 1. Auth
    const user = await catalystApp.userManagement().getCurrentUser();
    if (!user || !user.email_id) {
      return res.status(401).json({
        success: false,
        error: "Unauthenticated user",
      });
    }

    const loginEmail = escapeZCQL(user.email_id);

    // 2. Resolve channel_partner ROWID
    const cpQuery = `
      SELECT ROWID
      FROM channel_partner
      WHERE email = '${loginEmail}'
      LIMIT 1
    `;
    const cpResult = await zcql.executeZCQLQuery(cpQuery);

    if (!cpResult || cpResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Channel Partner not found",
      });
    }

    const cpROWID = cpResult[0].channel_partner.ROWID;
    const safeCpROWID = escapeZCQL(cpROWID);

    // 3. Fetch total count + paginated data in parallel
    const [countResult, dataResult] = await Promise.all([
      zcql.executeZCQLQuery(`
        SELECT COUNT(ROWID)
        FROM lead
        WHERE cp_id = '${safeCpROWID}'
      `),
      zcql.executeZCQLQuery(`
        SELECT *
        FROM lead
        WHERE cp_id = '${safeCpROWID}'
        ORDER BY CREATEDTIME DESC
        LIMIT ${pageSize}
        OFFSET ${offset}
      `),
    ]);

    const total = countResult[0].lead["COUNT(ROWID)"];
    const leads = (dataResult || []).map(r => r.lead);

    return res.status(200).json({
      success: true,
      data: leads,
      total,
      page,
      pageSize,
    });
  } catch (err) {
    console.error("Leads Fetch Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

/* ================================================================
   CREATE LEAD (pushes to Zoho CRM + handles token refresh)
================================================================ */
const createLead = async (req, res) => {
  const {
    customer_name,
    customer_mobile,
    customer_email,
    city,
    project_name,
    Min_Budget_lacs,
    Max_Budget_lacs,
    lead_status,
    site_visit_status,
    Lead_Source,
    Reference_Source,
    cp_id,
  } = req.body;

  if (!customer_name || !customer_mobile) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: customer_name and customer_mobile",
    });
  }

  if (!cp_id) {
    return res.status(400).json({
      success: false,
      error: "Missing required field: cp_id",
    });
  }

  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();

    // 1. Verify channel partner exists and fetch CRM cp_id
    const safeCpId = escapeZCQL(cp_id);
    const query = `
      SELECT cp_id
      FROM channel_partner
      WHERE ROWID = '${safeCpId}'
      LIMIT 1
    `;
    const cpData = await zcql.executeZCQLQuery(query);

    if (!cpData || cpData.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Channel Partner not found",
      });
    }

    const cpIdFromDB = cpData[0].channel_partner.cp_id;

    // 2. Build CRM payload
    const payload = {
      data: [
        {
          Last_Name: customer_name,
          Mobile: customer_mobile,
          Email: customer_email,
          Address_City: city,
          Sales_Project: project_name ? [project_name] : [],
          Min_Budget_lacs,
          Max_Budget_lacs,
          Lead_Status: lead_status,
          Site_Visit_Status: site_visit_status,
          Lead_Source,
          CP_Name: { id: cpIdFromDB },
          Reference_Source: Reference_Source || "CP",
        },
      ],
    };

    // 3. CRM API call with token refresh on INVALID_TOKEN
    const postToCRM = async (token) =>
      axios.post("https://www.zohoapis.com/crm/v8/Leads", payload, {
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          "Content-Type": "application/json",
        },
      });

    let crmAccessToken = await getCrmAccessToken();
    let response;

    try {
      response = await postToCRM(crmAccessToken);
    } catch (err) {
      if (err.response?.data?.code === "INVALID_TOKEN") {
        console.warn("[CRM] INVALID_TOKEN detected → refreshing token");
        crmAccessToken = await getCrmAccessToken(true);
        response = await postToCRM(crmAccessToken);
      } else {
        throw err;
      }
    }

    return res.status(201).json({
      success: true,
      message: "Lead created successfully",
      lead: response.data,
    });
  } catch (error) {
    console.error("Create Lead Error:", error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
};

/* ================================================================
   SEARCH LEADS (scoped to logged-in channel partner)
================================================================ */
const searchLeads = async (req, res) => {
  try {
    const catalystApp = req.catalystApp;
    const zcql = catalystApp.zcql();

    const searchWord = (req.query.search || "").trim();
    if (!searchWord) {
      return res.status(400).json({ success: false, error: "search query is required" });
    }

    // 1. Auth
    const user = await catalystApp.userManagement().getCurrentUser();
    if (!user || !user.email_id) {
      return res.status(401).json({ success: false, error: "Unauthenticated user" });
    }

    const loginEmail = escapeZCQL(user.email_id);

    // 2. Resolve channel_partner ROWID
    const cpResult = await zcql.executeZCQLQuery(`
      SELECT ROWID FROM channel_partner WHERE email = '${loginEmail}' LIMIT 1
    `);
    if (!cpResult || cpResult.length === 0) {
      return res.status(404).json({ success: false, error: "Channel Partner not found" });
    }

    const cpROWID = cpResult[0].channel_partner.ROWID;

    // 3. Use Catalyst search API — append "*" for prefix matching (e.g. "kar*" finds "Karan")
    const capp = catalyst.initialize(req);

    const searchQuery = {
      search: searchWord + "*",
      search_table_columns: {
        lead: ["customer_name"]
      }
    };

    const result = await capp
      .search()
      .executeSearchQuery(searchQuery);

    // 4. Filter results to this CP's leads only
    const leads = (result.lead || []).filter(l => String(l.cp_id) === String(cpROWID));

    return res.status(200).json({
      success: true,
      total: leads.length,
      data: leads
    });
  } catch (err) {
    console.error("Lead Search Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};

module.exports = { getLeads, createLead, searchLeads };