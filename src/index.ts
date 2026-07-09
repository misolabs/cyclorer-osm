import { buildServer } from './server';
import config from './config';

async function main(): Promise<void> {
  const app = await buildServer();

  try {
    await app.listen({ port: config.port, host: config.host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();

