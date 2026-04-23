/**
 * Sage Intacct cycle-count REST client.
 *
 * GUARDRAIL — use ONLY these endpoints to push cycle-count data to Intacct.
 * Intacct generates adjustment transactions from a completed cycle count
 * using the item's configured cost method (FIFO / LIFO / average / standard).
 * Bypassing this flow — for example, writing quantities directly to
 * `inventory-control/item`, posting manual journal entries, or setting
 * cost-override fields on adjustment lines — destroys the FIFO/LIFO cost
 * layers and corrupts inventory valuation, COGS, and downstream reports.
 *
 * If a future feature appears to require bypass, treat it as a design bug
 * and escalate — do NOT add a new endpoint that sidesteps this module.
 */

import { intacctFetch } from "./client";

export interface IntacctMeta {
  totalCount?: number;
  totalSuccess?: number;
  totalError?: number;
  start?: number;
  pageSize?: number;
  next?: number | null;
  previous?: number | null;
}

export interface ObjectReference {
  key: string;
  id: string;
  href?: string;
}

export interface CycleCountLine {
  key?: string;
  id?: string;
  href?: string;
  item?: { key?: string; id?: string; name?: string };
  tracking?: {
    bin?: { key?: string | null; id?: string | null };
    aisle?: { key?: string | null; id?: string | null };
    zone?: { key?: string | null; id?: string | null };
    row?: { key?: string | null; id?: string | null };
    serialNumber?: string | null;
    lotNumber?: string | null;
    expirationDate?: string | null;
  };
  quantity?: {
    counted?: string;
    damaged?: string;
    onHand?: string;
    actualAdjustment?: string;
    onHandAtEnd?: string;
  };
  adjustmentReason?: string | null;
  lineCountStatus?: "notCounted" | "inProgress" | "skipped" | "counted";
  unitOfMeasure?: { id?: string; key?: string };
  unitCost?: string | null;
}

export interface CycleCount {
  key?: string;
  id?: string;
  href?: string;
  documentNumber?: string;
  description?: string;
  state?: "notStarted" | "inProgress" | "counted" | "reconciled" | "voided";
  startDate?: string;
  endDate?: string;
  warehouse?: ObjectReference;
  assignedTo?: ObjectReference;
  quantity?: {
    showQuantityOnHand?: boolean;
    excludedAllocatedQuantity?: boolean;
    adjustmentCount?: number;
    damageAdjustmentCount?: number;
    linesInCount?: number;
    linesSkipped?: number;
  };
  lines?: CycleCountLine[];
}

interface ListResponse {
  "ia::result": ObjectReference[];
  "ia::meta": IntacctMeta;
}

interface SingleResponse<T> {
  "ia::result": T;
  "ia::meta": IntacctMeta;
}

export async function listCycleCounts() {
  return intacctFetch<ListResponse>(
    "/objects/inventory-control/cycle-count"
  );
}

export async function getCycleCount(key: string) {
  return intacctFetch<SingleResponse<CycleCount>>(
    `/objects/inventory-control/cycle-count/${encodeURIComponent(key)}`
  );
}

export async function createCycleCount(data: {
  description: string;
  warehouse: { id: string };
  assignedTo: { id: string };
  documentNumber?: string;
  quantity?: CycleCount["quantity"];
  lines?: Array<{
    item: { id: string };
    tracking?: CycleCountLine["tracking"];
  }>;
}) {
  return intacctFetch<SingleResponse<ObjectReference>>(
    "/objects/inventory-control/cycle-count",
    { method: "POST", body: JSON.stringify(data) }
  );
}

export async function updateCycleCount(
  key: string,
  data: Partial<CycleCount> & { lines?: Array<Partial<CycleCountLine> & { key: string }> }
) {
  return intacctFetch<SingleResponse<ObjectReference>>(
    `/objects/inventory-control/cycle-count/${encodeURIComponent(key)}`,
    { method: "PATCH", body: JSON.stringify(data) }
  );
}

export async function deleteCycleCount(key: string) {
  return intacctFetch<void>(
    `/objects/inventory-control/cycle-count/${encodeURIComponent(key)}`,
    { method: "DELETE" }
  );
}
