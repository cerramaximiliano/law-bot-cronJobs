const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const trackingSchema = new Schema({
  userId: {
    type: String,
    ref: "User", // Referencia al modelo de usuario
    required: true,
  },
  notificationId: {
    type: String,
  },
  trackingCode: {
    type: String,
    required: true,
  },
  trackingType: {
    type: String,
    enum: ["telegrama", "carta_documento", "otro"], // Diferentes tipos de seguimiento
    required: true,
  },
  isVerified: {
    type: Boolean,
    required: true,
    default: true,
  },
  isValid: {
    type: Boolean,
    default: true,
  },
  isErase: {
    type: Boolean,
    default: false,
  },
  isArchive: {
    type: Boolean,
    default: false,
  },
  isEnqueued: { type: Boolean, default: false }, // Campo para marcar si ya está en la cola
  alias: {
    type: String,
  },
  lastScraped: { type: Date },
  notified: { type: Boolean, default: false },
  movements: [
    {
      date: {
        type: Date,
        required: true,
      },
      planta: {
        type: String,
        required: true,
      },
      historia: {
        type: String,
        required: true,
      },
      estado: {
        type: String,
        default: "",
      },
    },
  ],
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
  screenshots: [
    {
      path: {
        type: String,
        required: true,
      },
      capturedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});

// Método para agregar un movimiento
trackingSchema.methods.addMovement = function (movement) {
  this.movements.push(movement);
  this.lastUpdated = Date.now();
  return this.save();
};

// Método para agregar una captura de pantalla
trackingSchema.methods.addScreenshot = function (screenshotPath) {
  this.screenshots.push({ path: screenshotPath });
  return this.save();
};

// Método para marcar un seguimiento como completado
trackingSchema.methods.completeTracking = function () {
  this.isCompleted = true;
  this.lastUpdated = Date.now();
  return this.save();
};

module.exports = mongoose.model("Tracking", trackingSchema);
