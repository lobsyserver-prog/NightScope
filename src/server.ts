import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import bookingChannelsService from './services/bookingChannels';
import ownerManagementService from './services/ownerManagement';
import paymentGatewayService from './services/paymentGateways';

interface ProductionStatus {
  status: 'ready' | 'not_ready';
  environment: string;
  activeChannels: string[];
  activePaymentGateways: string[];
  externalChannelsConfigured: number;
  cardGatewaysConfigured: number;
}

function getProductionStatus(): ProductionStatus {
  const activeChannels = bookingChannelsService
    .getActiveChannels()
    .map((channel) => channel.platform);
  const activePaymentGateways = paymentGatewayService
    .getActiveGateways()
    .map((gateway) => gateway.name);
  const externalChannelsConfigured = activeChannels.filter((platform) => platform !== 'direct').length;
  const cardGatewaysConfigured = activePaymentGateways.filter((name) => name !== 'Pay at property').length;

  return {
    status: externalChannelsConfigured > 0 && cardGatewaysConfigured > 0 ? 'ready' : 'not_ready',
    environment: process.env.NODE_ENV ?? 'production',
    activeChannels,
    activePaymentGateways,
    externalChannelsConfigured,
    cardGatewaysConfigured,
  };
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  response.end(payload);
}

export function createApplicationServer() {
  return createServer((request: IncomingMessage, response: ServerResponse) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');

    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Method not allowed' });
      return;
    }

    if (requestUrl.pathname === '/healthz') {
      sendJson(response, 200, { status: 'ok' });
      return;
    }

    if (requestUrl.pathname === '/readyz' || requestUrl.pathname === '/api/production-status') {
      const status = getProductionStatus();
      sendJson(response, status.status === 'ready' ? 200 : 503, status);
      return;
    }

    sendJson(response, 404, { error: 'Not found' });
  });
}

export async function initializeApplication(): Promise<void> {
  await ownerManagementService.initialize();
}

export { getProductionStatus };