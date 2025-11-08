interface EnvironmentConfig {
  openPayments: {
    baseUrl: string;
    apiKey: string;
  };
  aws: {
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    rekognition: {
      minConfidence: number;
    };
  };
}

const parseConfidenceThreshold = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const awsConfig: EnvironmentConfig['aws'] = {
  region: process.env.AWS_REGION ?? '',
  rekognition: {
    minConfidence: parseConfidenceThreshold(process.env.AWS_REKOGNITION_FACE_LIVENESS_MIN_CONFIDENCE, 80),
  },
};

if (process.env.AWS_ACCESS_KEY_ID) {
  awsConfig.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
}

if (process.env.AWS_SECRET_ACCESS_KEY) {
  awsConfig.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
}

if (process.env.AWS_SESSION_TOKEN) {
  awsConfig.sessionToken = process.env.AWS_SESSION_TOKEN;
}

const defaultConfig: EnvironmentConfig = {
  openPayments: {
    baseUrl: process.env.OPENPAYMENTS_BASE_URL ?? 'https://api.openpayments.guide',
    apiKey: process.env.OPENPAYMENTS_API_KEY ?? '',
  },
  aws: awsConfig,
};

export const getEnvironmentConfig = (): EnvironmentConfig => {
  if (!defaultConfig.openPayments.apiKey) {
    // eslint-disable-next-line no-console
    console.warn('OPENPAYMENTS_API_KEY no está configurado. El backend no podrá crear pagos reales.');
  }

  if (!defaultConfig.aws.region) {
    // eslint-disable-next-line no-console
    console.warn(
      'AWS_REGION no está configurado. La integración con Amazon Rekognition Face Liveness permanecerá en modo simulado.',
    );
  }

  return defaultConfig;
};


