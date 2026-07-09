import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pkg = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'),
) as { name: string; version: string };

export default async function versionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/version', async (_req, reply) => {
    return reply.send({
      name:      pkg.name,
      version:   pkg.version,
      status:    'ok',
      timestamp: new Date().toISOString(),
    });
  });
}

