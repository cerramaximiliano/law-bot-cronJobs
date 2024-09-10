const mongoose = require("mongoose");

const CaptchaResultSchema = new mongoose.Schema({
  service: { type: String, required: true },
  date: { type: Date, default: Date.now },
  success: { type: Number, default: 0 },
  failure: { type: Number, default: 0 },
  ipsUsedSuccess: { type: [String], default: [] },
  ipsUsedFailure: { type: [String], default: [] },
  scrapeDuration: [{ type: Number }], // Tiempo que tomó el scraping
  type: { type: String }, // Tipo de scraping (e.g., "testing")
  startTime: { type: Date }, // Tiempo de inicio del testing
  endTime: { type: Date }, // Tiempo de finalización del testing
  repetitions: { type: Number }, // Cantidad de repeticiones del test
});

module.exports = mongoose.model("CaptchaResult", CaptchaResultSchema);