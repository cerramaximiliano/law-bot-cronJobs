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
      logger.info(`Disponibles ${trackings.length} trackings para VERIFICAR`);
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
        "No se encontraron trackings pendientes para añadir a la cola para VERIFICAR."
      );
    }
  });
};

const scheduleAddUpdatesToQueue = () => {
  cron.schedule(
    "*/1 * * * *",
    async () => {
      try {
        logger.info(`Iniciando cron job para añadir trackings a la cola`);
        const startOfDay = moment().startOf("day").toDate();
        const trackings = await Tracking.find(
          {
            isCompleted: false,
            isEnqueued: false,
            $or: [
              { lastScraped: { $lt: startOfDay } },
              { lastScraped: { $exists: false } },
            ],
          }
        ).sort({ lastScraped: 1 }); // Ordena por lastScraped, más antiguo primero
        if (trackings.length > 0) {
          logger.info(
            `Disponibles ${trackings.length} trackings para ACTUALIZAR`
          );
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
            "No se encontraron trackings pendientes para añadir a la cola para ACTUALIZAR."
          );
        }
      } catch (err) {}
    },
    {
      scheduled: true,
      timezone: "America/Argentina/Buenos_Aires",
    }
  );
};

module.exports = { scheduleAddJobsToQueue, scheduleAddUpdatesToQueue };
