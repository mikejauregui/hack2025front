interface EnvironmentConfig {
  openPayments: {
    baseUrl: string;
    apiKey: string;
  };
}

const defaultConfig: EnvironmentConfig = {
  openPayments: {
    baseUrl: process.env.OPENPAYMENTS_BASE_URL ?? 'https://api.openpayments.guide',
    apiKey: process.env.OPENPAYMENTS_API_KEY ?? '',
  },
};

export const getEnvironmentConfig = (): EnvironmentConfig => {
  if (!defaultConfig.openPayments.apiKey) {
    // eslint-disable-next-line no-console
    console.warn('OPENPAYMENTS_API_KEY no está configurado. El backend no podrá crear pagos reales.');
  }

  return defaultConfig;
};



