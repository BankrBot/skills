#!/usr/bin/env node

/**
 * CLI wrapper for Arcadia Finance MCP server.
 * Connects to the remote endpoint and calls tools by name.
 *
 * Usage:
 *   node arcadia.mjs <tool_name> '<json_args>'
 *   node arcadia.mjs --list
 *
 * Requires: npm install @modelcontextprotocol/sdk
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const ENDPOINT = process.env.ARCADIA_MCP_URL || "https://mcp.arcadia.finance/mcp";
const [toolName, argsJson] = process.argv.slice(2);

if (!toolName) {
  console.error("Usage: node arcadia.mjs <tool_name> '<json_args>'");
  console.error("       node arcadia.mjs --list");
  process.exit(1);
}

const client = new Client({ name: "arcadia-openclaw", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL(ENDPOINT));
await client.connect(transport);

try {
  if (toolName === "--list") {
    const { tools } = await client.listTools();
    for (const t of tools.sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(`${t.name}: ${t.description?.substring(0, 120)}`);
    }
  } else {
    const args = argsJson ? JSON.parse(argsJson) : {};
    const result = await client.callTool({ name: toolName, arguments: args });
    const text = result.content?.[0]?.text ?? "";
    if (result.isError) {
      console.error(`ERROR: ${text}`);
      process.exitCode = 1;
    } else {
      console.log(text);
    }
  }
} finally {
  await client.close();
}
