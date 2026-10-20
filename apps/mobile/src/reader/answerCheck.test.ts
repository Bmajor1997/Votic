import { describe, expect, it } from "vitest";
import { check_answer } from "./answerCheck";
import { ALLOWED_LOCAL_LEVELS, GRADED_ANSWERS } from "./answerCheckDataset";

describe("Check my understanding answer check", () => {
  it.each(GRADED_ANSWERS.map((item) => [item.id, item] as const))(
    "gives %s an allowed result for its rubric category",
    (_id, item) => {
      expect(ALLOWED_LOCAL_LEVELS[item.category]).toContain(check_answer(item.answer, item.passage).level);
    },
  );

  it("recognizes accurate paraphrases that reuse the passage's ideas", () => {
    for (const item of GRADED_ANSWERS.filter((g) => g.category === "correct-paraphrase" && !g.ownWords))
      expect(check_answer(item.answer, item.passage).level).toBe("matches");
  });

  it("doesn't call a correct answer in the reader's own words incomplete", () => {
    for (const item of GRADED_ANSWERS.filter((g) => g.ownWords)) {
      const result = check_answer(item.answer, item.passage);
      expect(["matches", "unconfirmed"]).toContain(result.level);
      expect(result.feedback).toMatch(/your own words|covers the main ideas/);
    }
  });

  it("reads standalone numbers only, and spelled-out passage numbers as digits", () => {
    const passage =
      "Plants turn carbon dioxide into glucose. Adults who sleep fewer than seven hours react slower; 2,000 took part.";
    expect(
      check_answer("Plants turn CO2 into glucose, and adults who sleep under 7 hours react slower.", passage)
        .level,
    ).toBe("matches");
    expect(
      check_answer("Adults sleeping fewer than seven hours react slower, in a study of 2000 people.", passage)
        .level,
    ).toBe("matches");
  });

  it("never tells a correct or mostly correct answer it only has the start of it", () => {
    for (const item of GRADED_ANSWERS.filter((g) =>
      ["correct-paraphrase", "mostly-correct"].includes(g.category),
    ))
      expect(check_answer(item.answer, item.passage).feedback).not.toMatch(/start of it/i);
  });

  it("is deterministic for the same answer", () => {
    for (const item of GRADED_ANSWERS)
      expect(check_answer(item.answer, item.passage)).toEqual(check_answer(item.answer, item.passage));
  });

  it("names the specific idea a partial answer is missing", () => {
    const result = check_answer(
      "New staff have to do safety training at the start.",
      "During the first 25 days, new staff complete safety training in week one, shadow a mentor in weeks two and three, and lead a supervised shift by day 25.",
    );
    expect(result.level).toBe("partial");
    expect(result.missing.length).toBeGreaterThan(0);
    expect(result.feedback).toContain(`“${result.missing[0]}”`);
  });

  it("explains the exact unsupported number or contradiction", () => {
    expect(
      check_answer(
        "Adults who sleep fewer than 5 hours show slower reaction times.",
        "Adults who sleep fewer than 7 hours a night show slower reaction times.",
      ).feedback,
    ).toMatch(/doesn't mention 5/);
    expect(
      check_answer(
        "Raising rates makes consumer spending increase over time.",
        "Raising rates makes consumer spending decrease.",
      ).feedback,
    ).toMatch(/"increase" where the passage says "decrease"/);
  });

  it("reads curly apostrophes and contractions the same as plain ones", () => {
    expect(
      check_answer(
        "Chlorophyll doesn’t absorb light in the leaves at all.",
        "Chlorophyll absorbs light in the leaves.",
      ).level,
    ).toBe("check-detail");
  });
});
