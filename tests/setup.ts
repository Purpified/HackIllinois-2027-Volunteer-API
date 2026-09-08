// Runs before every test file: each file gets its own in-memory MongoDB.
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { connectDb, disconnectDb, syncAllIndexes } from '../src/common/db.ts';
// Registers every model so syncAllIndexes() sees them all.
import '../src/app.ts';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri());
  // Build indexes up front; the duplicate tests depend on them existing.
  await syncAllIndexes();
});

afterEach(async () => {
  // deleteMany, not drop: dropping a collection drops its indexes too.
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})),
  );
});

afterAll(async () => {
  await disconnectDb();
  await mongod.stop();
});
