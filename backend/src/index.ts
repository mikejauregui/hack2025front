import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { paymentRouter } from './routes/paymentRoutes';
import { faceAuthRouter } from './routes/faceAuthRoutes';

const app = express();
const port = process.env.PORT || 3001;

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? '*',
  }),
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/payments', paymentRouter);
app.use('/api/face-auth', faceAuthRouter);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API backend escuchando en el puerto ${port}`);
});

