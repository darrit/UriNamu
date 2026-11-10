import { expect, it } from "vitest";
import { dateLabel, validDate, definitelyBefore } from "../src/dates";
import { newPerson, normalize, validate, unionKey, type Family } from "../src/domain";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DateField from "../src/DateField";

it("validates years without inventing a day and compares uncertain ranges", () => {
  for (const value of ["1987", "1987-02-26", "2000-02-29"]) expect(validDate(value)).toBe(true);
  for (const value of ["0000", "198", "1987-02-30", "1900-02-29", "26.02...."]) expect(validDate(value)).toBe(false);
  expect(dateLabel("1987")).toBe("1987");
  expect(definitelyBefore("1987", "1987-12-20")).toBe(false);
  expect(definitelyBefore("1986", "1987-01-01")).toBe(true);
});

it("round-trips partial dates and permits overlapping birth and wedding years", () => {
  const f: Family = {
    version: 2, name: "Test",
    members: [{ ...newPerson(), id: "a", name: "A", born: "1987-02-26", died: "2020" }, { ...newPerson(), id: "b", name: "B", born: "1987" }],
    unions: [{ id: unionKey("a", "b"), a: "a", b: "b", marriage: "married", status: "active", ended: false, marriedOn: "1987" }],
  };
  expect(() => validate(f)).not.toThrow();
  const restored = normalize(JSON.parse(JSON.stringify(f)));
  expect(restored.unions[0].marriedOn).toBe("1987");
  expect(restored.members[1].born).toBe("1987");
  f.unions[0].marriedOn = "1986";
  expect(() => validate(f)).toThrow();
});

it("offers full date, year and unknown in the profile field", () => {
  const markup = renderToStaticMarkup(createElement(DateField, { label: "Birth", value: "1987", example: "1987-02-26", onChange: () => {} }));
  expect(markup).toContain('value="year" selected=""');
  expect(markup).toContain('value="unknown"');
  expect(markup).toContain('value="1987"');
  expect(markup).not.toContain('<button');
});
