// src/jobs/scrapingJob.js

const { logger } = require("../config/logger");
const CaptchaResult = require("../models/captchaResultModel");
const Tracking = require("../models/trackingModel");

const { scrapeCA } = require("../services/scrapingService");

module.exports = function processScrapingJob(scrapingQueue) {
  // Procesar trabajos de scraping
  scrapingQueue.process(1, async (job, done) => {
    const { trackingCode, userId, trackingType, _id, captchaResultId } =
      job.data;
    logger.info(`Procesando trabajo: trackingCode ${trackingCode}`);

    try {
      const startScrapeTime = Date.now();
      // Llamar al servicio de scraping
      const scraping = await scrapeCA(
        trackingCode,
        userId,
        trackingType,
        "2Captcha",
        "rutine",
        null,
        _id
      );
      const scrapeDuration = Date.now() - startScrapeTime;

      if (scraping && scraping.success) {
        logger.info(`Scraping completado con éxito: ${trackingCode}`);
        done(); // Trabajo completado
        if (captchaResultId) {
          // Actualizar el documento CaptchaResult con éxito
          try {
            await CaptchaResult.findByIdAndUpdate(captchaResultId, {
              $inc: { success: 1 }, // Incrementar éxitos
              $push: {
                ipsUsedSuccess: scraping.ip,
                scrapeDuration,
                messages:
                  scraping.message || `Scraping exitoso para ${trackingCode}`,
              }, // Agregar duración y IP de éxito
            });
          } catch (err) {
            logger.error("No se pudo guardar el resultado del proceso");
          }
        }
      } else {
        logger.warn(`Scraping fallido: ${trackingCode}`);
        done(new Error(`Scraping fallido: ${trackingCode}`));

        if (captchaResultId) {
          // Actualizar el documento CaptchaResult con fallo
          try {
            await CaptchaResult.findByIdAndUpdate(captchaResultId, {
              $inc: { failure: 1 }, // Incrementar fallos
              $push: {
                ipsUsedFailure: scraping.ip,
                scrapeDuration,
                messages:
                  scraping.message ||
                  `Error desconocido durante el scraping de ${trackingCode}`,
              }, // Agregar duración y IP de fallo
            });
          } catch (err) {
            logger.error("No se pudo guardar el resultado del proceso");
          }
        }
      }
    } catch (error) {
      logger.error(`Error al procesar trabajo: ${error.message}`);
      done(new Error(error.message)); // Marcar como fallido
    }
  });

  // Manejo de fallos
  scrapingQueue.on("failed", async (job, err) => {
    const { _id, trackingCode, captchaResultId } = job.data;
    logger.error(`Trabajo fallido: ${job.id} - ${err.message}`);

    try {
      await CaptchaResult.findByIdAndUpdate(captchaResultId, {
        endTime: new Date(), // Actualiza la hora de finalización cuando todos los trabajos se hayan completado
      });
      // Restablecer el flag isEnqueued para que pueda volver a encolarse
      await Tracking.findByIdAndUpdate(_id, { isEnqueued: false });
      logger.info(
        `Restablecido flag isEnqueued para el trabajo fallido: ${trackingCode}`
      );
    } catch (updateError) {
      logger.error(
        `Error al restablecer flag isEnqueued: ${updateError.message}`
      );
    }
  });

  // Manejo de finalización
  scrapingQueue.on("completed", async (job) => {
    const { _id, trackingCode, captchaResultId } = job.data;
    logger.info(`Trabajo completado: ${job.id}`);

    try {
      await CaptchaResult.findByIdAndUpdate(captchaResultId, {
        endTime: new Date(), // Actualiza la hora de finalización cuando todos los trabajos se hayan completado
      });
      // Establecer isEnqueued en false cuando se complete el trabajo
      await Tracking.findByIdAndUpdate(_id, {
        isEnqueued: false,
        lastScraped: new Date(),
      });
      logger.info(`Flag isEnqueued restablecido a false para: ${trackingCode}`);
    } catch (updateError) {
      logger.error(
        `Error al restablecer flag isEnqueued tras completar: ${updateError.message}`
      );
    }
  });

  scrapingQueue.on("error", (error) => {
    logger.error(`Error en la conexión con Redis: ${error.message}`);
  });

  scrapingQueue.on("waiting", (jobId) => {
    logger.info(`Trabajo en espera: ${jobId}`);
  });

  scrapingQueue.on("active", (job) => {
    logger.info(`Trabajo activo: ${job.id}`);
  });

  scrapingQueue.on("stalled", (job) => {
    logger.warn(`Trabajo estancado: ${job.id}`);
  });
};
