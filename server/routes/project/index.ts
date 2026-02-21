import express from 'express';
import browserRouter from './browser';
import coreRouter from './core';
import migrationRouter from './migration';
import scriptsRouter from './scripts';
import deployRouter from './deploy';
import deployGhPagesRouter from './deploy-ghpages';

const router = express.Router();
router.use(browserRouter);
router.use(coreRouter);
router.use(migrationRouter);
router.use(scriptsRouter);
router.use(deployRouter);
router.use(deployGhPagesRouter);

export default router;
