import mongoose from 'mongoose';

export async function connectDb(uri: string): Promise<void> {
  // Reject after 5s instead of the driver's 30s default when the server is unreachable.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5_000 });
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

// Mongoose builds indexes without waiting for them, so a unique index may not exist yet when
// the first requests race. Awaiting this at startup (and in the test harness) closes that gap.
// Note: also drops indexes no longer declared in a schema.
export async function syncAllIndexes(): Promise<void> {
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}

// E11000: a unique index rejected a write. Raised by MongoDB, not by schema validation.
export function isDuplicateKeyError(err: unknown): err is mongoose.mongo.MongoServerError {
  return err instanceof mongoose.mongo.MongoServerError && err.code === 11000;
}
