// Runs before every test file (see vitest.config.ts). Each file gets its own in-memory MongoDB,
// so files can run in parallel without seeing each other's data.
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { connectDb, disconnectDb, syncAllIndexes } from '../src/common/db.ts';
// Importing the app registers every Mongoose model, so syncAllIndexes() below sees all of them.
import '../src/app.ts';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri());
  // Build the indexes now. Unique indexes are what make the duplicate-signup tests meaningful,
  // and Mongoose otherwise builds them in the background.
  await syncAllIndexes();
});

afterEach(async () => {
  // Clear data between tests but KEEP the collections. Dropping a collection drops its indexes
  // too, and a duplicate test without its unique index passes for the wrong reason.
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})),
  );
});

afterAll(async () => {
  await disconnectDb();
  await mongod.stop();
});
