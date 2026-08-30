import { execFileSync } from "node:child_process";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

const filter = `
  .runs |= map(
    .results |= map(
      select(
        .ruleId != "PinnedDependenciesID" or
        (.locations[0].physicalLocation.artifactLocation.uri // ""
          | startswith("tests/")
          | not)
      )
    )
  )
`;

const result = (ruleId: string, uri?: string) => {
  if (!uri) return { ruleId };

  return {
    ruleId,
    locations: [{ physicalLocation: { artifactLocation: { uri } } }],
  };
};

describe("Scorecard SARIF filtering", () => {
  test("removes only pinned-dependency test findings", () => {
    const sarif = {
      runs: [
        {
          results: [
            result("PinnedDependenciesID", "tests/unit/example.ts"),
            result("OtherRule", "tests/unit/example.ts"),
            result("PinnedDependenciesID", "src/index.ts"),
            result("PinnedDependenciesID"),
          ],
        },
      ],
    };
    const output = execFileSync("jq", [filter], {
      input: JSON.stringify(sarif),
      encoding: "utf8",
    });
    const filtered = JSON.parse(output) as typeof sarif;
    const ruleIds = filtered.runs[0].results.map(({ ruleId }) => ruleId);

    assert.deepStrictEqual(ruleIds, ["OtherRule", "PinnedDependenciesID", "PinnedDependenciesID"]);
  });
});
