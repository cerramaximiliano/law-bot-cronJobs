// src/jobs/scrapingJob.js
const { scrapeCA } = require('../services/scrapingService');
const { logger } = require('../config/logger');

module.exports = function processScrapingJob(scrapingQueue) {
  // Procesar trabajos de scraping
  scrapingQueue.process(async (job, done) => {
    const { trackingCode, userId, trackingType } = job.data;
    logger.info(`Procesando trabajo: trackingCode ${trackingCode}`);
    
    try {
      // Llamar al servicio de scraping
      const result = await scrapeCA(trackingCode);
      if (result) {
        logger.info(`Scraping completado con éxito: ${trackingCode}`);
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
        done();  // Trabajo completado
      } else {
        logger.warn(`Scraping fallido: ${trackingCode}, reintentando...`);
        done(new Error(`Scraping fallido: ${trackingCode}`));  // Reintento
      }
    } catch (error) {
      logger.error(`Error al procesar trabajo: ${error.message}`);
      done(new Error(error.message));  // Marcar como fallido
    }
  });

  // Manejo de fallos
  scrapingQueue.on('failed', (job, err) => {
    logger.error(`Trabajo fallido: ${job.id} - ${err.message}`);
  });

  // Manejo de finalización
  scrapingQueue.on('completed', (job) => {
    logger.info(`Trabajo completado: ${job.id}`);
  });
};
