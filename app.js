const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const { logger } = require("./src/config/logger");
const { port, mongoUri } = require("./config/env");
const processScrapingJob = require("./src/jobs/scrapingJob");
const { cronJobDeleteLogs, testUpdate } = require("./src/tasks/cronTasks");
const {
  scheduleAddJobsToQueue,
  scheduleAddUpdatesToQueue,
} = require("./src/tasks/addJobsToQueue");
const { scrapingQueue } = require("./src/config/queue");
const serverAdapter = require("./src/config/bullBoard");
const { scrapeCA } = require("./src/services/scrapingService");
const { monitorResources } = require("./src/monitor/monitor");
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
    //scheduleAddJobsToQueue();
    //scheduleAddUpdatesToQueue();
    processScrapingJob(scrapingQueue);
    setInterval(monitorResources, 60000);
    await cronJobDeleteLogs();
    await testUpdate(1, true)
  } catch (error) {
    logger.error(`Error en servidor: ${error}`);
  }
});

app.use("/admin/queues", serverAdapter.getRouter());
