import mongoose from 'mongoose';
import config from '../config/index.js';
import createMemoryRepository from './memoryRepository.js';
import createMongooseRepository from './mongooseRepository.js';

/**
 * The repository the application uses.
 *
 * Selection rule, in order:
 *   1. An explicit override (`setRepository`) — tests use this.
 *   2. MongoDB when a URI is configured and connected.
 *   3. The in-memory adapter otherwise, so the API is fully functional —
 *      login, orders, payments, jobs — even with no database available.
 *
 * Falling back to memory is what lets this environment (and a developer's
 * laptop, and CI) exercise real business logic without standing up Mongo. The
 * cost is that data does not survive a restart, which the health endpoint
 * reports explicitly rather than hiding.
 */

let override = null;
let cached = null;

export function setRepository(repository) {
  override = repository;
  cached = null;
}

export function getRepository() {
  if (override) return override;
  if (cached) return cached;

  const mongoReady = config.mongo.uri && mongooseIsConnected();
  cached = mongoReady ? createMongooseRepository() : createMemoryRepository();
  return cached;
}

/** Which adapter is live, for the health report and logs. */
export function getRepositoryKind() {
  if (override) return 'injected';
  if (config.mongo.uri && mongooseIsConnected()) return 'mongodb';
  return 'memory';
}

/** readyState 1 === connected. Anything else cannot serve queries. */
function mongooseIsConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * Called by config/database.js when the connection state changes, so a late
 * connection upgrades the adapter and a drop mid-flight does not leave the app
 * issuing queries against a dead socket.
 */
export function markMongoConnected() {
  if (!override) cached = null;
}

/** Test helper: clear the override and any cached adapter. */
export function resetRepository() {
  override = null;
  cached = null;
}

export default getRepository;
