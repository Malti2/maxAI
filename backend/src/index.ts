import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import chatRouter from './routes/chat';
import settingsRouter from './routes/settings';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0' }));

app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);
app.use('/api/settings', settingsRouter);

app.listen(PORT, () => {
  console.log(`🚀 Max Backend läuft auf Port ${PORT}`);
});
