const puppeteer = require("puppeteer");
require("moment/locale/es");
const axios = require("axios");
const Tracking = require("../models/trackingModel");
const poll = require("promise-poller").default;
const fs = require("fs");
const path = require("path");
const {
  saveOrUpdateTrackingData,
} = require("../controllers/trackingController");
const {logger} = require("../config/logger");

const timeout = (millis) =>
  new Promise((resolve) => setTimeout(resolve, millis));

const randomDelay = (minSeconds, maxSeconds) => {
  const minMilliseconds = minSeconds * 1000;
  const maxMilliseconds = maxSeconds * 1000;
  return Math.floor(Math.random() * (maxMilliseconds - minMilliseconds + 1)) + minMilliseconds;
};

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

const scrapeCA = async (
  cdNumber = "164278815",
  userId = "66c78ff7e79922bf212a7e43",
  notificationId = "3564832",
  trackingType = "telegrama"
) => {
  let browser;
  let result = {
    success: false,
    message: '',
    data: null,
  };

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu",
      ],
      defaultViewport: null,
      executablePath: "/usr/bin/google-chrome",
      userDataDir: "/usr/bin/custom/cache"
    });
    const page = await browser.newPage();

    logger.info("Navegando a la página");
    await page.goto("https://www.correoargentino.com.ar/formularios/ondnc", {
      waitUntil: "domcontentloaded",
    });

    // Simular movimientos de mouse
    await simulateHumanLikeMouseMovements(page);

    // Resolver CAPTCHA
    const captchaResponse = await resolveCaptcha(page);
    if (!captchaResponse) throw new Error("Error al resolver CAPTCHA.");

    // Completar formulario
    await completeForm(page, cdNumber, captchaResponse);

    // Simular movimientos de mouse antes de enviar el formulario
    await simulateHumanLikeMouseMovements(page);

    // Enviar formulario
    await submitForm(page);

    // Esperar a que los resultados se carguen
    await page.waitForSelector("#resultado", {
      visible: true,
      timeout: 60000,
    });

    // Tomar captura de pantalla y extraer datos
    const screenshotPath = await captureScreenshot(page, cdNumber);
    const tableData = await extractTableData(page);

    if (tableData.length === 0) {
      // No se encontraron resultados
      result.message = 'No se encontraron resultados para el número de seguimiento.';
    } else {
      // Guardar datos en la base de datos
      const trackingResult = await saveOrUpdateTrackingData(
        cdNumber,
        userId,
        notificationId,
        tableData,
        screenshotPath,
        trackingType
      );

      result.success = true;
      result.message = 'Proceso completado exitosamente';
      result.data = trackingResult;
    }

    logger.info(result.message);
  } catch (err) {
    logger.error(`Error en tarea de scraping tracking: ${err}`);
    result.message = `Error en tarea de scraping tracking: ${err.message}`;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return result;
};

// Simular movimientos de mouse aleatorios
const simulateHumanLikeMouseMovements = async (page) => {
  const width = 800;
  const height = 600;
  
  for (let i = 0; i < 10; i++) {
    const randomX = Math.floor(Math.random() * width);
    const randomY = Math.floor(Math.random() * height);
    await page.mouse.move(randomX, randomY);
    await new Promise((resolve) => setTimeout(resolve, 1254)); // Espera de 1 segundo
  }
};

const resolveCaptcha = async (page) => {
  logger.info("Iniciando solicitud de CAPTCHA");
  const requestId = await initiateCaptchaRequest(apiKey);
  const response = await pollForRequestResults(apiKey, requestId);
  logger.info(`Captcha response recibido: ${response}`);
  return response;
};

const completeForm = async (page, cdNumber, captchaResponse) => {
  logger.info("Seleccionando opción del dropdown");
  await page.select('select[name="producto"]', "CD");

  logger.info("Esperando input para número");
  await page.waitForSelector("input#numero");

  logger.info("Escribiendo número en el input");
  await page.type("input#numero", cdNumber);

  logger.info("Inyectando respuesta de CAPTCHA en el DOM");
  await page.evaluate((captchaResponse) => {
    document.getElementById("g-recaptcha-response").innerHTML = captchaResponse;
  }, captchaResponse);
};

