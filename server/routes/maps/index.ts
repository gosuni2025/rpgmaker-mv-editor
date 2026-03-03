import express from 'express';
import { registerSampleMapRoutes } from './sampleMapRoutes';
import { registerMapReadWriteRoutes } from './mapReadWrite';
import { registerMapDeleteRestoreRoutes } from './mapDeleteRestore';
import { registerMigrationRoutes } from './migrationRoutes';

const router = express.Router();

// NOTE: 샘플 맵 라우트는 GET /:id 와일드카드보다 앞에 등록해야 함
registerSampleMapRoutes(router);
registerMapReadWriteRoutes(router);
registerMapDeleteRestoreRoutes(router);
registerMigrationRoutes(router);

export default router;
