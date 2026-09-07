import mongoose from 'mongoose';

export async function connectDb(uri: string): Promise<void> {
  // Fail fast if the server is unreachable instead of buffering queries for 30 seconds.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5_000 });
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

// Make sure every index declared in a schema actually exists in MongoDB before we serve
// requests. Mongoose creates indexes in the background by default, which means a unique index
// might not exist yet the first time two requests race. Calling this at startup (and once in
// the test harness) removes that window. Note: syncIndexes also drops indexes that are no
// longer in the schema, which is what we want for a database we own.
export async function syncAllIndexes(): Promise<void> {
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}

// MongoDB rejects a write that violates a unique index with server error code 11000 ("E11000
// duplicate key"). It arrives as a driver error, not a Mongoose ValidationError, because
// uniqueness is enforced by the database, never by the schema.
export function isDuplicateKeyError(err: unknown): err is mongoose.mongo.MongoServerError {
  return err instanceof mongoose.mongo.MongoServerError && err.code === 11000;
}
