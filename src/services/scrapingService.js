const puppeteer = require("puppeteer-extra");
const { HttpsProxyAgent } = require("https-proxy-agent");

const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const fs = require("fs").promises;
const path = require("path");
const { logger } = require("../config/logger");
const {
  saveOrUpdateTrackingData,
} = require("../controllers/trackingController");
const { resolveCaptcha } = require("./captchaService");
const { simulateHumanLikeMouseMovements } = require("./mouseMovementService");
const { randomDelay } = require("../utils/utils");
const axios = require("axios");
const { captchaACSolver } = require("./captchaACService");
const { capsolver } = require("./captchaCapService");
const TwoCaptcha = require("@2captcha/captcha-solver");

const siteKey = process.env.RECAPTCHA_SCRAPE_PAGE_SITE_KEY;
const pageUrl = process.env.RECAPTCHA_SCRAPE_PAGE;
const user = process.env.RECAPTCHA_USER;
const password = process.env.RECAPTCHA_PASSWORD;
const dns = process.env.RECAPTCHA_DNS;
const port = process.env.RECAPTCHA_PORT;

const retryCaptchaValidation = async (maxRetries, siteKey, pageUrl) => {
  let attempts = 0;
  let isTokenValid = false;
  let captchaResponse;

  while (attempts < maxRetries) {
    attempts += 1;
    logger.info(`Intento ${attempts} de resolver CAPTCHA.`);

    captchaResponse = await captchaACSolver(pageUrl, siteKey); // Solicita nuevo captcha

    if (!captchaResponse) {
      logger.error("Error al resolver CAPTCHA.");
      continue; // Si falla, reintenta
    }

    isTokenValid = await verifyRecaptcha(captchaResponse);

    if (isTokenValid) {
      logger.info("CAPTCHA validado correctamente.");
      break; // Sale del bucle si se valida correctamente
    } else {
      logger.warn(
        `Token inválido. Reintentando... (${attempts}/${maxRetries})`
      );
    }
  }

  if (!isTokenValid) {
    throw new Error("No se pudo validar el CAPTCHA tras varios intentos.");
  }

  return captchaResponse;
};

async function getPublicIP() {
  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);

  // Configuración del proxy (igual que con `curl`)
  try {
    const response = await axios.get("http://icanhazip.com", {
      proxy: {
        protocol: "http",
        host: dns,
        port: port,
        auth: {
          username: encodedUser, // Asegúrate de usar las credenciales escapadas
          password: encodedPassword,
        },
      },
    });
    logger.info(`Tu IP pública es: ${response.data.trim()}`);
    return response.data.trim();
  } catch (error) {
    logger.error("Error al obtener la IP pública:", error);
    throw new Error(error);
  }
}

const verifyRecaptcha = async (token) => {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  const proxyUrl = `http://${user}:${password}@${dns}:${port}`;
  const proxyAgent = new HttpsProxyAgent(proxyUrl);
  logger.info(`Recaptcha token to verify: ${token}`);

  try {
    const response = await axios.post(
      "https://www.google.com/recaptcha/api/siteverify",
      new URLSearchParams({
        secret: secretKey,
        response: token,
        // Puedes incluir el remoteip si es necesario
        // remoteip: 'user-ip-address'
      }),
      {
        httpsAgent: proxyAgent, // Usar proxy
        headers: {
          "Content-Type": "application/x-www-form-urlencoded", // Importante para enviar datos en el cuerpo de la solicitud
        },
      }
    );

    const verificationResult = response.data;
    if (verificationResult.success) {
      logger.info("reCAPTCHA verificado con éxito.");
      return true;
    } else {
      let error = verificationResult["error-codes"]
        ? verificationResult["error-codes"][0]
        : "Error desconocido";
      logger.error("Error en la verificación de reCAPTCHA:", error);
      return false;
    }
  } catch (error) {
    logger.error("Error al verificar reCAPTCHA:", error.message);
    return false;
  }
};

