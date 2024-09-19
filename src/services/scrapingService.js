const puppeteer = require("puppeteer-extra");

const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const { HttpsProxyAgent } = require("https-proxy-agent");
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
const { launchBrowser } = require("../config/puppeteer");

const siteKey = process.env.RECAPTCHA_SCRAPE_PAGE_SITE_KEY;
const pageUrl = process.env.RECAPTCHA_SCRAPE_PAGE;
const user = process.env.RECAPTCHA_USER;
const password = process.env.RECAPTCHA_PASSWORD;
const dns = process.env.RECAPTCHA_DNS;
const port = process.env.RECAPTCHA_PORT;

const getScreenshotPath = (task, success = true) => {
  if (task === "test") return success ? "/test/success" : "/test/failure";
  return success ? "/success" : "/failure";
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
  cdNumber,
  userId = "66c78ff7e79922bf212a7e43",
  trackingType = "telegrama",
  captchaService = "2Captcha",
  task = "rutine",
  alias = null,
  _id
) => {
  let browser;
  let result = {
    success: false,
    message: "",
    data: null,
    ip: "",
    service: captchaService,
  };

  try {
    logger.info(`Iniciando el proceso de scraping para: ${cdNumber}`);
    if (!cdNumber) {
      throw new Error(
        `No se proporcionó un tracking number correcto: ${cdNumber}`
      );
    }
    const cdNumberPattern = /^[0-9]{9}$/;
    if (!cdNumberPattern.test(cdNumber)) {
      throw new Error(
        `El tracking number debe contener exactamente 9 dígitos: ${cdNumber}`
      );
    }

    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.authenticate({
      username: user, // Usuario del proxy
      password: password, // Contraseña del proxy
    });

    try {
      logger.info("Navegando a la página");
      await page.goto(pageUrl, {
        waitUntil: "domcontentloaded",
      });
    } catch (error) {
      logger.error(`Error al navegar a la página: ${error.message}`);
      throw error; // Detenemos el proceso si la navegación falla
    }

    const ip = await getPublicIP();
    if (ip) {
      result.ip = ip;
    }

    let captchaId;
    try {
      // Resolver CAPTCHA y hacer clic en el checkbox
      captchaId = await resolveCaptchaAndClick(page, captchaService);
    } catch (captchaError) {
      logger.error(`Error al resolver el CAPTCHA: ${captchaError.message}`);
      result.message = `Error al resolver el CAPTCHA: ${captchaError.message}`;
      throw captchaError; // Lanzamos el error para que sea manejado en el bloque general
    }

    const checkCaptchaChallenge = await checkRecaptchaAppearance(page);
    if (checkCaptchaChallenge) {
      logger.info(`Captcha rechazado. Captcha Challenge abierto.`);
      const captchaChallengeData = await extractRecaptchaData(page);
      console.log(captchaChallengeData);

      /*       const solver = new TwoCaptcha.Solver(process.env.RECAPTCHA_API_KEY);
      const resultCaptchaChallenge = await solver.grid({
        body: captchaChallengeData.body,
        textinstructions: captchaChallengeData.textinstructions,
        lang: "es",
        rows: captchaChallengeData.rows,
        columns: captchaChallengeData.columns,
      });
      console.log(resultCaptchaChallenge); */
      /*       if (resultCaptchaChallenge) {
        await solveCaptchaInIframe(page, resultCaptchaChallenge);
        const screenshotPath = await captureScreenshot(
          page,
          cdNumber,
          getScreenshotPath(task, true)
        );
        result.success = false;
        result.message = "Error inesperado en tableData";
        result.data = null;
      } else {
      } */

      const screenshotPath = await captureScreenshot(
        page,
        cdNumber,
        getScreenshotPath(task, false)
      );
      result.success = false;
      result.message = "Resolución de captcha incorrecta";
      result.data = null;
      if (captchaService === "2Captcha") {
        const solver = new TwoCaptcha.Solver(process.env.RECAPTCHA_API_KEY);
        logger.info(`Captcha error id reported: ${captchaId}`);
        if (captchaId) {
          try {
            await solver.badReport(captchaId);
          } catch (badReportError) {
            logger.error(
              `Error al enviar reporte de CAPTCHA erróneo: ${badReportError.message}`
            );
          }
        }
      }
    } else {
      await completeAndSubmitForm(page, cdNumber);
      // Tomar captura de pantalla y extraer datos
      const tableData = await extractTableData(page);
      if (Array.isArray(tableData) && tableData.length === 0) {
        // No se encontraron resultados
        const screenshotPath = await captureScreenshot(
          page,
          cdNumber,
          getScreenshotPath(task, true)
        );
        result.message =
          "No se encontró la tabla ni el mensaje esperado en el sitio.";
        result.success = false;
      } else if (Array.isArray(tableData) && tableData.length > 0) {
        // Guardar datos en la base de datos
        const screenshotPath = await captureScreenshot(
          page,
          cdNumber,
          getScreenshotPath(task, true)
        );
        const trackingResult = await saveOrUpdateTrackingData(
          cdNumber,
          userId,
          tableData,
          screenshotPath,
          trackingType,
          alias,
          _id
        );
        result.success = true;
        result.message = "Proceso completado exitosamente";
        result.data = trackingResult;
      } else if (
        typeof tableData === "string" &&
        tableData === "No se encontraron resultados"
      ) {
        const screenshotPath = await captureScreenshot(
          page,
          cdNumber,
          getScreenshotPath(task, true)
        );
        result.success = true;
        result.message = tableData;
        result.data = null;
      } else {
        const screenshotPath = await captureScreenshot(
          page,
          cdNumber,
          getScreenshotPath(task, false)
        );
        result.success = false;
        result.message = "Error inesperado en tableData";
        result.data = null;

        if (captchaService === "2Captcha") {
          const solver = new TwoCaptcha.Solver(process.env.RECAPTCHA_API_KEY);
          logger.info(`Captcha id: ${captchaId}`);
          if (captchaId) {
            try {
              await solver.badReport(captchaId);
            } catch (badReportError) {
              logger.error(
                `Error al enviar reporte de CAPTCHA erróneo: ${badReportError.message}`
              );
            }
          }
        }
      }
    }

    // Completar y enviar el formulario

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
  const screenshotDir = path.join(__dirname, `screenshots${subPath}`);
  // Verificar si el directorio ya existe
  try {
    await fs.access(screenshotDir); // Intentar acceder al directorio
  } catch (error) {
    // Si el acceso falla, creamos el directorio
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

const resolveCaptchaAndClick = async (
  page,
  captchaService,
  timeout = 240000
) => {
  logger.info("Resolviendo CAPTCHA...");

  const startTime = Date.now();
  let captchaResponse;
  let captchaId = "";

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => {
      reject(new Error("Timeout al resolver CAPTCHA"));
    }, timeout)
  );

  try {
    const captchaPromise = (async () => {
      switch (captchaService) {
        case "2Captcha":
          const solver = new TwoCaptcha.Solver(process.env.RECAPTCHA_API_KEY);
          const response = await solver.recaptcha({
            pageurl: process.env.RECAPTCHA_SCRAPE_PAGE,
            googlekey: process.env.RECAPTCHA_SCRAPE_PAGE_SITE_KEY,
            proxy: `${process.env.RECAPTCHA_USER}:${process.env.RECAPTCHA_PASSWORD}@${process.env.RECAPTCHA_PROXY}`,
            proxytype: "HTTPS",
          });
          captchaResponse = response.data;
          captchaId = response.id;
          break;

        case "capsolver":
          captchaResponse = await capsolver(
            process.env.RECAPTCHA_SCRAPE_PAGE_SITE_KEY,
            process.env.RECAPTCHA_SCRAPE_PAGE
          );
          break;

        case "anticaptcha":
          captchaResponse = await captchaACSolver(
            process.env.RECAPTCHA_SCRAPE_PAGE_SITE_KEY,
            process.env.RECAPTCHA_SCRAPE_PAGE
          );
          break;

        default:
          throw new Error(
            `Servicio de CAPTCHA no reconocido: ${captchaService}`
          );
      }

      if (!captchaResponse) {
        throw new Error("Error al resolver CAPTCHA.");
      }

      return captchaResponse;
    })();

    captchaResponse = await Promise.race([captchaPromise, timeoutPromise]);
    logger.info(`Token CAPTCHA: ${captchaResponse}`);

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

    logger.info("Token inyectado en el campo g-recaptcha-response");

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

    const endTime = Date.now();
    const resolutionTime = (endTime - startTime) / 1000;

    logger.info(`CAPTCHA resuelto en: ${resolutionTime} segundos`);
    return captchaId;
  } catch (err) {
    logger.error(
      `Error al resolver CAPTCHA con ${captchaService}: ${err.message}`
    );
    throw err;
  }
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

const checkRecaptchaAppearance = async (page) => {
  try {
    // Esperar a que el iframe de reCAPTCHA aparezca
    await page.waitForSelector('iframe[src*="recaptcha/api2/bframe"]', {
      visible: true,
      timeout: 20000,
    });

    // Acceder al iframe de reCAPTCHA
    const frames = page.frames();
    const recaptchaFrame = frames.find((frame) =>
      frame.url().includes("recaptcha/api2/bframe")
    );

    if (!recaptchaFrame) {
      throw new Error("No se encontró el iframe de reCAPTCHA.");
    }

    // Verificar si las imágenes están cargadas dentro del iframe
    const imagesLoaded = await recaptchaFrame.evaluate(() => {
      const tiles = document.querySelectorAll(".rc-image-tile-wrapper img");
      return tiles.length > 0;
    });

    // Verificar si las instrucciones están presentes dentro del iframe
    const instructionsVisible = await recaptchaFrame.evaluate(() => {
      const instructionElement = document.querySelector(
        ".rc-imageselect-desc-no-canonical"
      );
      return instructionElement !== null;
    });

    // Retornar true si cualquiera de los dos elementos está visible
    if (imagesLoaded || instructionsVisible) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error(
      "Error al verificar la aparición del reCAPTCHA:",
      error.message
    );
    return false; // Retornar false si ocurre un error
  }
};

const extractRecaptchaData = async (page) => {
  try {
    // Esperar a que el iframe de reCAPTCHA aparezca
    await page.waitForSelector('iframe[src*="recaptcha/api2/bframe"]', {
      visible: true,
      timeout: 30000, // 30 segundos de espera
    });

    // Acceder al iframe de reCAPTCHA
    const frames = page.frames();
    const recaptchaFrame = frames.find((frame) =>
      frame.url().includes("recaptcha/api2/bframe")
    );

    if (!recaptchaFrame) {
      throw new Error("No se encontró el iframe de reCAPTCHA.");
    }

    // Obtener los datos del canvas y la imagen de los tiles
    const captchaData = await recaptchaFrame.evaluate(() => {
      return new Promise((resolve, reject) => {
        let textinstructions = document
          .querySelector(".rc-imageselect-desc-wrapper")
          .innerText.replace(/\n/g, " ");

        // Intentar encontrar imagen de 4x4
        let imageSrc;

        let img4x4 = document.querySelector("img.rc-image-tile-44");
        let img3x3 = document.querySelector("img.rc-image-tile-33");
        if (!img4x4 && !img3x3) reject("No se encontraron recaptcha images");
        if (img4x4) {
          imageSrc = img4x4.src;
          rows = 4;
          columns = 4;
        } else {
          imageSrc = img3x3.src;
          rows = 3;
          columns = 3;
        }

        resolve({
          rows: rows,
          columns: columns,
          type: "GridTask",
          textinstructions,
          body: imageSrc,
        });
      });
    });

    // Retornar los datos extraídos
    return captchaData;
  } catch (error) {
    console.error("Error al extraer los datos del reCAPTCHA:", error.message);
    return null;
  }
};

const parseCaptchaData = (data) => {
  return data.split(":")[1].split("/").map(Number); // Extraer los números de "click:1/7/9"
};
const getRecaptchaFrame = async (page) => {
  // Obtener todos los iframes en la página
  const frames = page.frames();

  // Encontrar el iframe que contiene el reCAPTCHA
  const recaptchaFrame = frames.find((frame) =>
    frame.url().includes("recaptcha/api2/bframe")
  );

  if (!recaptchaFrame) {
    throw new Error("No se encontró el iframe de reCAPTCHA.");
  }

  return recaptchaFrame;
};

const clickCaptchaTilesInFrame = async (frame, tileIndices) => {
  // Esperar a que las imágenes del reCAPTCHA estén presentes dentro del iframe
  await frame.waitForSelector(".rc-imageselect-tile", {
    visible: true,
    timeout: 30000,
  });

  // Obtener todos los tiles (cuadrantes) de las imágenes
  const tiles = await frame.$$(".rc-imageselect-tile");

  // Recorrer los índices que se deben hacer clic
  for (const index of tileIndices) {
    const tile = tiles[index - 1]; // Los índices comienzan en 1, por eso se resta 1
    if (tile) {
      await tile.click(); // Hacer clic en el tile correspondiente
    }
  }
};

const submitCaptchaInFrame = async (frame) => {
  // Esperar a que el botón "Verificar" esté disponible dentro del iframe
  await frame.waitForSelector(".rc-button-default.goog-inline-block", {
    visible: true,
    timeout: 30000,
  });

  // Hacer clic en el botón "Verificar"
  const verifyButton = await frame.$(".rc-button-default.goog-inline-block");
  await verifyButton.click();
};

const solveCaptchaInIframe = async (page, captchaSolverResponse) => {
  try {
    // Parsear los índices de los tiles desde la respuesta del captcha solver
    const tileIndices = parseCaptchaData(captchaSolverResponse.data);
    console.log(tileIndices);
    // Acceder al iframe del reCAPTCHA
    const recaptchaFrame = await getRecaptchaFrame(page);
    // Hacer clic en los tiles correspondientes dentro del iframe
    await clickCaptchaTilesInFrame(recaptchaFrame, tileIndices);
    // Presionar el botón "Verificar" dentro del iframe
    await submitCaptchaInFrame(recaptchaFrame);

    console.log("Captcha resuelto y verificado.");
  } catch (error) {
    console.error("Error al resolver el captcha:", error);
  }
};

module.exports = { scrapeCA, scrapeWithoutBrowser };
