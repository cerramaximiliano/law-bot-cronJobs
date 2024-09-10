const axios = require('axios');

const api_key = process.env.CAP_SOLVER_API_KEY;
const user = process.env.RECAPTCHA_USER
const password = process.env.RECAPTCHA_PASSWORD
const dns = process.env.RECAPTCHA_DNS
const port = process.env.RECAPTCHA_PORT

async function capsolver(site_key, site_url) {
  const payload = {
    clientKey: api_key,
    task: {
      type: 'ReCaptchaV2Task',
      websiteKey: site_key,
      websiteURL: site_url,
    }
  };

  try {
    const res = await axios.post("https://api.capsolver.com/createTask", payload);
    console.log(res)
    const task_id = res.data.taskId;
    if (!task_id) {
      console.log("Failed to create task:", res.data);
      return;
    }
    console.log("Got taskId:", task_id);

    while (true) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for 1 second

      const getResultPayload = {clientKey: api_key, taskId: task_id};
      const resp = await axios.post("https://api.capsolver.com/getTaskResult", getResultPayload);
      const status = resp.data.status;

      if (status === "ready") {
        return resp.data.solution.gRecaptchaResponse;
      }
      if (status === "failed" || resp.data.errorId) {
        console.log("Solve failed! response:", resp.data);
        return;
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

module.exports = {capsolver}

