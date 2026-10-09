// node --experimental-strip-types --test scripts/catalogue.test.mjs
//
// The oracle is mdlondon's own bundle maths: each bundle's "was" price on the
// store is the sum of its products' individual prices. If our catalogue's
// prices or bundle contents drift from the store, these sums stop matching.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRODUCTS, ROUTINES, matchRoutine, campaignLabel } from "../lib/products.ts";

const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
const cutouts = JSON.parse(readFileSync(new URL("../lib/cutouts.json", import.meta.url)));

test("every routine is made of real products", () => {
  for (const r of ROUTINES) {
    for (const id of r.productIds) assert.ok(byId[id], `${r.name}: unknown product ${id}`);
  }
});

test("each bundle's store 'was' price equals the sum of its products", () => {
  for (const r of ROUTINES) {
    // The store sells reduced tools inside bundles at full price, so sum the
    // pre-sale price where there is one.
    const sum = r.productIds.reduce((s, id) => s + (byId[id].wasPrice ?? byId[id].price), 0);
    assert.equal(sum, r.wasPrice, `${r.name}: products sum to £${sum}, store says was £${r.wasPrice}`);
  }
});

test("every product has a cutout with a tone", () => {
  for (const p of PRODUCTS) {
    assert.ok(cutouts[p.id], `no cutout for ${p.id}`);
    assert.match(cutouts[p.id].tone, /^#[0-9a-f]{6}$/);
  }
});

test("a selection matching a routine is named after it, in any order", () => {
  assert.equal(matchRoutine(["the-12", "the-1", "the-5", "the-2"])?.name, "Volume + Body");
  assert.equal(matchRoutine(["the-1", "the-2", "the-5"]), null);
  assert.equal(campaignLabel(["the-1", "the-3", "the-6", "the-9"].map((id) => byId[id])), "Defined Curls");
});