const submitForm = async (page) => {
  // Esperar a que el iframe de reCAPTCHA esté visible
  logger.info("Esperando iframe de reCAPTCHA");
  await page.waitForSelector("iframe[src*='recaptcha']", {
    visible: true,
    timeout: 60000,
  });

  // Acceder al iframe de reCAPTCHA
  const frames = page.frames();
  const recaptchaFrame = frames.find((frame) =>
    frame.url().includes("recaptcha")
  );

  if (recaptchaFrame) {
    logger.info("Iframe de reCAPTCHA encontrado");

    // Esperar al checkbox dentro del iframe
    await recaptchaFrame.waitForSelector(".recaptcha-checkbox-border", {
      visible: true,
      timeout: 60000,
    });

    logger.info("Haciendo clic en el checkbox de reCAPTCHA");
    await recaptchaFrame.click(".recaptcha-checkbox-border");

    // Esperar un poco después de hacer clic en el checkbox
    await new Promise((resolve) => {
      const delay = randomDelay(3,+ 5); // Aquí pasas los segundos mínimos y máximos como parámetros
      setTimeout(resolve, delay);
    });
  } else {
    throw new Error("No se pudo encontrar el iframe de reCAPTCHA.");
  }

  // Esperar un poco antes de hacer clic en el botón de submit
  await new Promise((resolve) => {
    const delay = randomDelay(3, 4); // Aquí pasas los segundos mínimos y máximos como parámetros
    setTimeout(resolve, delay);
  });
  // Hacer clic en el botón de submit
  logger.info("Haciendo clic en el botón de enviar");
  await page.click("button#btsubmit");
  await new Promise((resolve) => {
    const delay = randomDelay(4, 5); // Aquí pasas los segundos mínimos y máximos como parámetros
    setTimeout(resolve, delay);
  });
};

const captureScreenshot = async (page, cdNumber) => {
  // Esperar hasta que el resultado esté visible
  await page.waitForSelector("#resultado", {
    visible: true,
    timeout: 60000, // Esperar hasta 60 segundos
  });

  // Crear la carpeta de capturas de pantalla si no existe
  const screenshotDir = path.join(__dirname, "screenshots");
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir);
  }

  // Tomar una captura de pantalla del área visible completa
  const screenshotPath = path.join(screenshotDir, `result-${cdNumber}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  logger.info(
    `Captura de pantalla del resultado guardada en: ${screenshotPath}`
  );
  return screenshotPath;
};

const extractTableData = async (page) => {
  // Esperar hasta que el selector #resultado esté visible
  await page.waitForSelector("#resultado", {
    visible: true,
    timeout: 60000, // Esperar hasta 60 segundos
  });

  // Verificar si hay una tabla dentro del elemento #resultado
  const tableExists = await page.evaluate(() => {
    const table = document.querySelector("#resultado table");
    return !!table; // Retorna true si la tabla existe, false si no
  });

  if (tableExists) {
    // Si la tabla existe, extraer los datos
    const tableData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("#resultado table tbody tr"));
      const extractedData = [];

      rows.forEach((row) => {
        const columns = row.querySelectorAll("td");
        extractedData.push({
          date: columns[0]?.innerText.trim() || '',
          planta: columns[1]?.innerText.trim() || '',
          historia: columns[2]?.innerText.trim() || '',
          estado: columns[3]?.innerText.trim() || '',
        });
      });

      return extractedData;
    });
  
    logger.info("Datos extraídos de la tabla:", JSON.stringify(tableData));
    return tableData;
  } else {
    // Si no hay tabla, manejar el mensaje de "No se encontraron resultados"
    const noResultsMessage = await page.evaluate(() => {
      const alert = document.querySelector("#resultado .alert.alert-info");
      return alert ? alert.innerText.trim() : null;
    });

    if (noResultsMessage) {
      logger.info("No se encontraron resultados para el número de seguimiento.");
    } else {
      logger.warn("No se encontró la tabla ni el mensaje esperado en el sitio.");
    }

    // Retornar un arreglo vacío o algún indicativo de que no hubo resultados
    return [];
  }
};


module.exports = { scrapeCA };
