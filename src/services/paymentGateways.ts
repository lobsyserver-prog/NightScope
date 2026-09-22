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
      { id: 'stripe', name: 'Stripe', isActive: true, apiKey: 'sk_test_placeholder', environment: 'sandbox', currency: 'ZAR' },
      { id: 'yoco', name: 'Yoco', isActive: true, apiKey: 'yoco_test_placeholder', environment: 'sandbox', currency: 'ZAR' },
      { id: 'payfast', name: 'PayFast', isActive: true, apiKey: 'payfast_test_placeholder', environment: 'sandbox', currency: 'ZAR' },
      { id: 'ozow', name: 'Ozow', isActive: true, apiKey: 'ozow_test_placeholder', environment: 'sandbox', currency: 'ZAR' },
      { id: 'paystack', name: 'Paystack', isActive: true, apiKey: 'paystack_test_placeholder', environment: 'sandbox', currency: 'ZAR' },
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
}

export default new PaymentGatewayService();
