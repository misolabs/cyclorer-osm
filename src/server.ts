import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import config from './config';
import highwaysRoutes from './routes/highways';
import versionRoutes from './routes/version';

export async function buildServer() {
  const app = Fastify({
    logger: config.nodeEnv === 'development'
      ? {
          level: 'debug',
          transport: { target: 'pino-pretty', options: { colorize: true } },
        }
      : { level: 'warn' },
  });

  // Plugins
  await app.register(cors, {
    origin: config.corsOrigin,
    methods: ['GET', 'OPTIONS'],
  });

  await app.register(sensible);

  // Routes
  await app.register(versionRoutes);
  await app.register(highwaysRoutes);

  return app;
}

