const cron = require("node-cron");
const Tracking = require("../models/trackingModel");
const CaptchaResult = require("../models/captchaResultModel");
const { scrapeCA } = require("../services/scrapingService");
const {
  logger,
  clearLogs,
  clearMonitorLogs,
  checkAndDeleteLogs,
} = require("../config/logger");
const moment = require("moment");
const { logCaptchaResult } = require("../controllers/captchaResultController");
const { addJobToQueue } = require("../config/queue");

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
    "*/5 20-23 * * 1-5",
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

const cronJobDeleteLogs = async () => {
  cron.schedule("0 0 */10 * *", async () => {
    logger.info("Ejecutando limpieza de logs.");
    try {
      await clearLogs();
    } catch (err) {
      logger.error(`Error ejecutando limpieza de logs periódica: ${err}`);
    }
  });
  cron.schedule("0 0 */5 * *", async () => {
    logger.info("Ejecutando limpieza de logs.");
    try {
      await clearMonitorLogs();
    } catch (err) {
      logger.error(`Error ejecutando limpieza de logs semanal: ${err}`);
    }
  });
  cron.schedule("0 11 * * *", async () => {
    logger.info("Ejecutando limpieza de logs diaria.");
    try {
      await checkAndDeleteLogs();
    } catch (err) {
      logger.error(`Error ejecutando limpieza de logs diaria: ${err}`);
    }
  });
};

const testUpdate = async (nRepetitions, isTesting = true) => {
  try {
    logger.info(
      `Iniciando cron job para añadir trackings a la cola (repeticiones: ${nRepetitions}, testing: ${isTesting})`
    );

    const startOfDay = moment().startOf("day").toDate();

    // Consulta para obtener los trackings
    const query = {
      isArchive: false,
      isErase: false,
    };

    const trackings = await Tracking.find(query).sort({ lastScraped: 1 });

    // Si no hay suficientes documentos, repetimos los trackings
    const totalTrackings = trackings.length;
    if (totalTrackings === 0) {
      logger.info("No se encontraron trackings pendientes para procesar.");
      return;
    }

    logger.info(`Se encontraron ${totalTrackings} trackings.`);

    // Crear documento inicial de CaptchaResult
    const captchaResult = await CaptchaResult.create({
      service: "TestService",
      success: 0,
      failure: 0,
      ipsUsedSuccess: [],
      ipsUsedFailure: [],
      scrapeDuration: [],
      type: isTesting ? "testing" : "production",
      startTime: new Date(),
      endTime: null,
      repetitions: nRepetitions,
    });

    const captchaResultId = captchaResult._id; // Guardamos el _id para las actualizaciones posteriores

    // Bucle para añadir nRepetitions jobs a la cola
    for (let i = 0; i < nRepetitions; i++) {
      // Usar un índice cíclico para repetir los trackings si es necesario
      const tracking = trackings[i % totalTrackings];
      logger.info(`Añadiendo tracking con _id: ${tracking._id} (Repetición ${i + 1} de ${nRepetitions})`);

      try {
        // Añadir el trabajo a la cola
        await addJobToQueue(
          tracking.trackingCode,
          tracking.userId,
          tracking.trackingType,
          tracking._id,
          isTesting,
          captchaResultId
        );
      } catch (err) {
        logger.error(`Error al añadir tracking con _id: ${tracking._id} a la cola: ${err.message}`);
      }
    }
    
    logger.info(`${nRepetitions} trabajos añadidos a la cola correctamente.`);
  } catch (err) {
    logger.error("Error durante la ejecución de la simulación:", err);
  }
};




module.exports = {
  testUpdate,
  cronJobDeleteLogs,
};
