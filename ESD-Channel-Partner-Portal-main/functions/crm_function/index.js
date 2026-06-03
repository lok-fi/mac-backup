"use strict"
 
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const path = require("path");
const os = require("os");
const fs = require("fs");
const axios = require("axios");
app.use(fileUpload());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
const catalyst = require("zcatalyst-sdk-node");
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
 
app.use((req, res, next) => {
  req.catalystApp = catalyst.initialize(req);
  next();
});
 
app.post("/LeadDetails", async (req, res) => {
  const leadData = req.body;
 
  if (!leadData || Object.keys(leadData).length === 0) {
    return res
      .status(400)
      .send({ success: false, error: "Invalid lead data" + leadData });
  }
 
  try {
    const catalystApp = req.catalystApp;
 
    const query =
      "SELECT * FROM lead WHERE customer_email = '" +
      leadData.customer_email +
      "'";
 
    // console.log(query);
    const checkleadData = await catalystApp.zcql().executeZCQLQuery(query);
    console.log(checkleadData);
 
    if (checkleadData && checkleadData.length > 0) {
      return res
        .status(400)
        .send({ success: false, error: "Lead already exists" });
    }
 
    const LeadTable = await catalystApp.datastore().table("lead");
    const newLeadData = await LeadTable.insertRow(leadData);
 
    if (newLeadData) {
      return res.status(201).send({
        success: true,
        data: newLeadData,
      });
    } else {
      return res
        .status(400)
        .send({ success: false, error: "Failed to insert lead data" });
    }
  } catch (error) {
    return res
      .status(500)
      .send({ success: false, error: "Internal Server Error" });
  }
});

app.put("/LeadDetailsUpdate/:ROWID", async (req, res) => {
  try {
    const tableID = req.params.ROWID; // Get ROWID from the URL params
    const lead = req.body;

    if (!lead || Object.keys(lead).length === 0) {
      return res
        .status(400)
        .send({ success: false, error: "Invalid lead data" });
    }

    const catalystApp = req.catalystApp;
    const leadTable = await catalystApp.datastore().table("lead");

    const updatedlead = await leadTable.updateRow({
      ROWID: tableID,
      ...lead,
    });

    if (updatedlead) {
      return res.status(200).send({
        success: true,
        data: updatedlead,
      });
    } else {
      return res
        .status(400)
        .send({ success: false, error: "Failed to update lead" });
    }
  } catch (err) {
    //console.error("Error:", err);
    res.status(500).send({ success: false, error: "Internal Server Error" });
  }
});

app.post("/dealDetails", async (req, res) => {
  const dealData = req.body;
 
  if (!dealData || Object.keys(dealData).length === 0) {
    return res
      .status(400)
      .send({ success: false, error: "Invalid deal data" + dealData });
  }
 
  try {
    const catalystApp = req.catalystApp;
 
    const query =
      "SELECT * FROM deal WHERE deal_id = '" +
      dealData.deal_id +
      "'";
 
    // console.log(query);
    const checkdealData = await catalystApp.zcql().executeZCQLQuery(query);
    console.log(checkdealData);
 
    if (checkdealData && checkdealData.length > 0) {
      return res
        .status(400)
        .send({ success: false, error: "Deal already exists" });
    }
 
    const DealTable = await catalystApp.datastore().table("deal");
    const newdealData = await DealTable.insertRow(dealData);
 
    if (newdealData) {
      return res.status(201).send({
        success: true,
        data: newdealData,
      });
    } else {
      return res
        .status(400)
        .send({ success: false, error: "Failed to insert deal data" });
    }
  } catch (error) {
    return res
      .status(500)
      .send({ success: false, error: "Internal Server Error" });
  }
});

app.put("/deals/:ROWID", async (req, res) => {
  try {
    const tableID = req.params.ROWID; // Get ROWID from the URL params
    const deal = req.body;

    if (!deal || Object.keys(deal).length === 0) {
      return res
        .status(400)
        .send({ success: false, error: "Invalid deal data" });
    }

    const catalystApp = req.catalystApp;
    const dealTable = await catalystApp.datastore().table("deal");

    const updateddeal = await dealTable.updateRow({
      ROWID: tableID,
      ...deal,
    });

    if (updateddeal) {
      return res.status(200).send({
        success: true,
        data: updateddeal,
      });
    } else {
      return res
        .status(400)
        .send({ success: false, error: "Failed to update deal" });
    }
  } catch (err) {
    //console.error("Error:", err);
    res.status(500).send({ success: false, error: "Internal Server Error" });
  }
});


app.post("/soDetails", async (req, res) => {
  const soData = req.body;
 
  if (!soData || Object.keys(soData).length === 0) {
    return res
      .status(400)
      .send({ success: false, error: "Invalid Sales Order data" + soData });
  }
 
  try {
    const catalystApp = req.catalystApp;
 
    const query =
      "SELECT * FROM sales_order WHERE so_id = '" +
      soData.so_id +
      "'";
 
    // console.log(query);
    const checksoData = await catalystApp.zcql().executeZCQLQuery(query);
    console.log(checksoData);
 
    if (checksoData && checksoData.length > 0) {
      return res
        .status(400)
        .send({ success: false, error: "Sales Order already exists" });
    }
 
    const SOTable = await catalystApp.datastore().table("sales_order");
    const newSOData = await SOTable.insertRow(soData);
 
    if (newSOData) {
      return res.status(201).send({
        success: true,
        data: newSOData,
      });
    } else {
      return res
        .status(400)
        .send({ success: false, error: "Failed to insert deal data" });
    }
  } catch (error) {
    return res
      .status(500)
      .send({ success: false, error: error.message });
  }
});


