const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const { logger } = require("./src/config/logger");
const { port, mongoUri } = require("./config/env");
const {
  cronJobsUpdateTrackings,
  cronJobDeleteLogs,
  cronJobsUnverifiedTrackings,
} = require("./src/tasks/cronTasks");
const { scrapeCA } = require("./src/services/scrapingService");
/* const { testScraping } = require("./src/tests/cronTestingTasks");
const { scrapeCA } = require("./src/services/scrapingService"); */

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
    await cronJobDeleteLogs();
    await cronJobsUnverifiedTrackings();
    await cronJobsUpdateTrackings();
  } catch (error) {
    logger.error(`Error en servidor: ${error}`);
  }
});
