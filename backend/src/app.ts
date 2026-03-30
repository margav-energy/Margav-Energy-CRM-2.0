import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import { config } from './config';
import { errorHandler } from './middleware';

import { authRoutes } from './modules/auth';
import { usersRoutes } from './modules/users';
import { leadsRoutes } from './modules/leads';
import { appointmentsRoutes } from './modules/appointments';
import { opportunitiesRoutes } from './modules/opportunities';
import { tasksRoutes } from './modules/tasks';
import { notesRoutes } from './modules/notes';
import { reportsRoutes } from './modules/reports';
import { smsRoutes } from './modules/sms';
import { smsLeadJourneyRoutes } from './modules/smsLeadJourney';
import { adminRoutes } from './modules/admin';
import { notificationsRoutes } from './modules/notifications';
import teamRoutes from './modules/team';

const app = express();

// Twilio webhooks send application/x-www-form-urlencoded, not JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
  })
);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/opportunities', opportunitiesRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/sms-journey', smsLeadJourneyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/team', teamRoutes);

app.use(errorHandler);

export default app;
