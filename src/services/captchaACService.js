const AC = require("@antiadmin/anticaptchaofficial");
const {logger} = require("../config/logger");

AC.setAPIKey(process.env.ANTI_CAPTCHA_API_KEY);
const captchaACSolver = async (pageUrl, siteKey) => {
  try {
    const balance = await AC.getBalance();
    logger.info(`Anti Captcha service balance: ${balance}`);
    const token = await AC.solveRecaptchaV2Proxyless(
      pageUrl,
      siteKey
    );
    logger.info(`Recaptcha token: ${token}`);
    return token;
  } catch (err) {
    logger.error(`Error captcha: ${err}`);
    throw new Error(err);
  }
};

module.exports = { captchaACSolver };
