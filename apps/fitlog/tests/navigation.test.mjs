import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "fitlog-navigation-test-"));
const compiled = await build({ entryPoints: [join(root, "lib/client/navigation.ts")], bundle: true, platform: "node", format: "esm", write: false });
const entry = join(temporary, "navigation.mjs");
await writeFile(entry, compiled.outputFiles[0].text);
const { DEFAULT_NAVIGATION, readNavigation, navigationSearch, questionMatchesSearch } = await import(pathToFileURL(entry).href);
after(() => rm(temporary, { recursive: true, force: true }));

test("opening an old example link and returning to a live record restores the correct feed", () => {
  const example = readNavigation("?example=example-wide");
  assert.equal(example.mode, "examples");
  assert.deepEqual(example.selected, { id: "example-wide", example: true });
  const live = readNavigation("?question=real-question");
  assert.equal(live.mode, "live");
  assert.deepEqual(live.selected, { id: "real-question", example: false });
  assert.deepEqual(readNavigation(""), DEFAULT_NAVIGATION);
  // A conflicting URL must never label a real record as a fictional example.
  assert.equal(readNavigation("?mode=examples&example=sample&question=real").mode, "live");
});

test("my records, filters and Korean search survive reload and detail round trips", () => {
  const list = {
    ...DEFAULT_NAVIGATION, tab: "mine", q: "선택 모델 A+B & 100%_", purpose: "long", width: "wide", status: "reviewed",
  };
  const listUrl = navigationSearch(list);
  assert.deepEqual(readNavigation(listUrl), list);
  const detail = { ...list, selected: { id: "record-42", example: false } };
  assert.deepEqual(readNavigation(navigationSearch(detail)), detail);
  // Browser Back returns the complete prior list, not the default community.
  assert.deepEqual(readNavigation(listUrl), list);
  assert.equal(readNavigation(navigationSearch({ ...DEFAULT_NAVIGATION, tab: "closet" })).tab, "closet");
});

test("example list mode persists without a selected article and stays separate from private tabs", () => {
  const examples = { ...DEFAULT_NAVIGATION, mode: "examples", status: "reviewed" };
  assert.deepEqual(readNavigation(navigationSearch(examples)), examples);
  const privateTab = readNavigation("?tab=mine&mode=examples");
  assert.equal(privateTab.tab, "mine");
  assert.equal(privateTab.mode, "live");
  const oldExample = readNavigation("?tab=closet&example=example-1");
  assert.equal(oldExample.tab, "community");
  assert.equal(oldExample.mode, "examples");
});

test("invalid URL values do not become unsupported filters or malformed selected records", () => {
  const invalid = readNavigation(`?tab=other&mode=other&purpose=invalid&width=extra&status=done&question=%20&q=${"a".repeat(150)}`);
  assert.equal(invalid.tab, "community");
  assert.equal(invalid.mode, "live");
  assert.equal(invalid.purpose, "");
  assert.equal(invalid.width, "");
  assert.equal(invalid.status, "");
  assert.equal(invalid.selected, null);
  assert.equal(invalid.q.length, 100);
});

test("example searches find a later choice and follow-up that were absent from the original question", () => {
  const question = {
    title: "처음 모델 A 고민", body: "처음 신발에 관한 질문", targetModel: "A",
    reference: { brand: "기준 브랜드", model: "기준 신발" },
    choice: { brand: "선택 브랜드", model: "Later Runner 100%_" },
    review: { body: "장거리에서 앞발 공간이 편안했어요" },
  };
  assert.equal(questionMatchesSearch(question, "later runner"), true);
  assert.equal(questionMatchesSearch(question, "선택 브랜드"), true);
  assert.equal(questionMatchesSearch(question, "앞발 공간"), true);
  assert.equal(questionMatchesSearch(question, "100%_"), true);
  assert.equal(questionMatchesSearch(question, "검색되지 않는 단어"), false);
  assert.equal(questionMatchesSearch({ ...question, choice: null, review: null }, "later runner"), false);
});
