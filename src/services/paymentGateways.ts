export type PaymentGatewayName = 'Stripe' | 'Yoco' | 'PayFast' | 'Ozow' | 'Paystack' | 'Pay at property';

export interface PaymentGatewayConfig {
  id: string;
  name: PaymentGatewayName;
  isActive: boolean;
  apiKey: string;
  environment: 'sandbox' | 'live';
  currency: string;
}

export class PaymentGatewayService {
  private gateways: Map<string, PaymentGatewayConfig> = new Map();

  constructor() {
    const configList: PaymentGatewayConfig[] = [
      this.fromEnvironment('stripe', 'Stripe', 'STRIPE_SECRET_KEY'),
      this.fromEnvironment('yoco', 'Yoco', 'YOCO_SECRET_KEY'),
      this.fromEnvironment('payfast', 'PayFast', 'PAYFAST_SECRET_KEY'),
      this.fromEnvironment('ozow', 'Ozow', 'OZOW_API_KEY'),
      this.fromEnvironment('paystack', 'Paystack', 'PAYSTACK_SECRET_KEY'),
      { id: 'pay-at-property', name: 'Pay at property', isActive: true, apiKey: '', environment: 'live', currency: 'ZAR' },
    ];

    for (const gateway of configList) {
      this.gateways.set(gateway.id, gateway);
    }
  }

  getActiveGateways(): PaymentGatewayConfig[] {
    return Array.from(this.gateways.values()).filter(g => g.isActive);
  }

  getGateway(name: PaymentGatewayName): PaymentGatewayConfig | undefined {
    return Array.from(this.gateways.values()).find(g => g.name === name);
  }

  private fromEnvironment(
    id: string,
    name: Exclude<PaymentGatewayName, 'Pay at property'>,
    secretName: string
  ): PaymentGatewayConfig {
    const apiKey = process.env[secretName] ?? '';
    const environment = process.env.NODE_ENV === 'production' ? 'live' : 'sandbox';
    return {
      id,
      name,
      isActive: apiKey.length > 0,
      apiKey,
      environment,
      currency: process.env.PAYMENT_CURRENCY ?? 'ZAR',
    };
  }
}

export default new PaymentGatewayService();
