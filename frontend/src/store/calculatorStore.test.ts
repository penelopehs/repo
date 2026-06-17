import { describe, expect, test } from "vitest";
import type { Entity, LeadData, LeadDataEntity } from "@/types/crm";
import { recalcMasterEntities, renameEntityInCalculations } from "./calculatorStore";

// A minimal saved calculation card (calculations hold Omit<Entity, "id">).
const card = (companyName: string, over: Partial<Entity> = {}): Omit<Entity, "id"> => ({
  companyName,
  state: "",
  employeeCount: "",
  filingStatus: "",
  grossRevenue: "",
  wagesOfficers: "",
  wagesW2: "",
  contractWages: "",
  totalSupplies: "",
  notes: "",
  owners: [],
  ...over,
});

const master = (id: string, name: string, over: Partial<LeadDataEntity> = {}): LeadDataEntity => ({
  id,
  name,
  ...over,
});

const data = (over: Partial<LeadData>): LeadData => ({
  people: [],
  entities: [],
  calculations: {},
  ...over,
});

describe("recalcMasterEntities", () => {
  test("unions unique entities across years, deduped by normalized name", () => {
    const { entities } = recalcMasterEntities(
      data({
        entities: [master("e_acme", "Acme")],
        calculations: {
          "2023": [card("Acme")],
          "2024": [card(" acme "), card("Beta LLC")],
        },
      }),
    );
    expect(entities.map((e) => e.name)).toEqual(["Acme", "Beta LLC"]);
  });

  test("an entity added only in a year's calculation appears in the master list", () => {
    const { entities } = recalcMasterEntities(
      data({
        entities: [master("e_acme", "Acme")],
        calculations: { "2023": [card("Acme"), card("Newco")] },
      }),
    );
    expect(entities.map((e) => e.name)).toContain("Newco");
    // Fresh, stable, name-derived id for the calc-only entity.
    expect(entities.find((e) => e.name === "Newco")?.id).toBe("e_newco");
  });

  test("includes initialEntities when at least one year is empty", () => {
    const { entities } = recalcMasterEntities(
      data({
        entities: [master("e_acme", "Acme"), master("e_seed", "Seed Co")],
        initialEntities: [master("e_acme", "Acme"), master("e_seed", "Seed Co")],
        calculations: {
          "2023": [card("Acme")],
          "2024": [], // empty → initial entities are folded back in
        },
      }),
    );
    expect(entities.map((e) => e.name).sort()).toEqual(["Acme", "Seed Co"]);
  });

  test("drops initial-only entities when every year is non-empty", () => {
    const { entities } = recalcMasterEntities(
      data({
        entities: [master("e_acme", "Acme"), master("e_seed", "Seed Co")],
        initialEntities: [master("e_acme", "Acme"), master("e_seed", "Seed Co")],
        calculations: {
          "2023": [card("Acme")],
          "2024": [card("Acme")],
        },
      }),
    );
    expect(entities.map((e) => e.name)).toEqual(["Acme"]);
  });

  test("preserves id and rich master fields while overlaying card edits", () => {
    const { entities } = recalcMasterEntities(
      data({
        entities: [
          master("e_db_7", "Acme", { entityId: 7, ein: "12-345", city: "Austin", state: "TX" }),
        ],
        calculations: {
          "2023": [card("Acme", { state: "CA", wagesW2: 500 })],
        },
      }),
    );
    expect(entities).toHaveLength(1);
    const e = entities[0];
    expect(e.id).toBe("e_db_7");
    expect(e.entityId).toBe(7);
    expect(e.ein).toBe("12-345"); // kept — not carried by the card
    expect(e.city).toBe("Austin"); // kept — not carried by the card
    expect(e.state).toBe("CA"); // overlaid from the card
    expect(e.w2Wages).toBe(500); // overlaid from the card
  });

  test("blank card fields don't erase existing master values", () => {
    const { entities } = recalcMasterEntities(
      data({
        entities: [master("e_acme", "Acme", { state: "TX", w2Wages: 100 })],
        calculations: { "2023": [card("Acme", { state: "", wagesW2: "" })] },
      }),
    );
    expect(entities[0].state).toBe("TX");
    expect(entities[0].w2Wages).toBe(100);
  });

  test("backfills initialEntities from entities on first run and preserves it after", () => {
    const first = recalcMasterEntities(
      data({
        entities: [master("e_acme", "Acme")],
        calculations: { "2023": [card("Acme")] },
      }),
    );
    expect(first.initialEntities).toEqual([master("e_acme", "Acme")]);

    const snapshot = [master("e_seed", "Seed Co")];
    const second = recalcMasterEntities(
      data({
        entities: [master("e_acme", "Acme")],
        initialEntities: snapshot,
        calculations: { "2023": [card("Acme")] },
      }),
    );
    expect(second.initialEntities).toBe(snapshot);
  });
});

describe("renameEntityInCalculations", () => {
  test("renames matching cards across every year, by normalized name", () => {
    const next = renameEntityInCalculations(
      {
        "2023": [card("Acme"), card("Beta LLC")],
        "2024": [card(" acme ")],
      },
      "Acme",
      "Acme Holdings",
    );
    expect((next["2023"] as Array<Omit<Entity, "id">>).map((c) => c.companyName)).toEqual([
      "Acme Holdings",
      "Beta LLC",
    ]);
    expect((next["2024"] as Array<Omit<Entity, "id">>).map((c) => c.companyName)).toEqual([
      "Acme Holdings",
    ]);
  });

  test("is a no-op when the name is unchanged or blank", () => {
    const calcs = { "2023": [card("Acme")] };
    expect(renameEntityInCalculations(calcs, "Acme", " acme ")).toBe(calcs);
    expect(renameEntityInCalculations(calcs, "", "Whatever")).toBe(calcs);
  });

  test("passes through non-array year values untouched", () => {
    const next = renameEntityInCalculations(
      { "2023": [card("Acme")], "2024": {} },
      "Acme",
      "Acme Holdings",
    );
    expect(next["2024"]).toEqual({});
  });
});
