// Pre-compiled NestJS handler for Vercel serverless
// This file imports from the compiled dist/ output
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { ExpressAdapter } = require('@nestjs/platform-express');
const express = require('express');
const { AppModule } = require('../dist/src/app.module');

const server = express();
let cachedApp = null;
let bootstrapError = null;

async function bootstrap() {
  if (bootstrapError) throw bootstrapError;
  if (!cachedApp) {
    try {
      const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
        logger: ['error', 'warn'],
      });
      app.enableCors({
        origin: process.env.FRONTEND_URL || '*',
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true,
      });
      app.setGlobalPrefix('api');
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          transform: true,
          forbidNonWhitelisted: true,
        }),
      );
      await app.init();
      cachedApp = app;
    } catch (err) {
      bootstrapError = err;
      throw err;
    }
  }
  return server;
}

module.exports = async function handler(req, res) {
  try {
    const app = await bootstrap();
    app(req, res);
  } catch (err) {
    console.error('NestJS bootstrap error:', err);
    res.status(500).json({
      error: 'Bootstrap failed',
      message: err.message,
    });
  }
};