const scrapeWithoutBrowser = async () => {
  try {
    const captchaResponse = await capsolver(siteKey, pageUrl);

    console.log(captchaResponse);

    if (!captchaResponse) throw new Error("Error al resolver CAPTCHA.");

    /* const maxRetries = 5;
      captchaResponse = await retryCaptchaValidation(maxRetries, siteKey, pageUrl);
  */

    const isTokenValid = await verifyRecaptcha(captchaResponse);
    logger.info("Is token valid: ", isTokenValid);
  } catch (err) {
    console.log(err);
  }
};

const scrapeCA = async (
  cdNumber = "123456789",
  userId = "66c78ff7e79922bf212a7e43",
  trackingType = "telegrama",
  captchaService = "2Captcha",
  task = "rutine",
  alias = null
) => {
  let browser;
  let result = {
    success: false,
    message: "",
    data: null,
    ip: "",
    service: captchaService, // Registramos el servicio en el objeto result
  };

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", `--proxy-server=${dns}:${port}`],
      ignoreDefaultArgs: ["--disable-extensions"],
      defaultViewport: null,
      executablePath: "/usr/bin/google-chrome",
      userDataDir: "/usr/bin/custom/cache",
    });

    const page = await browser.newPage();
    await page.authenticate({
      username: user, // Usuario del proxy
      password: password, // Contraseña del proxy
    });

    logger.info("Navegando a la página");
    await page.goto("https://www.correoargentino.com.ar/formularios/ondnc", {
      waitUntil: "domcontentloaded",
    });

    const ip = await getPublicIP();
    if (ip) {
      result.ip = ip;
    }

    // Resolver CAPTCHA y hacer clic en el checkbox
    await resolveCaptchaAndClick(page, captchaService);

    // Completar y enviar el formulario
    await completeAndSubmitForm(page, cdNumber);

    // Tomar captura de pantalla y extraer datos
    const tableData = await extractTableData(page);
    if (Array.isArray(tableData) && tableData.length === 0) {
      // No se encontraron resultados
      let path = "";
      task === "test" ? (path = "/test/failure") : (path = "/failure");
      const screenshotPath = await captureScreenshot(page, cdNumber, path);
      result.message =
        "No se encontró la tabla ni el mensaje esperado en el sitio.";
    } else if (Array.isArray(tableData) && tableData.length > 0) {
      // Guardar datos en la base de datos
      let path = "";
      task === "test" ? (path = "/test/success") : (path = "/success");
      const screenshotPath = await captureScreenshot(page, cdNumber, path);
      const trackingResult = await saveOrUpdateTrackingData(
        cdNumber,
        userId,
        tableData,
        screenshotPath,
        trackingType,
        alias
      );
      result.success = true;
      result.message = "Proceso completado exitosamente";
      result.data = trackingResult;
    } else if (typeof tableData === "string") {
      // Si `tableData` es un texto
      const path = "/failure";
      const screenshotPath = await captureScreenshot(page, cdNumber, path);

      result.success = false;
      result.message = tableData;
      result.data = null;
    } else {
      
      result.success = false;
      result.message = "Error inesperado en tableData";
      result.data = null;
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

const captureScreenshot = async (page, cdNumber, subPath) => {
  // Esperar hasta que el resultado esté visible
  await page.waitForSelector("#resultado", {
    visible: true,
    timeout: 60000, // Esperar hasta 60 segundos
  });

  // Crear la carpeta de capturas de pantalla si no existe
  logger.info(`Capture screenshot function start, path: ${subPath}`);
  const screenshotDir = path.join(__dirname, `screenshots${subPath}`);

  // Verificar si el directorio ya existe
  try {
    await fs.access(screenshotDir); // Intentar acceder al directorio
    logger.info(`El directorio ya existe: ${screenshotDir}`);
  } catch (error) {
    // Si el acceso falla, creamos el directorio
    logger.info(`El directorio no existe, creando: ${screenshotDir}`);
    try {
      await fs.mkdir(screenshotDir, { recursive: true }); // Crear directorios intermedios si es necesario
    } catch (mkdirError) {
      logger.error(
        `Error al crear el directorio para las capturas de pantalla: ${mkdirError.message}`
      );
      throw new Error(`No se pudo crear el directorio: ${screenshotDir}`);
    }
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
      const rows = Array.from(
        document.querySelectorAll("#resultado table tbody tr")
      );
      const extractedData = [];

      rows.forEach((row) => {
        const columns = row.querySelectorAll("td");
        extractedData.push({
          date: columns[0]?.innerText.trim() || "",
          planta: columns[1]?.innerText.trim() || "",
          historia: columns[2]?.innerText.trim() || "",
          estado: columns[3]?.innerText.trim() || "",
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
      if (alert) {
        let text = alert.innerText.trim();
        // Eliminar la "x" u otros caracteres no deseados si están presentes al inicio
        text = text.replace(/^×\s*/, ""); // Reemplaza la "x" y el espacio al inicio, si existe
        return text;
      }
      return null;
    });
    logger.info("Mensaje resultado:", noResultsMessage);
    if (noResultsMessage) {
      logger.info(
        "No se encontraron resultados para el número de seguimiento."
      );
      return noResultsMessage;
    } else {
      logger.warn(
        "No se encontró la tabla ni el mensaje esperado en el sitio."
      );
      return "No se encontró la tabla ni el mensaje esperado en el sitio.";
    }
  }
};

const resolveCaptchaAndClick = async (page, captchaService) => {
  logger.info("Resolviendo CAPTCHA...");

  // Medir el tiempo de resolución del CAPTCHA
  const startTime = Date.now();
  let captchaResponse;

  try {
    // Seleccionamos el servicio de CAPTCHA según el parámetro
    switch (captchaService) {
      case "2Captcha":
        const solver = new TwoCaptcha.Solver(process.env.RECAPTCHA_API_KEY);
        const response = (captchaResponse = await solver.recaptcha({
          pageurl: process.env.RECAPTCHA_SCRAPE_PAGE,
          googlekey: process.env.RECAPTCHA_SCRAPE_PAGE_SITE_KEY,
          proxy: `${process.env.RECAPTCHA_USER}:${process.env.RECAPTCHA_PASSWORD}@${process.env.RECAPTCHA_PROXY}`,
          proxytype: "HTTPS",
        }));
        captchaResponse = response.data;
        break;

      case "capsolver":
        captchaResponse = await capsolver(
          process.env.RECAPTCHA_SCRAPE_PAGE_SITE_KEY,
          process.env.RECAPTCHA_SCRAPE_PAGE
        );
        console.log(captchaResponse);
        break;

      case "anticaptcha":
        captchaResponse = await captchaACSolver(
          process.env.RECAPTCHA_SCRAPE_PAGE_SITE_KEY,
          process.env.RECAPTCHA_SCRAPE_PAGE
        );
        console.log(captchaResponse);
        break;

      default:
        throw new Error(`Servicio de CAPTCHA no reconocido: ${captchaService}`);
    }

    if (!captchaResponse) {
      throw new Error("Error al resolver CAPTCHA.");
    }
  } catch (err) {
    logger.error(
      `Error al resolver CAPTCHA con ${captchaService}: ${err.message}`
    );
    throw err;
  }

  logger.info(`Token CAPTCHA: ${captchaResponse}`);

  // Inyectar el token de CAPTCHA en el campo `g-recaptcha-response`
  await page.evaluate((token) => {
    const recaptchaResponseField = document.getElementById(
      "g-recaptcha-response"
    );
    if (recaptchaResponseField) {
      recaptchaResponseField.value = token;
    } else {
      throw new Error("Campo g-recaptcha-response no encontrado");
    }
  }, captchaResponse);

  await page.evaluate(
    `document.getElementById("g-recaptcha-response").innerHTML="${captchaResponse}";`
  );

  logger.info("Token inyectado en el campo g-recaptcha-response");

  // Hacer clic en el checkbox del CAPTCHA
  const recaptchaFrame = page
    .frames()
    .find((frame) => frame.url().includes("recaptcha"));
  if (recaptchaFrame) {
    logger.info("Iframe de reCAPTCHA encontrado");
    await recaptchaFrame.waitForSelector(".recaptcha-checkbox-border", {
      visible: true,
      timeout: 60000,
    });
    logger.info("Haciendo clic en el checkbox de reCAPTCHA");
    await recaptchaFrame.click(".recaptcha-checkbox-border", { force: true });
  } else {
    throw new Error("No se pudo encontrar el iframe de reCAPTCHA.");
  }

  // Medir el tiempo final de resolución
  const endTime = Date.now();
  const resolutionTime = (endTime - startTime) / 1000; // Convertir a segundos
  await new Promise((resolve) => {
    const delay = randomDelay(20, 25);
    setTimeout(resolve, delay);
  });
  // Verificar si el tiempo de resolución es mayor a 120 segundos (2 minutos)
  if (resolutionTime > 120) {
    throw new Error(
      `Tiempo de resolución de CAPTCHA demasiado largo: ${resolutionTime} segundos.`
    );
  }

  logger.info(`CAPTCHA resuelto en: ${resolutionTime} segundos`);
};

const completeAndSubmitForm = async (page, cdNumber) => {
  logger.info("Completando el formulario...");

  // Seleccionar opción del dropdown
  await page.select('select[name="producto"]', "CD");

  // Escribir número en el input
  logger.info("Escribiendo número en el input");
  await page.waitForSelector("input#numero");
  await page.type("input#numero", cdNumber);

  // Hacer clic en el botón de submit
  logger.info("Haciendo clic en el botón de enviar");
  await page.click("button#btsubmit");
  // Esperar a que el proceso de "Procesando..." comience y termine

  await handleProcessLabel(page);

  // Esperar a que los resultados se carguen
  await page.waitForSelector("#resultado", {
    visible: true,
    timeout: 60000,
  });

  logger.info("Formulario enviado con éxito.");
};

// Intentamos manejar ambos casos: cuando el elemento aparece/desaparece rápidamente o cuando se demora.
const handleProcessLabel = async (page) => {
  try {
    // Esperar a que el selector aparezca
    logger.info("Esperando que el elemento #processlabel aparezca...");

    // Usa waitForSelector con una espera corta para detectar si el elemento aparece rápidamente
    await page.waitForSelector("#processlabel", {
      visible: true,
      timeout: 5000,
    });
    logger.info("El elemento #processlabel ha aparecido.");

    // Una vez que aparece, espera hasta que desaparezca (espera más larga)
    logger.info("Esperando que el elemento #processlabel desaparezca...");
    await page.waitForFunction(
      () => {
        const element = document.querySelector("#processlabel");
        return !element || element.style.display === "none"; // Espera a que no exista o su display sea "none"
      },
      { timeout: 120000 } // Esperar hasta 120 segundos para su desaparición
    );
    logger.info("El elemento #processlabel ha desaparecido.");
  } catch (error) {
    // Si el elemento no aparece o no desaparece a tiempo
    if (error.name === "TimeoutError") {
      logger.warn(
        "El elemento #processlabel no apareció o no desapareció dentro del tiempo esperado."
      );
    } else {
      logger.error(
        `Error inesperado al esperar el elemento #processlabel: ${error.message}`
      );
    }
  }
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
    await recaptchaFrame.click(".recaptcha-checkbox-border", { force: true });

    // Esperar un poco después de hacer clic en el checkbox
    await new Promise((resolve) => {
      const delay = randomDelay(3, 5);
      setTimeout(resolve, delay);
    });
  } else {
    throw new Error("No se pudo encontrar el iframe de reCAPTCHA.");
  }

  // Esperar un poco antes de hacer clic en el botón de submit
  await new Promise((resolve) => {
    const delay = randomDelay(3, 4);
    setTimeout(resolve, delay);
  });
  // Hacer clic en el botón de submit
  logger.info("Haciendo clic en el botón de enviar");
  await page.click("button#btsubmit");
  await new Promise((resolve) => {
    const delay = randomDelay(5, 7);
    setTimeout(resolve, delay);
  });
};

module.exports = { scrapeCA, scrapeWithoutBrowser };
