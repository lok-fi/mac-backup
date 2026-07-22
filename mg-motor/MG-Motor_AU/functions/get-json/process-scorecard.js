const catalyst = require("zcatalyst-sdk-node");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Replace with your actual Gemini API Key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send({ error: "Method Not Allowed" });

  try {
    const app = catalyst.initialize(req);
    const { fileName, mimeType, fileData } = req.body;

    if (!fileData) return res.status(400).send({ error: "No file data received." });

    // 1. Initialize Gemini 1.5 Pro (Required for massive file processing)
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_SCORECARD_MODEL || "gemini-3.1-flash-lite" });

    // 2. The Ultimate Extraction Prompt
    const prompt = `
      You are an automated Data Extraction API. Read the attached Excel/CSV file and output a single, raw JSON array.
      
      CRITICAL RULE 1: 100% EXTRACTION (NO LEFT BEHIND)
      You MUST extract data for EVERY SINGLE DEALER listed in the 'DEALER LIST' tab (130+ dealers). Do NOT use "..." to truncate. 

      CRITICAL RULE 2: STRICTLY MINIFIED JSON
      You must output the JSON array completely minified (zero spaces, zero line breaks) to ensure it fits in the response window.
      Do NOT wrap the output in \`\`\`json markdown tags. Output ONLY the raw array starting with [ and ending with ].

      CRITICAL RULE 3: AGGRESSIVE DATA HUNTING
      - Look primarily for 'Mar' or '2025-03-01' headers.
      - If March is blank, you MUST scan adjacent months (Feb, Apr) or Q1 totals and use the closest available value.
      - Stock Tab: Use the earliest available month (e.g. 2025-07-01).
      - Google/CI Tabs: Use the main columns, ignoring dates.
      - NEVER output null. Use 0 for missing numbers and "N" for missing strings only if the entire row is completely blank.

      SCHEMA DEFINITION (Must match exactly):
      [{"dealer":{"name":"String","region":"String","pma":"String"},"meta":{"recordId":"String"},"monthly":[{"month":"Mar","sales":{"target":0,"actual":0},"market":{"total":0,"mg":0},"stock":{"ice":0,"hev":0,"bev":0},"parts":{"target":0,"actual":0},"service":{"response":"Y/N","score":"Y/N","leadTime":"Y/N","training":"Y/N"},"google":{"score":0.0,"responses":0},"ci":{"status":"String","pts":0},"doty":{"sales":0,"aftersales":0,"google":0,"ci":0,"total":0}}]}]
    `;

    // 3. Send file and prompt to Gemini
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: fileData, mimeType: mimeType } }
    ]);

    let responseText = result.response.text();

    // 4. Clean the response (Strip markdown if the AI disobeys)
    responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();

    let finalJson;
    try {
      finalJson = JSON.parse(responseText);
    } catch (parseErr) {
      throw new Error("Gemini returned invalid JSON. It may have been truncated.");
    }

    // 5. Store in Zoho Catalyst Data Store
    // Deletes old dashboard data and inserts the fresh batch
    const zcql = app.zcql();
    await zcql.executeZCQLQuery("DELETE FROM dashboard_data"); 
    
    // Insert as a single stringified row to bypass mapping loops
    const insertQuery = `INSERT INTO dashboard_data (data) VALUES ('${JSON.stringify(finalJson).replace(/'/g, "''")}')`;
    await zcql.executeZCQLQuery(insertQuery);

    // 6. Send success back to Frontend
    res.status(200).send({ 
      message: "Processing Complete", 
      dealerCount: finalJson.length 
    });

  } catch (err) {
    console.error(err);
    res.status(500).send({ error: err.message });
  }
};