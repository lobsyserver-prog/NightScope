import { createApplicationServer, initializeApplication } from './server';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const host = process.env.SERVER_HOST ?? '0.0.0.0';
const server = createApplicationServer();

await initializeApplication();
server.listen(port, host, () => {
  console.log(`ScopeBridge production server listening on ${host}:${port}`);
  console.log(`Reporting data store: ${process.env.SCOPEBRIDGE_REPORTING_FILE ?? './data/reporting.json'}`);
});

const shutdown = (signal: string): void => {
  console.log(`Received ${signal}; shutting down ScopeBridge`);
  server.close((error) => {
    if (error) {
      console.error('Failed to close ScopeBridge cleanly', error);
      process.exitCode = 1;
    }
  });
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
