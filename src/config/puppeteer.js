const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const dns = process.env.RECAPTCHA_DNS;
const port = process.env.RECAPTCHA_PORT;


const launchBrowser = async () => {
  return puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", `--proxy-server=${dns}:${port}`, "--disable-gpu"],
    ignoreDefaultArgs: ["--disable-extensions"],
    defaultViewport: null,
    executablePath: "/usr/bin/google-chrome",
    userDataDir: "/usr/bin/custom/cache",
  });
};

module.exports = { launchBrowser };
