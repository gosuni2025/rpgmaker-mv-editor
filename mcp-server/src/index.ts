#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerMapTools } from './tools/maps.js';
import { registerEventTools } from './tools/events.js';
import { registerDatabaseTools } from './tools/database.js';

const server = new McpServer({
  name: 'rpgmaker-mv-editor',
  version: '1.0.0',
});

registerMapTools(server);
registerEventTools(server);
registerDatabaseTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
