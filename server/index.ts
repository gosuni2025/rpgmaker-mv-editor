import http from 'http';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import fileWatcher from './services/fileWatcher';
import projectManager from './services/projectManager';

import projectRoutes from './routes/project';
import mapsRoutes from './routes/maps';
import databaseRoutes from './routes/database';
import resourcesRoutes from './routes/resources';
import audioRoutes from './routes/audio';
import pluginsRoutes from './routes/plugins';
import eventsRoutes from './routes/events';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Playtest: serve game files
app.get('/api/project/playtest', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).send('No project open');
  res.send(`<!DOCTYPE html><html><head><title>Playtest</title><style>body{margin:0;overflow:hidden}iframe{width:100vw;height:100vh;border:none}</style></head><body><iframe src="/game/index.html"></iframe></body></html>`);
});
app.use('/game', (req, res, next) => {
  if (!projectManager.isOpen()) return res.status(404).send('No project');
  express.static(projectManager.currentPath!)(req, res, next);
});

app.use('/api/project', projectRoutes);
app.use('/api/maps', mapsRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/resources', resourcesRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/plugins', pluginsRoutes);
app.use('/api/events', eventsRoutes);

const server = http.createServer(app);

const wss = new WebSocketServer({ server });
wss.on('connection', (ws: WebSocket) => {
  fileWatcher.addClient(ws);
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Editor server listening on port ${PORT}`);
});
