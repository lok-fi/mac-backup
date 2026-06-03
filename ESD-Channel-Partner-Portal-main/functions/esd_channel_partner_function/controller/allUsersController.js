"use strict";
const axios = require("axios");
const catalyst = require("zcatalyst-sdk-node");

/**
 * Retrieves all users with the role 'App User'
 */

 const credentials = {
    //live
    USERConnector: {
      client_id: "1000.MHJNQ4L3G2NIO4EBXKT86POD1WAI9J",
      client_secret: "4aa4cf841974ca7892568d8efdcdb369cc91693658",
      auth_url: "https://accounts.zoho.in/oauth/v2/token",
      refresh_url: "https://accounts.zoho.in/oauth/v2/token",
      refresh_token:  "1000.30f20ec0953634128b17e2494813856d.1609b4c6f1b26f3804413464ccc0c449",
    },
  };



 async function getZohoAccessToken(req) {
    const catalystApp = catalyst.initialize(req);
    const cache = catalystApp.cache().segment();

    let accessToken = await cache.get("USERConnector");
    // console.log("Token",accessToken);
    if (!accessToken.cache_value) {
      console.log("Access token not found in cache, generating a new one...");
      try {
        accessToken = await catalystApp
          .connection(credentials)
          .getConnector("USERConnector")
          .getAccessToken();

        if (accessToken) {
          await cache.put("USERConnector", accessToken, 1);
          console.log("New access token generated and cached.");
          return accessToken;
        }
      } catch (error) {
        console.error("Error generating Zoho access token:", error);
        return null;
      }
    } else {
      console.log("Using cached access token.");
    }

    return accessToken.cache_value;
  }

const getAllAppUsers = async (req, res) => {
  try {
    const app = req.catalystApp;

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;

    const offset = (page - 1) * pageSize;

    const userMgmt = app.userManagement();
    const users = await userMgmt.getAllUsers();
//new code .map(u => u.Email)
    const pendingUserIds = users.filter(u => !u.is_confirmed).map(u => u.email_id);
  const zcql = app.zcql();

const query = `
  SELECT email, last_invite_log 
  FROM channel_partner 
  WHERE email IN (${pendingUserIds.map(email_id => `'${email_id}'`).join(",")})
`;

const cpRows = await zcql.executeZCQLQuery(query);
const cpMap = {};

cpRows.forEach(row => {
  const data = row.channel_partner;
  cpMap[data.email] = data;
});
//new code till
//console.log("pendingUserIds",cpMap);
    const mapped = users.map((u) => {
      const cp = cpMap[u.email_id];
      return{
      user_id: u.user_id,
      email: u.email_id,
      first_name: u.first_name,
      last_name: u.last_name,
      role: u.role_details?.role_name,
      status: u.status,
      created_time: u.created_time,
      is_confirmed: u.is_confirmed,
      invited_time: u.invited_time,
      //new code 
       last_invite_log: cp?.last_invite_log || null
      };
    });

    const total = mapped.length;

    const paginated = mapped.slice(offset, offset + pageSize);

    return res.status(200).json({
      success: true,
      data: paginated,
      total,
      page,
      pageSize
    });

  } catch (err) {
    console.error("getAllAppUsers ERROR:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};
/**
 * Updates a user's status (ENABLE / DISABLE) based on 'active' boolean
 */
const updateStatus = async (req, res) => {
  try {
    //console.log("updateStatus REQ BODY:", req.body);

    const app = req.catalystApp;
    if (!app) {
      return res.status(500).json({
        success: false,
        error: "Catalyst app not initialized",
      });
    }

    // Ensure body is parsed correctly
    let body = req.body;
    if (typeof body === "string") {
      body = JSON.parse(body);
    }

    const user_ID = body?.user_id?.toString(); // force string
    const active = body?.active;

    //console.log("Parsed PAYLOAD:", user_ID, active);

    // Validation
    if (!user_ID || typeof active !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Invalid parameters",
      });
    }

    const userManagement = app.userManagement();

    console.log(
      `Updating user status → user_ID: ${user_ID}, active: ${active}`
    );

    // ✅ EXACTLY like the working code
    const response = await userManagement.updateUserStatus(
      user_ID,
      active ? "enable" : "disable"
    );

    console.log("Catalyst updateUserStatus response:", response);

    return res.status(200).json({
      success: true,
      data: response,
    });

  } catch (error) {
    console.error("updateStatus ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update user status",
      error: error.message,
    });
  }
};



// this is for the reinvite part
const reinviteUser = async (req, res) => {
  const { first_name, last_name, email_id } = req.body;
  
  
  try {
    const token = await getZohoAccessToken(req);

    const reinviteData = {
      platform_type: "web",
     redirect_url:"https://esd-channel-partner-60040289923.development.catalystserverless.in/",
      user_details: {
        email_id: email_id,
          first_name: first_name,
          last_name: last_name,
      },

      template_details: {
        subject: "Reminder: Complete Your SKYi Channel Partner Registration",
        message: `<html> %LINK% </html>`,
      },
    };
    // console.log("reinvite",reinviteData,"token",token);
    

    const apiResponse = await axios.post(
      "https://api.catalyst.zoho.in/baas/v1/project/17682000000608987/project-user/re-invite",
      reinviteData,
      {
        headers: {
          "catalyst-org": "60040289923",
          "content-type": "application/json",
          environment: "Development",
          Authorization: `Zoho-oauthtoken ${token}`,
        },
      }
    );

    
    console.log("Reinvite API Response:", apiResponse);

    /* ============================
       UPDATE LAST INVITE
    ============================ */
    const app = req.catalystApp;
    const datastore = app.datastore();
    const cpTable = datastore.table("channel_partner");

    // DIRECT UPDATE USING user_id (NO QUERY NEEDED)
    const zcql = app.zcql();
    const query = `
      SELECT ROWID FROM channel_partner 
      WHERE email = '${email_id}'
    `;

    const result = await zcql.executeZCQLQuery(query);
    const cp = result?.[0]?.channel_partner;
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");

    if (cp?.ROWID) {
      await cpTable.updateRow({
        ROWID: cp.ROWID,
        last_invite_log	: now,
      });
    }


    return res.status(200).json({
      success: true,
      message: "User reinvited successfully",
      data: apiResponse.data,
    });

  } catch (error) {
    console.error("Reinvite error:", error.response ? error.response.data : error.message);

    return res.status(500).json({
      success: false,
      message: "Unexpected error occurred",
      error: error.message,
    });
  }
};

module.exports = reinviteUser;
module.exports = {
  getAllAppUsers,
  updateStatus,
  reinviteUser,
};
