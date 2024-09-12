const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const { logger } = require("./src/config/logger");
const { port, mongoUri } = require("./config/env");
const processScrapingJob = require('./src/jobs/scrapingJob');
const {
  cronJobsUpdateTrackings,
  cronJobDeleteLogs,
  cronJobsUnverifiedTrackings,
} = require("./src/tasks/cronTasks");
const { scheduleAddJobsToQueue } = require("./src/tasks/addJobsToQueue");
const { scrapingQueue } = require("./src/config/queue");
const app = express();

// Conectar a MongoDB
mongoose
  .connect(mongoUri)
  .then(() => {
    logger.info("Conectado a MongoDB");
  })
  .catch((err) => {
    logger.info("Error al conectar a MongoDB:", err);
  });

// Iniciar el servidor
app.listen(port, async () => {
  try {
    logger.info(
      `Servidor corriendo en el puerto ${port} en modo ${process.env.NODE_ENV}`
    );
    scheduleAddJobsToQueue();
    processScrapingJob(scrapingQueue);
    //await cronJobDeleteLogs();
    //await cronJobsUnverifiedTrackings();
    //await cronJobsUpdateTrackings();
  } catch (error) {
    logger.error(`Error en servidor: ${error}`);
  }
});