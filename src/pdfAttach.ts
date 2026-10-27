import type { Family } from "./domain";

const ATTACHMENT = "urinamu-family.json";

export function familyForPdf(family: Family): Family {
  const next = structuredClone(family);
  for (const person of next.members) {
    person.photo = "";
    if (person.bio.length > 20_000) person.bio = person.bio.slice(0, 20_000);
    if (person.dynasty) person.dynasty = { ...person.dynasty, logo: "" };
  }
  return next;
}

export async function attachFamily(pdf: import("pdf-lib").PDFDocument, family: Family) {
  const { AFRelationship } = await import("pdf-lib");
  pdf.setTitle(family.name);
  const bytes = new TextEncoder().encode(JSON.stringify(familyForPdf(family)));
  await pdf.attach(bytes, ATTACHMENT, {
    mimeType: "application/json",
    description: "UriNamu",
    afRelationship: AFRelationship.Data,
  });
}
