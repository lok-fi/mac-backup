"use strict";

const getCommission = async (req, res) => {
  try {
    const app = req.catalystApp;
    
    // Initialize ZCQL for optimized database querying
    const zcql = app.zcql(); 

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    // 1️⃣ Get Logged-in User
    const user = await app.userManagement().getCurrentUser();
    if (!user || !user.email_id) {
      return res.status(401).json({
        success: false,
        error: "Unauthenticated user"
      });
    }

    const loginEmail = user.email_id;

    // 2️⃣ Fetch CP_Code from channel_partner via ZCQL query
    const cpQuery = `SELECT CP_Code FROM channel_partner WHERE email = '${loginEmail}' LIMIT 1`;
    const cpResult = await zcql.executeZCQLQuery(cpQuery);

    // Safely extract the CP_Code from the query result
    const cpCode = cpResult[0]?.channel_partner?.CP_Code;

    if (!cpCode) {
      return res.status(404).json({
        success: false,
        error: "Channel Partner profile or CP_Code not found"
      });
    }

    // 3️⃣ Fetch matching commissions using the CP_Code via ZCQL query
    const commQuery = `SELECT * FROM commission WHERE CP_Code = '${cpCode}'`;
    const commResult = await zcql.executeZCQLQuery(commQuery);

    // ZCQL returns data nested under the table name (e.g., [{ commission: {...} }])
    // We map it to a flat array so your frontend doesn't break
    const filteredCommissions = commResult.map(row => row.commission);

    // 4️⃣ Sort and Paginate the results
    const total = filteredCommissions.length;
    
    const paginated = filteredCommissions
      .sort((a, b) => new Date(b.CREATEDTIME) - new Date(a.CREATEDTIME))
      .slice(offset, offset + pageSize);

    return res.status(200).json({
      success: true,
      data: paginated,
      total,
      page,
      pageSize
    });

  } catch (err) {
    console.error("Commission Fetch Error:", err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

module.exports = { getCommission };