const osu = require("node-os-utils");
const cpu = osu.cpu;
const mem = osu.mem;
const fs = require("fs");
const { logger } = require("../config/logger");

// Función para obtener el uso de memoria del proceso actual
const getMemoryUsage = () => {
  const memoryUsage = process.memoryUsage();

  return {
    rss: (memoryUsage.rss / 1024 / 1024).toFixed(2), // Resident Set Size
    heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2), // Total heap memory allocated
    heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2), // Memory actually used
    external: (memoryUsage.external / 1024 / 1024).toFixed(2), // Memory used by C++ objects bound to JavaScript objects
  };
};

// Definimos la función para monitorear y registrar los recursos
const monitorResources = async () => {
  try {
    const cpuUsage = await cpu.usage(); // Porcentaje de uso de CPU
    const memInfo = await mem.info(); // Información de memoria

    const memoryInUse = getMemoryUsage();

    const log = `CPU Usage: ${cpuUsage}% | Memoria Libre: ${memInfo.freeMemMb}MB / Total Memoria: ${memInfo.totalMemMb}MB | ` +
                `Memoria del Proceso - RSS: ${memoryInUse.rss}MB, Heap Total: ${memoryInUse.heapTotal}MB, Heap Used: ${memoryInUse.heapUsed}MB, External: ${memoryInUse.external}MB\n`;

    // Escribimos los logs en un archivo
    fs.appendFile("./src/logs/resource-usage.log", log, (err) => {
      if (err) throw err;
      logger.info("Registro de uso de recursos guardado");
    });
  } catch (error) {
    logger.error("Error al obtener los datos del sistema:", error);
  }
};

module.exports = { monitorResources };
