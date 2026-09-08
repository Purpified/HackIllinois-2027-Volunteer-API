import { createApp } from './app.ts';
import { config } from './common/config.ts';
import { connectDb, disconnectDb, syncAllIndexes } from './common/db.ts';

type MongoTarget = { uri: string; stop?: () => Promise<void> };

// With MONGO_URI unset, boot an in-memory MongoDB so `npm run dev` works on a machine with
// nothing installed. It is a dev dependency, hence the dynamic import: production builds with
// a real MONGO_URI never load it.
async function resolveMongo(): Promise<MongoTarget> {
  if (config.MONGO_URI) {
    return { uri: config.MONGO_URI };
  }
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mongod = await MongoMemoryServer.create();
  console.log('MONGO_URI is not set: started an in-memory MongoDB (data is lost on exit)');
  return {
    // The database name goes on the URI; MongoMemoryServer itself has no say in it.
    uri: mongod.getUri('volunteer_api'),
    stop: async () => {
      await mongod.stop();
    },
  };
}

async function main(): Promise<void> {
  const mongo = await resolveMongo();
  await connectDb(mongo.uri);
  await syncAllIndexes();

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    console.log(`Volunteer API listening on http://localhost:${config.PORT}`);
  });
  server.on('error', (err) => {
    console.error('Server failed to start', err);
    process.exit(1);
  });

  // Graceful shutdown: stop taking new connections, let in-flight requests finish, THEN drop
  // the database connection (otherwise a request mid-handler fails with a 500). A hung socket
  // must not keep the process alive forever, so there is a hard deadline.
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n${signal} received: shutting down`);
    setTimeout(() => process.exit(1), 10_000).unref();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeIdleConnections();
    });
    await disconnectDb();
    await mongo.stop?.();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err: unknown) => {
  console.error('Failed to start', err);
  process.exit(1);
});
