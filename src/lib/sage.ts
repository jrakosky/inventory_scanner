/**
 * Sage Intacct XML API Integration
 *
 * Sage Intacct uses an XML-based Web Services API.
 * Docs: https://developer.intacct.com/web-services/
 *
 * This module handles authentication and inventory sync operations.
 */

const SAGE_ENDPOINT =
  process.env.SAGE_ENDPOINT ||
  "https://api.intacct.com/ia/xml/xmlgw.phtml";

interface SageConfig {
  senderId: string;
  senderPassword: string;
  companyId: string;
  userId: string;
  userPassword: string;
}

function getConfig(): SageConfig {
  return {
    senderId: process.env.SAGE_SENDER_ID || "",
    senderPassword: process.env.SAGE_SENDER_PASSWORD || "",
    companyId: process.env.SAGE_COMPANY_ID || "",
    userId: process.env.SAGE_USER_ID || "",
    userPassword: process.env.SAGE_USER_PASSWORD || "",
  };
}

function buildControlBlock(config: SageConfig, controlId: string): string {
  return `
    <control>
      <senderid>${config.senderId}</senderid>
      <password>${config.senderPassword}</password>
      <controlid>${controlId}</controlid>
      <uniqueid>false</uniqueid>
      <dtdversion>3.0</dtdversion>
      <includewhitespace>false</includewhitespace>
    </control>`;
}

function buildAuthBlock(config: SageConfig): string {
  return `
    <authentication>
      <login>
        <userid>${config.userId}</userid>
        <companyid>${config.companyId}</companyid>
        <password>${config.userPassword}</password>
      </login>
    </authentication>`;
}

function buildRequest(
  controlBlock: string,
  authBlock: string,
  functionBlock: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  ${controlBlock}
  <operation>
    ${authBlock}
    <content>
      ${functionBlock}
    </content>
  </operation>
</request>`;
}

async function sendRequest(xml: string): Promise<string> {
  const response = await fetch(SAGE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body: xml,
  });

  if (!response.ok) {
    throw new Error(`Sage API error: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

/**
 * Create or update an inventory item in Sage Intacct
 */
export async function syncItemToSage(item: {
  itemId: string;
  name: string;
  description?: string;
  quantity: number;
  category?: string;
}): Promise<{ success: boolean; response: string }> {
  const config = getConfig();

  if (!config.senderId || !config.userId) {
    return {
      success: false,
      response: "Sage Intacct credentials not configured",
    };
  }

  const controlId = `sync-${item.itemId}-${Date.now()}`;
  const controlBlock = buildControlBlock(config, controlId);
  const authBlock = buildAuthBlock(config);

  // Use create_sotransaction or update item
  const functionBlock = `
    <function controlid="${controlId}">
      <create>
        <ITEM>
          <ITEMID>${escapeXml(item.itemId)}</ITEMID>
          <NAME>${escapeXml(item.name)}</NAME>
          <ITEMTYPE>Inventory</ITEMTYPE>
          <EXTENDED_DESCRIPTION>${escapeXml(item.description || "")}</EXTENDED_DESCRIPTION>
          <PRODUCTLINEID>${escapeXml(item.category || "Default")}</PRODUCTLINEID>
        </ITEM>
      </create>
    </function>`;

  const xml = buildRequest(controlBlock, authBlock, functionBlock);

  try {
    const response = await sendRequest(xml);
    const success = !response.includes("<errorno>");
    return { success, response };
  } catch (error) {
    return {
      success: false,
      response: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Fetch all inventory items from Sage Intacct
 */
export async function fetchSageInventory(): Promise<{
  success: boolean;
  response: string;
}> {
  const config = getConfig();

  if (!config.senderId || !config.userId) {
    return {
      success: false,
      response: "Sage Intacct credentials not configured",
    };
  }

  const controlId = `fetch-inventory-${Date.now()}`;
  const controlBlock = buildControlBlock(config, controlId);
  const authBlock = buildAuthBlock(config);

  const functionBlock = `
    <function controlid="${controlId}">
      <readByQuery>
        <object>ITEM</object>
        <fields>ITEMID,NAME,EXTENDED_DESCRIPTION,ITEMTYPE,STATUS</fields>
        <query>ITEMTYPE = 'Inventory'</query>
        <pagesize>1000</pagesize>
      </readByQuery>
    </function>`;

  const xml = buildRequest(controlBlock, authBlock, functionBlock);

  try {
    const response = await sendRequest(xml);
    return { success: true, response };
  } catch (error) {
    return {
      success: false,
      response: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test Sage Intacct connection
 */
export async function testSageConnection(): Promise<{
  connected: boolean;
  message: string;
}> {
  const config = getConfig();

  if (!config.senderId || !config.userId) {
    return {
      connected: false,
      message: "Sage Intacct credentials not configured. Set environment variables.",
    };
  }

  const controlId = `test-${Date.now()}`;
  const controlBlock = buildControlBlock(config, controlId);
  const authBlock = buildAuthBlock(config);

  const functionBlock = `
    <function controlid="${controlId}">
      <getAPISession />
    </function>`;

  const xml = buildRequest(controlBlock, authBlock, functionBlock);

  try {
    const response = await sendRequest(xml);
    if (response.includes("<errorno>")) {
      return { connected: false, message: "Authentication failed" };
    }
    return { connected: true, message: "Connected to Sage Intacct" };
  } catch (error) {
    return {
      connected: false,
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
