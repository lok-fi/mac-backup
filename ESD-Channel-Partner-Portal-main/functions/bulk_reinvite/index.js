/**
 * 
 * @param {import("./types/job").JobRequest} jobRequest 
 * @param {import("./types/job").Context} context 
 */

"use strict";
const catalyst = require("zcatalyst-sdk-node");
const axios = require("axios");


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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = async(jobRequest, context) => {
	console.log('Hello from index.js');
	const catalystApp = catalyst.initialize(context);
	const cache = catalystApp.cache().segment();
	const jobScheduling = catalystApp.jobScheduling();
	
  const page = Number(jobRequest.getJobParam("page")) || 1;
  const start = (page - 1) * 100;
  let accessToken;
	try{

			accessToken = await cache.get("USERConnector");
    	if (!accessToken.cache_value) {
      	console.log("Access token not found in cache, generating a new one...");

      	accessToken = await catalystApp
          .connection(credentials)
          .getConnector("USERConnector")
          .getAccessToken();

				if (accessToken) {
						accessToken = { access_token: accessToken };
						await cache.put("USERConnector", accessToken, 1);
						console.log("New access token generated and cached.");
						// return accessToken;
					}
			} else {
				accessToken = { access_token: accessToken.cache_value };
			}

    }catch (error) {
        console.error("Error generating Zoho access token:", error);
        return context.closeWithFailure();
    }

		try {
			console.log("Access Token Used:", accessToken);
			const response = await axios.get(
				`https://api.catalyst.zoho.in/baas/v1/project/17682000000608987/project-user?start=${start}&end=100`, 
				{
					headers: {
						Authorization: `Zoho-oauthtoken ${accessToken.access_token}`,
						Environment:   "Development",
					},
				}
			);
			const users = Array.isArray(response.data.data) ? response.data.data : [];

			if (users.length === 0) {
				console.log(` No more users found at page ${page}. Stopping..`);
				return context.closeWithSuccess();
			}

			const targetUsers = users.filter(
      (user) =>
        user.role_details?.role_id === 17682000000609000 &&
        user.is_confirmed === false
    );
		for (const user of targetUsers) {
      console.log(" Sending email to:", user.email_id);

		try{

		const reinviteData = {
					platform_type: "web",
				 redirect_url:"https://esd-channel-partner-60040289923.development.catalystserverless.in/",
					user_details: {
						email_id: user.email_id,
							first_name: user.first_name,
							last_name: user.last_name,
					},
		
					template_details: {
						subject: "Reminder: Complete Your SKYi Channel Partner Registration",
						message: `<p>Hello ${user.first_name} ${user.last_name},</p>

<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#444;">

<div style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:12px;border:1px solid #eee;overflow:hidden;">

    <!-- Header -->
    <div style="background:#ff6b00;padding:18px 30px;color:#ffffff;font-size:18px;font-weight:bold;">
        Channel Partner Portal
    </div>

    <!-- Body -->
    <div style="padding:35px;">

        <h2 style="margin-top:0;color:#222;font-size:26px;">
            Reminder: Complete Your Registration
        </h2>

        <p style="font-size:15px;line-height:1.6;margin-bottom:18px;">
            This is a friendly reminder to complete your registration for the 
            <strong style="color:#ff6b00;">Channel Partner Portal</strong>.
        </p>

        <p style="font-size:15px;line-height:1.6;margin-bottom:25px;">
            Once your account is activated, you will be able to access the portal and collaborate with our team.
        </p>

        <!-- Button -->
        <div style="margin:30px 0;text-align:center;">
            <a href="%LINK%" 
            style="background:#ff6b00;color:#ffffff;padding:14px 32px;border-radius:8px;
            font-size:16px;font-weight:bold;text-decoration:none;display:inline-block;">
            Complete Registration
            </a>
        </div>

        <p style="font-size:14px;color:#666;">
            If the button above does not work, please copy and paste the link below into your browser:
        </p>

        <p style="font-size:13px;color:#ff6b00;word-break:break-all;">
            <a href="%LINK%" style="color:#ff6b00;text-decoration:none;">LINK</a>
        </p>

    </div>

    <!-- Footer -->
    <div style="background:#fafafa;padding:20px 30px;font-size:12px;color:#888;">
        Thank you for partnering with us.<br>
        <strong>Channel Partner Portal Team</strong>
        <br><br>
        © 2026 Channel Partner Portal. All rights reserved.
    </div>

</div>

</body>
</html>`,
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
							Authorization: `Zoho-oauthtoken ${accessToken.access_token}`,
						},
					}
				);

				console.log(`✅ Email sent to ${user.email_id}`);



		// 		const datastore = app.datastore();
    // const cpTable = datastore.table("channel_partner");

    // // DIRECT UPDATE USING user_id (NO QUERY NEEDED)
    // const zcql = app.zcql();
    // const query = `
    //   SELECT ROWID FROM channel_partner 
    //   WHERE email = '${email_id}'
    // `;

    // const result = await zcql.executeZCQLQuery(query);
    // const cp = result?.[0]?.channel_partner;
    // const now = new Date().toISOString().slice(0, 19).replace("T", " ");

    // if (cp?.ROWID) {
    //   await cpTable.updateRow({
    //     ROWID: cp.ROWID,
    //     last_invite_log	: now,
    //   });
    // }

			} catch (err) {
        
        console.error(`❌ Failed to send email to ${user.email_id}: ${err}`);
			}
			await delay(1000);
		}

		    //  Schedule next page job
    await jobScheduling.JOB.submitJob({
      job_name: `Job_Page_${page + 1}`,
      jobpool_name: "sendBulkReinviteEmailJobPool",
      target_type: "Function",
      target_name: "bulk_reinvite",
      params: {
        page: page + 1,
      },

      job_config: {
        number_of_retries: 0,
        retry_interval: 900,
      }, // set job config - job retries => 2 retries in 15 mins (optional)
    });

    console.log(`✅ Scheduled Job_Page_${page + 1}`);

	// function input: { job_details: { job_meta_details: { params: { key: 'value' } } } }


	const projectDetails = jobRequest.getProjectDetails(); // to get the current project details
	const jobDetails = jobRequest.getJobDetails(); // to get the current job details
	const jobMetaDetails = jobRequest.getJobMetaDetails(); // to get the current job's meta details
	const getJobCapacityAttributes = jobRequest.getJobCapacityAttributes(); // to get the current jobs capacity
	const allJobParams = jobRequest.getAllJobParams(); // to get all the parameters supplied to the job function
	const jobParam = jobRequest.getJobParam('key'); // to get the value of a particular parameter supplied to the job function

		}catch (err) {
   
	console.error(`❌ Error processing page ${page}`,err.response?.data || err.message);
    return context.closeWithFailure();
  
		}
	context.closeWithSuccess(); 

};
