const { createLogger, transports, format } = require("winston");
const fs = require("fs").promises;
const path = require("path");

const MAX_LOG_SIZE_MB = 5;
const logFilePath = path.join(process.cwd(), "src", "logs", "app.log");
const monitorFilePath = path.join(process.cwd(), "src", "logs", "resource-usage.log");

const logger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: logFilePath }),
  ],
});

const clearLogs = async () => {
  try {
    await fs.truncate(logFilePath, 0);
    logger.info("Archivo de logs limpiado correctamente.");
  } catch (err) {
    logger.error("Error al limpiar el archivo de logs:", err);
  }
};

const clearMonitorLogs = async () => {
  try {
    await fs.truncate(monitorFilePath, 0);
    logger.info("Archivo de logs de monitoreo limpiado correctamente.");
  } catch (err) {
    logger.error("Error al limpiar el archivo de logs de monitoreo:", err);
  }
};

// Función para eliminar el archivo de logs si supera los 5MB
const deleteLogsIfTooLarge = async (filePath) => {
  try {
    const stats = await fs.stat(filePath);
    const fileSizeInMB = stats.size / (1024 * 1024);

    if (fileSizeInMB > MAX_LOG_SIZE_MB) {
      await fs.unlink(filePath);
      logger.info(`El archivo de logs ${path.basename(filePath)} fue eliminado porque superó los ${MAX_LOG_SIZE_MB}MB.`);
    } else {
      logger.info(`El archivo de logs ${path.basename(filePath)} está dentro del límite (${fileSizeInMB.toFixed(2)}MB).`);
    }
  } catch (err) {
    logger.error(`Error al verificar o eliminar el archivo de logs ${path.basename(filePath)}:`, err);
  }
};

// Ejemplo de uso: verificar y eliminar si supera los 5MB
const checkAndDeleteLogs = async () => {
  await deleteLogsIfTooLarge(logFilePath);
  await deleteLogsIfTooLarge(monitorFilePath);
};

module.exports = { logger, clearLogs, clearMonitorLogs, checkAndDeleteLogs };