app.put("/soDetailsupdate/:ROWID", async (req, res) => {
  try {
    const tableID = req.params.ROWID;
    const salesOrder = req.body;

    if (!salesOrder || Object.keys(salesOrder).length === 0) {
      return res
        .status(400)
        .send({ success: false, error: "Invalid sales order data" });
    }

    const catalystApp = req.catalystApp;
    const salesOrderTable = await catalystApp.datastore().table("sales_order");

    // Check if the Sales Order exists and update it
    const updatedSalesOrder = await salesOrderTable.updateRow({
      ROWID: tableID,
      ...salesOrder,
    });

    if (updatedSalesOrder) {
      return res.status(200).send({
        success: true,
        data: updatedSalesOrder,
      });
    } else {
      return res
        .status(400)
        .send({ success: false, error: "Failed to update sales order" });
    }
  } catch (err) {
    //console.error("Error:", err);
    res.status(500).send({ success: false, error: "Internal Server Error" });
  }
});
app.post("/CPDetails", async (req, res) => {
  const cpData = req.body;

  try {

    const catalystApp = req.catalystApp;

    // -------- CHECK DUPLICATE --------
    const query = `SELECT * FROM channel_partner WHERE email = '${cpData.email}'`;
    const checkcpData = await catalystApp.zcql().executeZCQLQuery(query);

    if (checkcpData && checkcpData.length > 0) {
      return res.status(400).send({ success: false, error: "Channel Partner already exists" });
    }

    // -------- INSERT CP RECORD --------
    const CPTable = await catalystApp.datastore().table("channel_partner");
    const newCPData = await CPTable.insertRow(cpData);

    const rowId = newCPData.ROWID;
    console.log("Inserted CP ROWID:", rowId);

    // NAME SPLIT
    const nameParts = (cpData.cp_name || "Partner").trim().split(/\s+/);
    const first_name = nameParts[0];
    const last_name = nameParts.slice(1).join(" ") || "";

    const signupConfig = {
      platform_type: "web",
      template_details: {
        senders_mail: "nagendrayesuri3@gmail.com", // must be verified
        subject: "Welcome to Channel Partner Portal",
        message: `<p>Hello ${cpData.cp_name},</p>
        <!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#444;">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 10px;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eee;">

<tr>
<td style="background:#ff6b00;padding:18px 30px;color:#ffffff;font-size:18px;font-weight:bold;">
Channel Partner Portal
</td>
</tr>

<tr>
<td style="padding:35px;">
<h2 style="margin-top:0;color:#222;font-size:26px;">Welcome!</h2>

<p style="font-size:15px;line-height:1.6;margin-bottom:18px;">
You have been invited to access the <strong style="color:#ff6b00;">Channel Partner Portal</strong>.
This portal allows you to manage activities and collaborate with our team.
</p>

<p style="font-size:15px;line-height:1.6;margin-bottom:25px;">
To begin, activate your account by clicking the button below.
</p>

<div style="margin:30px 0;text-align:center;">
<a href="%LINK%" 
style="background:#ff6b00;color:#ffffff;padding:14px 32px;border-radius:8px;
font-size:16px;font-weight:bold;text-decoration:none;display:inline-block;">
Activate Your Account
</a>
</div>

<p style="font-size:14px;color:#666;">
If the button does not work, copy and paste the link below in your browser:
</p>

<p style="font-size:13px;color:#ff6b00;word-break:break-all;"><a href="%LINK%">Link</a></p>

<p style="font-size:14px;color:#666;margin-top:25px;">
Already have an account? 
<a href="" style="color:#ff6b00;text-decoration:none;font-weight:bold;">
Login to Portal
</a>
</p>

</td>
</tr>

<tr>
<td style="background:#fafafa;padding:20px 30px;font-size:12px;color:#888;">
Thank you for partnering with us.<br>
<strong>Channel Partner Portal Team</strong>
<br><br>
© 2026 Channel Partner Portal. All rights reserved.
</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
       `
      }
    }; 
    console.log("Signup Config:", signupConfig);
    
    const userConfig = {
      first_name,
      last_name,
      email_id: cpData.email,
      org_id: "50038515952"   // STRING
    };
        console.log("Signup Config:", userConfig);


    const userManagement = catalystApp.userManagement();

    const addedUser = await userManagement.addUserToOrg(signupConfig, userConfig);

    console.log("Added user:", addedUser);

    const newUserID = addedUser.user_details.user_id;

    if (newCPData) {
      return res.status(201).send({
        success: true,
        data: newCPData,
      });
    } else {
      return res
        .status(400)
        .send({ success: false, error: "Failed to insert Channel patner data" });
    }

    // return res.send({ success: true, user_id: newUserID });

  } catch (err) {
    console.error("FAILED:", err);
    return res.status(500).send(err.message);
  }
});

 
module.exports = app;