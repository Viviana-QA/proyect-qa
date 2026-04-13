import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from '../src/app.module';

const server = express();
let cachedApp: any;

async function bootstrap() {
  if (!cachedApp) {
    const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
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
  }
  return server;
}

export default async function handler(req: any, res: any) {
  const app = await bootstrap();
  app(req, res);
}
