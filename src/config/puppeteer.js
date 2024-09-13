const launchBrowser = async () => {
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", `--proxy-server=${dns}:${port}`, "--disable-gpu"],
    ignoreDefaultArgs: ["--disable-extensions"],
    defaultViewport: null,
    executablePath: "/usr/bin/google-chrome",
    userDataDir: "/usr/bin/custom/cache",
  });
};

module.exports = { launchBrowser };
