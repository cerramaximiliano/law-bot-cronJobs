// src/tasks/addJobsToQueue.js
const cron = require('node-cron');
const Tracking = require('../models/trackingModel');
const { addJobToQueue } = require('../config/queue');
const moment = require('moment');
const { logger } = require('../config/logger');
const { getUnverifiedTrackings } = require('../controllers/trackingController');

// Tarea para añadir trabajos de tracking a la cola cada cierto intervalo
const scheduleAddJobsToQueue = () => {
  cron.schedule('"*/5 * * * *"', async () => {
    logger.info(`Iniciando cron job para añadir trackings a la cola`);
    const trackings = await getUnverifiedTrackings();
    if (trackings.length > 0) {
      for (const tracking of trackings) {
        await addJobToQueue(tracking.trackingCode, tracking.userId, tracking.trackingType);
      }
    } else {
      logger.info("No se encontraron trackings pendientes para añadir a la cola.");
    }
  });
};

module.exports = { scheduleAddJobsToQueue };
