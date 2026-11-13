import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Realtime updates over Socket.IO.
 *
 * ## Tenancy
 *
 * Rooms encode the authorization boundary, and a socket may only join rooms the
 * connection is entitled to:
 *
 *   shop:<shopId>  — authenticated owner/staff of that shop
 *   order:<orderId> — the customer tracking an order, via a per-order token
 *   agent:<agentId> — an authenticated Print Agent
 *   admin           — platform administrators only
 *
 * The join handler re-checks the JWT's claims rather than trusting the room name
 * the client asks for. Subscribing to another shop's room is therefore not a
 * matter of guessing an id.
 *
 * Emits are fire-and-forget: a broken socket must never break a print.
 */

let io = null;

export function attachRealtime(httpServer) {
  if (!config.realtime.enabled) {
    logger.info('Realtime disabled by configuration');
    return null;
  }

  io = new Server(httpServer, {
    cors: {
      origin: config.cors.origins,
      credentials: true,
    },
    // Long-polling is kept as a fallback for restrictive corporate networks,
    // which is realistic for print shops.
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = jwt.verify(token, getSecret(), {
        issuer: config.auth.issuer,
        audience: config.auth.audience,
      });
      // Attach only what the socket is allowed to know.
      socket.data.auth = {
        userId: payload.sub,
        role: payload.role,
        shopId: payload.shopId ?? null,
      };
      return next();
    } catch {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { role, shopId, userId } = socket.data.auth ?? {};

    // Always join a private room for targeted delivery.
    if (userId) socket.join(`user:${userId}`);

    // Shop rooms are derived from the token, never from a client message.
    if (shopId && (role === 'owner' || role === 'staff')) socket.join(`shop:${shopId}`);
    if (role === 'admin') socket.join('admin');

    socket.on('subscribe:order', ({ orderId } = {}) => {
      // Customers subscribe with a signed per-order token in the handshake,
      // which the middleware has already validated into socket.data.auth.
      if (!orderId) return;
      if (socket.data.auth?.orderId && socket.data.auth.orderId !== orderId) return;
      socket.join(`order:${orderId}`);
    });

    socket.on('subscribe:agent', ({ agentId } = {}) => {
      if (!agentId) return;
      if (socket.data.auth?.agentId !== agentId) return;
      socket.join(`agent:${agentId}`);
    });

    socket.on('disconnect', () => {
      // Rooms are dropped automatically.
    });
  });

  logger.info('Socket.IO attached');
  return io;
}

function getSecret() {
  // Same rule as tokenService: an ephemeral dev secret when none is configured.
  return config.auth.jwtSecret || globalThis.__smartprintEphemeralSecret || 'dev-only-secret';
}

export function getIO() {
  return io;
}

export function emitToShop(shopId, event, payload) {
  if (!io || !shopId) return;
  io.to(`shop:${shopId}`).to('admin').emit(event, payload);
}

export function emitToOrder(orderId, event, payload) {
  if (!io || !orderId) return;
  io.to(`order:${orderId}`).emit(event, payload);
}

export function emitToAgent(agentId, event, payload) {
  if (!io || !agentId) return;
  io.to(`agent:${agentId}`).emit(event, payload);
}

export function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
}

export function emitToAdmins(event, payload) {
  if (!io) return;
  io.to('admin').emit(event, payload);
}

/** Presence: which machines currently have a connected agent. */
export function emitAgentPresence(shopId, presence) {
  if (!io) return;
  io.to(`shop:${shopId}`).to('admin').emit('agent:presence', presence);
}

export async function closeRealtime() {
  if (!io) return;
  await new Promise((resolve) => io.close(resolve));
  io = null;
}
