require('reflect-metadata');
const express = require('express');
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');

const server = express();
let done = false;
let err = null;

async function init() {
  if (err) throw err;
  if (done) return server;
  try {
    const { AppModule } = require('../dist/src/app.module');
    const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
      logger: console,
    });
    app.enableCors();
    app.setGlobalPrefix('api');
    await app.init();
    done = true;
    return server;
  } catch (e) {
    err = e;
    throw e;
  }
}

module.exports = async function (req, res) {
  try {
    const s = await init();
    s(req, res);
  } catch (e) {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    res.end(JSON.stringify({
      error: 'Server initialization failed',
      message: e.message,
    }));
  }
};
