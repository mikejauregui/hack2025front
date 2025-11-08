import axios from 'axios';

import { getEnvironmentConfig } from '../config/environment';

interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  userId: string;
}

interface OpenPaymentsIntentResponse {
  intentId: string;
  status: string;
  approvalUrl?: string;
  [key: string]: unknown;
}

export class OpenPaymentsService {
  private readonly baseUrl: string;

  private readonly apiKey: string;

  constructor() {
    const config = getEnvironmentConfig();
    this.baseUrl = config.openPayments.baseUrl;
    this.apiKey = config.openPayments.apiKey;
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<OpenPaymentsIntentResponse> {
    // Nota: Este método asume la existencia de un endpoint de OpenPayments que permite crear intents.
    // Cuando se tenga la documentación oficial, actualizar la URL y payload según corresponda.
    const url = `${this.baseUrl}/payments/intents`;

    const response = await axios.post<OpenPaymentsIntentResponse>(
      url,
      {
        amount: params.amount,
        currency: params.currency,
        metadata: {
          userId: params.userId,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data;
  }
}

