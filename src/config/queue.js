// src/config/queue.js
const Queue = require("bull");
const Tracking = require("../models/trackingModel");
const { logger } = require("./logger");

// Crear y configurar la cola
const scrapingQueue = new Queue("scrapingQueue", {
  redis: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT || 6379,
  },
});

// Añadir trabajos a la cola
const addJobToQueue = async (trackingCode, userId, trackingType, _id) => {
  try {
    // Verificar si el documento ya está encolado
    const tracking = await Tracking.findById(_id);

    if ((trackingCode, userId, trackingType, _id))
      if (!tracking.isEnqueued) {
        logger.info(
          `Intentando añadir trabajo a la cola: ${trackingCode}, _id: ${_id}`
        );

        // Añadir el trabajo a la cola
        await scrapingQueue.add(
          { trackingCode, userId, trackingType, _id },
          {
            attempts: 1, // Reintentar 3 veces si falla
            backoff: 5000, // Esperar 5 segundos entre reintentos
            removeOnComplete: true, // Eliminar al completar
            removeOnFail: false, // Mantener el registro de fallos
            timeout: 240000, // Tiempo máximo de 3 minutos
          }
        );

        // Actualizar el flag isEnqueued a true
        await Tracking.findByIdAndUpdate(_id, { isEnqueued: true });
        logger.info(
          `Trabajo añadido y flag isEnqueued actualizado para: ${trackingCode}`
        );
      } else {
        logger.info(`El trabajo ya está en la cola para: ${trackingCode}`);
      }
  } catch (error) {
    logger.error(
      `Error al intentar añadir trabajo a la cola: ${error.message}`
    );
  }
};

module.exports = {
  scrapingQueue,
  addJobToQueue,
};
