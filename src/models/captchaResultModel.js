const mongoose = require('mongoose');

const CaptchaResultSchema = new mongoose.Schema({
  service: { type: String, required: true },
  success: { type: Number, default: 0 },
  failure: { type: Number, default: 0 },
  ipsUsedSuccess: { type: [String], default: [] },
  ipsUsedFailure: { type: [String], default: [] },
  scrapeDuration: { type: [Number], default: [] },
  type: { type: String }, // "testing" o "production"
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  repetitions: { type: Number, default: 0 },
  messages: { type: [String], default: [] }, // Array para guardar los mensajes de scraping
});

module.exports = mongoose.model('CaptchaResult', CaptchaResultSchema);
