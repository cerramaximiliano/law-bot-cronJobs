const cron = require("node-cron");
const Tracking = require("../models/trackingModel");
const { scrapeCA } = require("../services/scrapingService");
const { logger, clearLogs } = require("../config/logger");
const moment = require("moment");
const { logCaptchaResult } = require("../controllers/captchaResultController");
const { getUnverifiedTrackings } = require("../controllers/trackingController");

const captchaServices = ["2Captcha", "capsolver", "anticaptcha"]; // Lista de servicios de CAPTCHA
let serviceErrors = {
  "2Captcha": 0,
  capsolver: 0,
  anticaptcha: 0,
};
const maxErrorsPerService = 3; // Umbral de errores antes de rotar servicio
let currentCaptchaService = captchaServices[0]; // Iniciar con el primer servicio

const getNextCaptchaService = (currentService) => {
  const currentIndex = captchaServices.indexOf(currentService);
  const nextIndex = (currentIndex + 1) % captchaServices.length; // Rotar al siguiente servicio
  return captchaServices[nextIndex];
};

async function updateTracking(
  cdNumber,
  userId,
  notificationId,
  type,
  captchaService
) {
  try {
    logger.info(
      `Iniciando scraping para ${cdNumber} usando ${captchaService}.`
    );

    const scrape = await scrapeCA(
      cdNumber,
      userId,
      notificationId,
      type,
      captchaService
    );

    if (scrape && scrape.success) {
      const tracking = await Tracking.findOne({ trackingCode: cdNumber });
      tracking.lastScraped = new Date();
      tracking.notified = false;
      await logCaptchaResult(captchaService, true, scrape.ip);
      await tracking.save();

      // Reiniciar el contador de errores para el servicio actual
      serviceErrors[captchaService] = 0;
    } else {
      logger.warn(
        `Failed to scrape data for ${cdNumber} usando ${captchaService}.`
      );

      // Aumentar el contador de errores para el servicio actual
      serviceErrors[captchaService] += 1;

      // Si el servicio ha excedido el límite de errores, cambiar al siguiente
      if (serviceErrors[captchaService] >= maxErrorsPerService) {
        logger.warn(
          `Cambiando de servicio de CAPTCHA: ${captchaService} -> siguiente servicio`
        );
        currentCaptchaService = getNextCaptchaService(captchaService);
      }

      await logCaptchaResult(captchaService, false, scrape.ip);
    }
  } catch (err) {
    logger.error(`Error updating scraping ${err}`);
  } finally {
    logger.info(`Finalizando scraping para ${cdNumber} con ${captchaService}.`);
  }
}

const cronJobsUpdateTrackings = async () => {
  cron.schedule(
    "*/5 5-23 * * 1-5",
    async () => {
      logger.info(`Update tracking cron job start`);

      const startOfDay = moment().startOf("day").toDate();
      const tracking = await Tracking.findOneAndUpdate(
        {
          isCompleted: false,
          $or: [
            { lastScraped: { $lt: startOfDay } },
            { lastScraped: { $exists: false } },
          ],
        },
        { $set: { isProcessing: true } }, // Marca el elemento como en proceso
        { sort: { lastScraped: 1 }, new: true } // Selecciona el más antiguo
      );

      if (tracking) {
        logger.info(
          `Iniciando scraping para ${tracking.trackingCode} usando ${currentCaptchaService}.`
        );
        await updateTracking(
          tracking.trackingCode,
          tracking.userId,
          null,
          tracking.trackingType,
          currentCaptchaService // Usar el servicio actual
        );
        logger.info(`Finalizando scraping para ${tracking.trackingCode}.`);
      } else {
        logger.info("No se encontraron tracking pendientes para procesar.");
      }
    },
    {
      scheduled: true,
      timezone: "America/Argentina/Buenos_Aires",
    }
  );
};

const cronJobsUnverifiedTrackings = async () => {
  cron.schedule("*/5 * * * *", async () => {
    try {
      logger.info("Iniciando actualización de trackings no verificados");
      const unverified = await getUnverifiedTrackings();

      if (unverified.length > 0) {
        const cdNumber = unverified[0].trackingCode;
        logger.info(
          `Iniciando scraping de trackings no verificados para CD ${cdNumber}`
        );
        const scraping = await scrapeCA(cdNumber);

        if (
          scraping.success === false &&
          scraping.message === "No se encontraron resultados"
        ) {
          logger.info(
            `No se encontraron resultados. ${cdNumber} isVerified set true, isValid set false`
          );
          const update = await Tracking.findByIdAndUpdate(
            { _id: unverified[0]._id },
            { isVerified: true, isValid: false }
          );
        }
      }
    } catch (error) {
      logger.error("Error en cron de actualización de no verificados");
    }
  });
};

const cronJobDeleteLogs = async () => {
  cron.schedule("0 0 */10 * *", async () => {
    logger.info("Ejecutando limpieza de logs.");
    await clearLogs();
  });
};

module.exports = {
  cronJobsUpdateTrackings,
  cronJobDeleteLogs,
  cronJobsUnverifiedTrackings,
};
