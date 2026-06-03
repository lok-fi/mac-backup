"use strict";

const express = require("express");
const app = express();
const fileUpload = require("express-fileupload");
const path = require("path");
const os = require("os");
const fs = require("fs");
const catalyst = require("zcatalyst-sdk-node");
app.use(fileUpload({
  createParentPath: true
}));

app.use(express.urlencoded({ extended: true }));
//new code for status change
app.use(express.json());
async function uploadAttachmentToStratus(catalystApp, file) {
  const bucket = catalystApp.stratus().bucket("esd-channel-partner");

  const fileName = `${Date.now()}_${file.name}`;
  const tempPath = path.join(os.tmpdir(), fileName);

  await file.mv(tempPath);

  const key = `Brochures/${fileName}`;

  await bucket.putObject(
    key,
    fs.createReadStream(tempPath),
    {
      overwrite: true,
      contentType: file.mimetype
    }
  );

  await fs.promises.unlink(tempPath);

  return key;
}

app.post("/upload-brochure", async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    
    // 1. Normalize the incoming files into an array
    let uploadedPaths = [];
    if (req.files && req.files.brochure_files) {
      let files = req.files.brochure_files;
      if (!Array.isArray(files)) {
        files = [files]; // Convert single file object to array
      }

      // 2. Loop through up to 5 files and upload them to Stratus
      for (const file of files) {
        const path = await uploadAttachmentToStratus(catalystApp, file);
        uploadedPaths.push(path);
      }
    }

    if (uploadedPaths.length === 0) {
      return res.status(400).json({ error: "Brochure files missing" });
    }

    // 3. Save as a stringified JSON array in the datastore
    const row = await catalystApp
      .datastore()
      .table("brochures")
      .insertRow({
        project_name: req.body.project_name,
        project_type: req.body.project_type,
        project_status: req.body.project_status,
        project_tagline: req.body.project_tagline,
        locality: req.body.locality,
        city: req.body.city,
        bhk_configuration: req.body.bhk_configuration,
        price: Number(req.body.price),
        area_min_sqft: Number(req.body.area_min_sqft),
        area_max_sqft: req.body.area_max_sqft,
        amenities: req.body.amenities,
        brochure_file: JSON.stringify(uploadedPaths), // <-- Modified
        is_active: req.body.is_active === "true"
      });

    res.json({
      success: true,
      message: "Brochures uploaded successfully",
      data: row
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/get-brochures", async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const datastore = catalystApp.datastore();
    const table = datastore.table("brochures");

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 6;
    const search = (req.query.search || "").toLowerCase().trim();
    const category = req.query.category || "All";

    const offset = (page - 1) * pageSize;

    // Fetch all rows from Catalyst
    let rows = await table.getAllRows();

    // 1. FILTER BY CATEGORY
    if (category !== "All") {
      rows = rows.filter(row => 
        row.project_type && row.project_type.toLowerCase() === category.toLowerCase()
      );
    }

    // 2. FILTER BY SEARCH KEYWORD
    if (search) {
      rows = rows.filter(row => 
        (row.project_name && row.project_name.toLowerCase().includes(search)) ||
        (row.city && row.city.toLowerCase().includes(search)) ||
        (row.locality && row.locality.toLowerCase().includes(search))
      );
    }

    // 3. SORT: Newest first
    rows.sort((a, b) => new Date(b.CREATEDTIME) - new Date(a.CREATEDTIME));

    const total = rows.length;

    // 4. PAGINATE
    const paginated = rows.slice(offset, offset + pageSize);

    res.status(200).json({
      success: true,
      data: paginated,
      total,
      page,
      pageSize
    });

  } catch (err) {
    console.error("Fetch brochures error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch brochures"
    });
  }
});
app.post("/update-brochure/:id", async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const { id } = req.params;
    const table = catalystApp.datastore().table("brochures");

    // 1. Recover existing files sent from the frontend
    let finalPaths = [];
    if (req.body.existing_files) {
      try {
        finalPaths = JSON.parse(req.body.existing_files);
      } catch(e) {
        // Fallback for older legacy strings
        finalPaths = [req.body.existing_files]; 
      }
    }

    // 2. Upload any NEW files added during the edit
    if (req.files && req.files.brochure_files) {
      let files = req.files.brochure_files;
      if (!Array.isArray(files)) {
        files = [files];
      }

      for (const file of files) {
        const uploadPath = await uploadAttachmentToStratus(catalystApp, file);
        finalPaths.push(uploadPath);
      }
    }

    // 3. Update the datastore
    const updatedRow = await table.updateRow({
      ROWID: id,
      project_name: req.body.project_name,
      project_type: req.body.project_type,
      project_status: req.body.project_status,
      bhk_configuration: req.body.bhk_configuration,
      locality: req.body.locality,
      city: req.body.city,
      price: req.body.price,
      area_min_sqft: req.body.area_min_sqft,
      area_max_sqft: req.body.area_max_sqft,
      amenities: req.body.amenities,
      is_active: req.body.is_active === "true" || req.body.is_active === true,
      brochure_file: JSON.stringify(finalPaths) // <-- Modified
    });

    return res.status(200).json({
      success: true,
      message: "Brochure updated successfully",
      data: updatedRow
    });

  } catch (error) {
    console.error("Update brochure error:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post("/update-brochure-status/:id", async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const { id } = req.params;
    console.log("BODY:", req.body);

    const table = catalystApp.datastore().table("brochures");

    const is_active =
      req.body.is_active === true || req.body.is_active === "true";
      

    const updatedRow = await table.updateRow({
      ROWID: id,
      is_active: is_active
    });

    return res.status(200).json({
      success: true,
      message: "Status updated successfully",
      data: updatedRow
    });

  } catch (error) {
    console.error("Status update error:", error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


module.exports = app;