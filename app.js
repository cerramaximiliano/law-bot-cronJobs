const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const { logger } = require("./src/config/logger");
const { port, mongoUri } = require("./config/env");
const {
  cronJobs,
  cronJobDeleteLogs,
  cronJobsUnverifiedTrackings,
} = require("./src/tasks/cronTasks");
/* const { testScraping } = require("./src/tests/cronTestingTasks");
const { scrapeCA } = require("./src/services/scrapingService"); */

const app = express();

// Configurar middlewares y parseo de JSON
/* app.use("/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
 */
// Servir archivos estáticos desde la carpeta 'public'
/* app.use(express.static(path.join(__dirname, "public"))); */
// Ruta para renderizar el archivo HTML de la landing page
/* app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
}); */

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
    //cronJobs()
    //testScraping(50)
    //const scraping = await scrapeCA();
  } catch (error) {
    logger.error(`Error en servidor: ${error}`);
  }
});