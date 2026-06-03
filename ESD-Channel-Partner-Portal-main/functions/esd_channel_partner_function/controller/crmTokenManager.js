const axios = require("axios");

let crmTokenStore = null;

const CRM_CLIENT_ID = "1000.QE0UL8UVYOJ5DIZFSSZBYAU2HT7I9V";
const CRM_CLIENT_SECRET = "3448eac8c542f830159e04fea63d46472cbaee94e9";
const CRM_REFRESH_TOKEN = "1000.8696181e780c01ce22227a61236c6ecc.2ef26ad34b06a87505d644dd0c914484";
async function refreshCrmToken() {
  console.log("[CRM] refreshCrmToken called");

  if (!CRM_CLIENT_ID || !CRM_CLIENT_SECRET || !CRM_REFRESH_TOKEN) {
    throw new Error("CRM OAuth environment variables are missing");
  }

  const response = await axios.post(
    "https://accounts.zoho.com/oauth/v2/token",
    null,
    {
      params: {
        refresh_token: CRM_REFRESH_TOKEN,
        client_id: CRM_CLIENT_ID,
        client_secret: CRM_CLIENT_SECRET,
        grant_type: "refresh_token"
      }
    }
  );

  const accessToken = response.data.access_token;

  if (!accessToken) {
    throw new Error("Zoho did not return access_token");
  }

  crmTokenStore = {
    token: accessToken,
    expiry: Date.now() + 55 * 60 * 1000
  };

  console.log("[CRM] Access token generated successfully");

  return accessToken;
}

async function getCrmAccessToken(forceRefresh = false) {
  console.log("[CRM] getCrmAccessToken called");

  if (
    forceRefresh ||
    !crmTokenStore ||
    Date.now() >= crmTokenStore.expiry
  ) {
    return await refreshCrmToken();
  }

  return crmTokenStore.token;
}

module.exports = { getCrmAccessToken };
