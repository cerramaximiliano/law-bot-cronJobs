// src/config/queue.js
const Queue = require('bull');

// Crear y configurar la cola
const scrapingQueue = new Queue('scrapingQueue', {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
  },
});

// Añadir trabajos a la cola
const addJobToQueue = async (trackingCode, userId, trackingType) => {
  await scrapingQueue.add(
    { trackingCode, userId, trackingType },
    {
      attempts: 3,  // Reintentar 3 veces si falla
      backoff: 5000, // Esperar 5 segundos entre reintentos
      removeOnComplete: true,  // Eliminar al completar
      removeOnFail: false,  // Mantener el registro de fallos
    }
  );
};

module.exports = {
  scrapingQueue,
  addJobToQueue,
};
