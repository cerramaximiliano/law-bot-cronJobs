const { createLogger, transports, format } = require('winston');
const fs = require('fs').promises;
const path = require('path');

const logFilePath = path.join(process.cwd(), 'src', 'logs', 'app.log');

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: logFilePath })
  ],
});

const clearLogs = async () => {
  try {
    await fs.truncate(logFilePath, 0);
    logger.info('Archivo de logs limpiado correctamente.');
  } catch (err) {
    logger.error('Error al limpiar el archivo de logs:', err);
  }
};

module.exports = { logger, clearLogs };