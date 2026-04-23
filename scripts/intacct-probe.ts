/**
 * Probe the Sage Intacct sandbox to discover what auth schemes the REST API
 * and XML Gateway accept with the credentials we currently have.
 *
 * Usage:
 *   1. Populate SAGE_SENDER_ID, SAGE_SENDER_PASSWORD, SAGE_COMPANY_ID in .env
 *   2. npx tsx scripts/intacct-probe.ts
 *
 * No writes are performed — only read/auth probes.
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  const contents = readFileSync(path, "utf8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnv();

const SENDER_ID = process.env.SAGE_SENDER_ID || "";
const SENDER_PASSWORD = process.env.SAGE_SENDER_PASSWORD || "";
const COMPANY_ID = process.env.SAGE_COMPANY_ID || "";
const USER_ID = process.env.SAGE_USER_ID || "";
const USER_PASSWORD = process.env.SAGE_USER_PASSWORD || "";

const REST_BASE = "https://api.intacct.com/ia/api/v1";
const XML_GATEWAY = "https://api.intacct.com/ia/xml/xmlgw.phtml";

function divider(label: string) {
  console.log(`\n${"=".repeat(70)}\n  ${label}\n${"=".repeat(70)}`);
}

function assertCreds() {
  if (!SENDER_ID || !SENDER_PASSWORD || !COMPANY_ID) {
    console.error("Missing SAGE_SENDER_ID, SAGE_SENDER_PASSWORD, or SAGE_COMPANY_ID in .env");
    process.exit(1);
  }
}

async function probeRestUnauthenticated() {
  divider("Probe 1: REST API with no auth");
  console.log(`GET ${REST_BASE}/objects/inventory-control/cycle-count`);
  try {
    const res = await fetch(`${REST_BASE}/objects/inventory-control/cycle-count`);
    console.log(`Status: ${res.status} ${res.statusText}`);
    console.log("Headers:", Object.fromEntries(res.headers.entries()));
    const body = await res.text();
    console.log("Body:", body.slice(0, 2000));
  } catch (e) {
    console.error("Network error:", e);
  }
}

async function probeRestBasicAuth() {
  divider("Probe 2: REST API with Basic auth (senderId:senderPassword)");
  const basic = Buffer.from(`${SENDER_ID}:${SENDER_PASSWORD}`).toString("base64");
  console.log(`GET ${REST_BASE}/objects/inventory-control/cycle-count`);
  try {
    const res = await fetch(`${REST_BASE}/objects/inventory-control/cycle-count`, {
      headers: { Authorization: `Basic ${basic}` },
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    const body = await res.text();
    console.log("Body:", body.slice(0, 2000));
  } catch (e) {
    console.error("Network error:", e);
  }
}

async function probeRestSenderHeaders() {
  divider("Probe 3: REST API with Intacct sender headers");
  console.log(`GET ${REST_BASE}/objects/inventory-control/cycle-count`);
  try {
    const res = await fetch(`${REST_BASE}/objects/inventory-control/cycle-count`, {
      headers: {
        "X-Intacct-Sender-Id": SENDER_ID,
        "X-Intacct-Sender-Password": SENDER_PASSWORD,
        "X-Intacct-Company-Id": COMPANY_ID,
      },
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    const body = await res.text();
    console.log("Body:", body.slice(0, 2000));
  } catch (e) {
    console.error("Network error:", e);
  }
}

async function probeXmlGateway() {
  divider("Probe 4: XML Gateway — API session request (no user block)");

  // Minimal request that asks Intacct to open a session using only sender credentials.
  // If the sandbox accepts this, we're in without user-level creds.
  // If not, the error message should tell us what's missing.
  const controlId = `probe-${Date.now()}`;
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <control>
    <senderid>${SENDER_ID}</senderid>
    <password>${SENDER_PASSWORD}</password>
    <controlid>${controlId}</controlid>
    <uniqueid>false</uniqueid>
    <dtdversion>3.0</dtdversion>
    <includewhitespace>false</includewhitespace>
  </control>
  <operation>
    <authentication>
      <login>
        <userid>${USER_ID}</userid>
        <companyid>${COMPANY_ID}</companyid>
        <password>${USER_PASSWORD}</password>
      </login>
    </authentication>
    <content>
      <function controlid="probe-1">
        <getAPISession/>
      </function>
    </content>
  </operation>
</request>`;

  console.log(`POST ${XML_GATEWAY}`);
  console.log(`  (userId populated: ${!!USER_ID}, companyId populated: ${!!COMPANY_ID})`);
  try {
    const res = await fetch(XML_GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body,
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.log("Body:", text.slice(0, 3000));
  } catch (e) {
    console.error("Network error:", e);
  }
}

async function main() {
  assertCreds();
  console.log(`Probing Intacct sandbox for company: ${COMPANY_ID}`);
  console.log(`Sender ID: ${SENDER_ID}`);
  console.log(`User creds present: ${USER_ID ? "yes" : "no"}`);

  await probeRestUnauthenticated();
  await probeRestBasicAuth();
  await probeRestSenderHeaders();
  await probeXmlGateway();

  divider("Done");
  console.log("Share the output and we'll decide the path forward.");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
