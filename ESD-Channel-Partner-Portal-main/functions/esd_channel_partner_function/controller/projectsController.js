"use strict";

const getProjectNames = async (req, res) => {
  try {
    const catalystApp = req.catalystApp;
    const zcql = catalystApp.zcql();

    // Fetch only the columns you need, sorted for stable UI
    const query = `
      SELECT ROWID, project_name
      FROM sales_project
      ORDER BY project_name ASC
    `;

    const result = await zcql.executeZCQLQuery(query);
    const projects = (result || []).map(r => r.sales_project);

    return res.status(200).send({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error("Get Project Names Error:", error);
    return res.status(500).send({
      success: false,
      error: error.message,
    });
  }
};

module.exports = { getProjectNames };