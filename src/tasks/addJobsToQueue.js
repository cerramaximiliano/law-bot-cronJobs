// src/tasks/addJobsToQueue.js
const cron = require("node-cron");
const Tracking = require("../models/trackingModel");
const { addJobToQueue, scrapingQueue } = require("../config/queue");
const moment = require("moment");
const { logger } = require("../config/logger");
const { getUnverifiedTrackings } = require("../controllers/trackingController");

// Tarea para añadir trabajos de tracking a la cola cada cierto intervalo
const scheduleAddJobsToQueue = () => {
  cron.schedule("*/2 * * * *", async () => {
    logger.info(`Iniciando cron job para añadir trackings a la cola`);
    const trackings = await getUnverifiedTrackings();

    // Log detallado de los trackings
    if (trackings.length > 0) {
      logger.info(`Disponibles ${trackings.length} trackings`);
      for (const tracking of trackings) {
        logger.info(`Procesando tracking con _id: ${tracking._id}`);
        try {
          await addJobToQueue(
            tracking.trackingCode,
            tracking.userId,
            tracking.trackingType,
            tracking._id
          );
        } catch (err) {
          logger.log(err);
        }
      }
    } else {
      logger.info(
        "No se encontraron trackings pendientes para añadir a la cola."
      );
    }
  });
};

module.exports = { scheduleAddJobsToQueue };
