// src/jobs/scrapingJob.js

const { logger } = require("../config/logger");
const Tracking = require("../models/trackingModel");
const { scrapeCA } = require("../services/scrapingService");

module.exports = function processScrapingJob(scrapingQueue) {
  // Procesar trabajos de scraping
  scrapingQueue.process(1, async (job, done) => {
    const { trackingCode, userId, trackingType, _id } = job.data;
    logger.info(`Procesando trabajo: trackingCode ${trackingCode}`);

    try {
      // Llamar al servicio de scraping
      const scraping = await scrapeCA(trackingCode, userId, trackingType, "2Captcha", "rutine", null, _id);

      if ( scraping && scraping.success ) {
        logger.info(`Scraping completado con éxito: ${trackingCode}`);
        done(); // Trabajo completado
      } else {
        logger.warn(`Scraping fallido: ${trackingCode}, reintentando...`);
        done(new Error(`Scraping fallido: ${trackingCode}`)); // Reintento
      }
    } catch (error) {
      logger.error(`Error al procesar trabajo: ${error.message}`);
      done(new Error(error.message)); // Marcar como fallido
    }
  });

  // Manejo de fallos
  scrapingQueue.on("failed", async (job, err) => {
    const { _id, trackingCode } = job.data;
    logger.error(`Trabajo fallido: ${job.id} - ${err.message}`);

    try {
      // Restablecer el flag isEnqueued para que pueda volver a encolarse
      await Tracking.findByIdAndUpdate(_id, { isEnqueued: false });
      logger.info(`Restablecido flag isEnqueued para el trabajo fallido: ${trackingCode}`);
    } catch (updateError) {
      logger.error(`Error al restablecer flag isEnqueued: ${updateError.message}`);
    }
  });

  // Manejo de finalización
  scrapingQueue.on("completed", async (job) => {
    const { _id, trackingCode } = job.data;
    logger.info(`Trabajo completado: ${job.id}`);

    try {
      // Establecer isEnqueued en false cuando se complete el trabajo
      await Tracking.findByIdAndUpdate(_id, { isEnqueued: false, lastScraped: new Date() });
      logger.info(`Flag isEnqueued restablecido a false para: ${trackingCode}`);
    } catch (updateError) {
      logger.error(`Error al restablecer flag isEnqueued tras completar: ${updateError.message}`);
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
