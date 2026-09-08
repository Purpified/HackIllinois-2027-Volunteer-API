import mongoose from 'mongoose';

export async function connectDb(uri: string): Promise<void> {
  // Fail fast if the server is unreachable: connect() rejects after 5 seconds instead of the
  // driver's default 30-second server-selection timeout.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5_000 });
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

// Make sure every index declared in a schema actually exists in MongoDB before we serve
// requests. By default Mongoose starts building indexes when a model's connection opens and
// does not wait for them, so a unique index might not exist yet the first time two requests
// race. Awaiting this at startup (and once in the test harness) removes that window.
// syncIndexes also drops indexes that are no longer declared in the schema; for a database this
// app owns outright that is the behaviour we want (a shared production database would need a
// migration step instead).
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
