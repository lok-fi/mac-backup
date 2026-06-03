"use strict";

const express = require("express");
const app = express();
const catalyst = require("zcatalyst-sdk-node");
const fileUpload = require("express-fileupload"); // ⬅️ NEW: Import the library

// Middleware


// ⬅️ NEW: Enable File Uploads (Add this block)
// This parses incoming multipart/form-data so req.files works
app.use(fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/", 
    limits: { fileSize: 10 * 1024 * 1024 }, // Optional: 10MB limit
    abortOnLimit: true
}));

// Initialize Catalyst app for every request
app.use((req, res, next) => {
  try {
    req.catalystApp = catalyst.initialize(req);
    next();
  } catch (err) {
    console.error("Catalyst Init Error:", err);
    res.status(500).json({ error: "Catalyst initialization failed" });
  }
});
app.use(express.json());

// Import controllers
const { getChannelPartners , updateUser } = require("./controller/cpController");
const { getLeads , createLead , searchLeads} = require("./controller/leadsController");
const { getCommission } = require("./controller/commissionController");
const { getSupport } = require("./controller/supportController");
const { getDeals } = require("./controller/dealsController");
const { getSalesOrder } = require("./controller/SalesOrderController");
const { getAllAppUsers , updateStatus , reinviteUser } = require("./controller/allUsersController");
const { uploadProfilePicture } = require("./controller/profileController");
const { getUserBrochures , downloadBrochure } = require("./controller/userBrochuresController");
const { getProjectNames } = require("./controller/projectsController");
const { leadJourney } = require("./controller/leadJourney");


// GET Routes
app.get("/user", getChannelPartners);
app.get("/leads", getLeads);
app.get("/commission", getCommission);
app.get("/support", getSupport);
app.get("/deals", getDeals);
app.get("/sales_orders", getSalesOrder);
app.get("/all_users", getAllAppUsers);
app.get("/brochures",getUserBrochures);
app.get("/download", downloadBrochure);
app.get("/getProjects", getProjectNames);
app.get("/searchLeads", searchLeads);
app.get("/leadJourney", leadJourney);


app.get("/profile-image/:folder/:filename", async (req, res) => {
  try {
    const bucket = req.catalystApp.stratus().bucket("esd-channel-partner");
    // Manually construct the path from the two URL parameters
    const filePath = `${req.params.folder}/${req.params.filename}`;

    const fileStream = await bucket.getObject(filePath);
    
    // Set content type and pipe
    res.setHeader('Content-Type', 'image/jpeg'); 
    fileStream.pipe(res); 

  } catch (err) {
    console.error("🔴 Image Route Error:", err.message);
    res.status(404).send("Not found");
  }
});

// POST/PATCH Routes
app.post("/leads", createLead);
app.patch("/user", updateUser);
app.patch("/all_users", updateStatus);
app.post("/reinviteUser",reinviteUser);


// 📸 This route will now have access to req.files because of the middleware above
app.post("/profile/upload-picture", uploadProfilePicture);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

module.exports = app;