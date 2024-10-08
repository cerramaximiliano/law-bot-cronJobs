const Tracking = require("../models/trackingModel");
const { logger } = require("../config/logger");
const moment = require("moment");

const saveOrUpdateTrackingData = async (
  trackingCode,
  userId,
  tableData,
  screenshotPath,
  trackingType,
  alias,
  _id
) => {
  try {
    let tracking;

    if (_id) tracking = await Tracking.findById({ _id });
    else tracking = await Tracking.findOne({ trackingCode, userId });
    let operation = "none";

    if (tracking) {
      logger.info(`Actualizando el tracking para el código: ${trackingCode}`);
      operation = "update";

      if (Array.isArray(tableData) && tableData.length > 0) {
        logger.info(
          `Hay datos en la tabla para actualizar en el código: ${trackingCode}`
        );

        tableData.forEach((movement) => {
          const movementDate = moment(
            movement.date,
            "DD-MM-YYYY HH:mm"
          ).toDate();
          const exists = tracking.movements.some(
            (m) =>
              m.date.getTime() === movementDate.getTime() &&
              m.planta === movement.planta &&
              m.historia === movement.historia &&
              m.estado === movement.estado
          );

          if (!exists) {
            // Insertar el nuevo movimiento al principio para mantener el orden descendente
            tracking.movements.unshift({
              date: movementDate,
              planta: movement.planta,
              historia: movement.historia,
              estado: movement.estado || "",
            });
          }
        });

        // Asegurarse de que los movimientos están ordenados de mayor a menor fecha
        tracking.movements.sort((a, b) => b.date - a.date);

        tracking.lastUpdated = Date.now();
        tracking.isVerified = true;
        tracking.isValid = true;
        if (screenshotPath) {
          tracking.screenshots = {
            path: screenshotPath,
            capturedAt: Date.now(),
          };
        }
      } else if (
        typeof tableData === "string" &&
        tableData === "No se encontraron resultados"
      ) {
        if (tracking.movements.length > 0) {
          // La nueva situación: hay movimientos previos, solo actualizamos `lastUpdated`
          tracking.lastUpdated = Date.now();
        } else {
          // Situación actual: no hay movimientos previos
          tracking.isValid = false;
          tracking.isVerified = true;
          if (screenshotPath) {
            tracking.screenshots = {
              path: screenshotPath,
              capturedAt: Date.now(),
            };
          }
        }
      } else {
        logger.info(
          `No hay datos en la tabla para actualizar en el código: ${trackingCode}`
        );
        if (screenshotPath) {
          tracking.screenshots = {
            path: screenshotPath,
            capturedAt: Date.now(),
          };
        }
      }

      await tracking.save();
      logger.info("Datos de tracking actualizados correctamente.");
    } else {
      logger.info(`Creando un nuevo tracking para el código: ${trackingCode}`);
      operation = "create";

      tracking = await Tracking.create({
        userId,
        trackingCode,
        alias,
        trackingType,
        movements: Array.isArray(tableData)
          ? tableData.map((movement) => ({
              date: moment(movement.date, "DD-MM-YYYY HH:mm").toDate(),
              planta: movement.planta,
              historia: movement.historia,
              estado: movement.estado || "",
            }))
          : [],
        isVerified: true,
        isValid:
          typeof tableData === "string" &&
          tableData === "No se encontraron resultados"
            ? false
            : true,
        lastUpdated: Date.now(),
        screenshots: screenshotPath
          ? [{ path: screenshotPath, capturedAt: Date.now() }]
          : [],
      });

      // Asegurarse de que los movimientos están ordenados de mayor a menor fecha
      tracking.movements.sort((a, b) => b.date - a.date);

      logger.info("Nuevo tracking creado correctamente.");
    }

    return {
      operation,
      tracking,
    };
  } catch (error) {
    logger.error("Error al guardar o actualizar los datos de tracking:", error);
    throw error;
  }
};

async function getTrackingTelegramas(userId, isCompleted) {
  try {
    // Buscar en la colección Tracking todos los documentos que coincidan con el userId y tengan un trackingType relacionado a telegramas/cartas documento
    const trackingTelegramas = await Tracking.find({
      userId: userId,
      trackingType: "carta_documento",
      isCompleted,
    });

    // Si no encuentra nada, retornar un array vacío
    return trackingTelegramas.length > 0 ? trackingTelegramas : [];
  } catch (error) {
    console.error("Error al obtener los telegramas/cartas:", error);
    return []; // En caso de error, retornar un array vacío
  }
}

async function getUnverifiedTrackings() {
  try {
    const foundedTrackings = await Tracking.find({
      isVerified: false,
      isEnqueued: false,
    });
    if (foundedTrackings) return foundedTrackings;
    else throw new Error("Error al buscar unverified trackings");
  } catch (err) {
    logger.error(`Error al obtener trackings no verificados: ${err}`);
  }
}

module.exports = {
  getTrackingTelegramas,
  saveOrUpdateTrackingData,
  getUnverifiedTrackings,
};
