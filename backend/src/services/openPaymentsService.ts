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
    if (!this.baseUrl || !this.apiKey) {
      return {
        intentId: `mock-intent-${Date.now()}`,
        status: 'pending',
        approvalUrl: undefined,
        amount: params.amount,
        currency: params.currency,
        userId: params.userId,
        simulated: true,
        message: 'OpenPayments no configurado. Respuesta simulada.',
      } as OpenPaymentsIntentResponse;
    }

    const url = `${this.baseUrl}/payments/intents`;

    try {
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
    } catch (error) {
      if (axios.isAxiosError(error) && error.code === 'ENOTFOUND') {
        throw new Error('No se pudo resolver el host de OpenPayments. Configura OPENPAYMENTS_BASE_URL correctamente.');
      }

      if (error instanceof Error) {
        throw new Error(`Error al invocar OpenPayments: ${error.message}`);
      }

      throw new Error('Error desconocido al comunicarse con OpenPayments.');
    }
  }
}

