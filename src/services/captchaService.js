// captchaService.js
const axios = require("axios");
const poll = require("promise-poller").default;
const {logger} = require("../config/logger");
const { timeout, randomDelay } = require("../utils/utils");

const siteDetails = {
  sitekey: process.env.RECAPTCHA_SCRAPE_PAGE_SITE_KEY,
  pageurl: process.env.RECAPTCHA_SCRAPE_PAGE,
};

const apiKey = process.env.RECAPTCHA_API_KEY;

async function initiateCaptchaRequest(apiKey) {
  const formData = {
    method: "userrecaptcha",
    googlekey: siteDetails.sitekey,
    key: apiKey,
    pageurl: siteDetails.pageurl,
    json: 1,
  };
  try {
    const response = await axios.get("http://2captcha.com/in.php", {
      params: formData,
    });

    return response.data.request;
  } catch (err) {
    logger.error(`Error initiating CAPTCHA request: ${err.message}`);
    throw err;
  }
}

async function pollForRequestResults(
  key,
  id,
  retries = 40,
  interval = 5000,
  delay = 45000
) {
  await timeout(delay);
  return poll({
    taskFn: requestCaptchaResults(key, id),
    interval,
    retries,
  });
}

function requestCaptchaResults(apiKey, requestId) {
  const url = `http://2captcha.com/res.php?key=${apiKey}&action=get&id=${requestId}&json=1`;
  return async function () {
    return new Promise(async function (resolve, reject) {
      const rawResponse = await axios(url);
      const resp = rawResponse.data;
      if (resp.status === 0) return reject(resp.request);
      resolve(resp.request);
    });
  };
}

async function resolveCaptcha(page) {
  logger.info("Iniciando solicitud de CAPTCHA");
  
  const startTime = Date.now(); // Tiempo inicial
  const requestId = await initiateCaptchaRequest(apiKey);
  
  const response = await pollForRequestResults(apiKey, requestId);
  const endTime = Date.now(); // Tiempo final

  const totalTime = (endTime - startTime) / 1000; // Tiempo en segundos
  const minutes = Math.floor(totalTime / 60);
  const seconds = Math.floor(totalTime % 60);

  logger.info(`Captcha response recibido: ${response}`);
  logger.info(`Tiempo total de resolución del CAPTCHA: ${minutes}m ${seconds}s`);
  
  return response;
}


module.exports = {
  resolveCaptcha,
};
