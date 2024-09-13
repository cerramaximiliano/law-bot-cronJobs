// src/config/bullBoard.js
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { createBullBoard } = require('@bull-board/api');
const { ExpressAdapter } = require('@bull-board/express');
const { scrapingQueue } = require('./queue');

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullAdapter(scrapingQueue)],
  serverAdapter: serverAdapter,
});

module.exports = serverAdapter;
