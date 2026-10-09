import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { buildLlmChatReply } from "../server/llm-chat-engine.js";
import { executeReadOnlyQuery } from "../server/query-runtime.js";

test("Gemini errors never fall back to intent answers or expose provider secrets", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "";
  try { await assert.rejects(buildLlmChatReply("Sales?", null), error => error.status === 503 && /Gemini API key/.test(error.message)); }
  finally { if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey; }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aska-provider-test-"));
  const filePath = path.join(directory, "metrics.sqlite");
  const database = new DatabaseSync(filePath);
  database.exec("CREATE TABLE metrics (revenue INTEGER)"); database.close();
  const connection = { databaseType: "sqlite", filePath };
  try {
    await assert.rejects(buildLlmChatReply("Sales?", connection, { apiKey: "private-test-key", fetch: async () => ({ ok: false, status: 429, json: async () => ({ error: "private-test-key" }) }) }), error => error.status === 429 && !error.message.includes("private-test-key"));
    await assert.rejects(buildLlmChatReply("Sales?", connection, { apiKey: "test-key", fetch: async () => { throw new Error("private network details"); } }), /could not be reached/);
    await assert.rejects(buildLlmChatReply("Sales?", connection, { apiKey: "test-key", fetch: async () => ({ ok: true, json: async () => ({ promptFeedback: { blockReason: "SAFETY" } }) }) }), /could not answer/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});


test("AI carries conversation context, repairs failed SQL, and returns grounded results", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aska-ai-test-"));
  const filePath = path.join(directory, "metrics.sqlite");
  const database = new DatabaseSync(filePath);
  database.exec("CREATE TABLE metrics (revenue INTEGER); INSERT INTO metrics VALUES (20), (30)");
  database.close();
  const connection = { databaseType: "sqlite", filePath };
  const calls = [];
  const responses = [
    { candidates: [{ content: { role: "model", parts: [{ thoughtSignature: "retain-this-signature", functionCall: { id: "wrong", name: "execute_query", args: { sql: "DELETE FROM metrics" } } }] } }] },
    { candidates: [{ content: { role: "model", parts: [{ functionCall: { id: "correct", name: "execute_query", args: { sql: "SELECT SUM(revenue) AS total FROM metrics" } } }] } }] },
    { candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ thought: true, text: "Private reasoning" }, { text: "Total revenue is 50." }, { text: "Calculated from metrics." }] } }] },
  ];
  const mockFetch = async (url, args) => { assert.match(url, /^https:\/\/generativelanguage.googleapis.com\//); assert.equal(args.headers["x-goog-api-key"], "test-key"); calls.push(JSON.parse(args.body)); return { ok: true, json: async () => responses.shift() }; };
  try {
    const result = await buildLlmChatReply("What is the total?", connection, { fetch: mockFetch, apiKey: "test-key", history: [{ role: "user", content: "Use metrics revenue." }, { role: "assistant", content: "I will use that column." }] });
    assert.equal(calls.length, 3);
    assert.equal(calls[0].contents[0].parts[0].text, "Use metrics revenue.");
    assert.match(calls[0].systemInstruction.parts[0].text, /SQL dialect: sqlite/);
    assert.match(calls[0].systemInstruction.parts[0].text, /metrics\(revenue/);
    assert.match(calls[1].contents.at(-1).parts[0].functionResponse.response.error, /read-only/);
    assert.equal(calls[1].contents.at(-2).parts[0].thoughtSignature, "retain-this-signature");
    assert.equal(calls[1].contents.at(-1).parts[0].functionResponse.id, "wrong");
    assert.equal(calls[2].contents.at(-1).parts[0].functionResponse.response.rows[0].total, 50);
    assert.equal(result.mode, "gemini");
    assert.equal(result.rows[0].total, 50);
    assert.equal(result.reply, "Total revenue is 50.\nCalculated from metrics.");
    assert.equal((await executeReadOnlyQuery(connection, "SELECT COUNT(*) AS total FROM metrics"))[0].total, 2);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("read-only queries cap returned rows and preserve quoted semicolons", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aska-query-test-"));
  const filePath = path.join(directory, "metrics.sqlite");
  const database = new DatabaseSync(filePath);
  database.exec("CREATE TABLE metrics (value INTEGER); WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x < 600) INSERT INTO metrics SELECT x FROM n");
  database.close();
  try {
    const connection = { databaseType: "sqlite", filePath };
    assert.equal((await executeReadOnlyQuery(connection, "SELECT * FROM metrics")).length, 500);
    assert.equal((await executeReadOnlyQuery(connection, "SELECT 'safe; drop' AS label;"))[0].label, "safe; drop");
    await assert.rejects(executeReadOnlyQuery(connection, "SELECT load_extension('unsafe')"), /read-only/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
