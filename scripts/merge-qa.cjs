const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const blank = (id, name, parents = []) => ({
  id,
  name,
  parents,
  born: "",
  died: "",
  place: "",
  bio: "",
  gender: "",
  appearance: "normal",
  photo: "",
});
const key = (a, b) => [a, b].sort().join("|");
const left = {
  version: 2,
  name: "Mutterseite",
  members: [
    blank("mother", "Mutter", ["gm", "gf"]),
    blank("father", "Vater"),
    blank("gm", "Oma"),
    blank("gf", "Opa"),
    blank("kid", "Kind", ["mother", "father"]),
  ],
  unions: [
    {
      id: key("mother", "father"),
      a: "mother",
      b: "father",
      status: "active",
      marriage: "married",
      ended: false,
    },
    { id: key("gm", "gf"), a: "gm", b: "gf", status: "active", ended: false },
  ],
};
const right = {
  version: 2,
  name: "Vaterseite",
  members: [
    blank("m2", "Mutter"),
    blank("f2", "Vater", ["gm2", "gf2"]),
    blank("gm2", "Andere Oma"),
    blank("gf2", "Anderer Opa"),
    blank("kid2", "Kind", ["m2", "f2"]),
  ],
  unions: [
    {
      id: key("m2", "f2"),
      a: "m2",
      b: "f2",
      status: "active",
      marriage: "married",
      ended: false,
    },
    {
      id: key("gm2", "gf2"),
      a: "gm2",
      b: "gf2",
      status: "active",
      ended: false,
    },
  ],
};
(async () => {
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
      headless: true,
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:1420");
    await page.getByRole("button", { name: "Beispiel entdecken" }).waitFor();
    await page.evaluate(
      async ({ left, right }) => {
        await new Promise((resolve, reject) => {
          const req = indexedDB.open("urinamu-preview", 2);
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const db = req.result,
              tx = db.transaction(["state", "trees", "history"], "readwrite");
            tx.objectStore("state").put(left, "family");
            tx.objectStore("state").put("left", "activeTree");
            tx.objectStore("trees").put({ id: "left", family: left });
            tx.objectStore("trees").put({ id: "right", family: right });
            tx.objectStore("history").add({
              treeId: "left",
              family: left,
              label: "Original Mutter",
              created: new Date().toISOString(),
            });
            tx.objectStore("history").add({
              treeId: "right",
              family: right,
              label: "Original Vater",
              created: new Date().toISOString(),
            });
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
        });
      },
      { left, right },
    );
    await page.reload();
    await page.locator(".person").first().waitFor();
    await page
      .getByRole("button", { name: "Zusammenführen", exact: true })
      .click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Zweiter Stammbaum").selectOption("right");
    await dialog.getByRole("button", { name: "Stammbaum laden" }).click();
    await dialog
      .getByLabel("Ehepaar im aktuellen Stammbaum")
      .selectOption(key("mother", "father"));
    await dialog
      .getByLabel("Dasselbe Ehepaar im zweiten Stammbaum")
      .selectOption(key("m2", "f2"));
    await dialog
      .getByLabel("Gemeinsames Paar im Ergebnis")
      .selectOption("married");
    await dialog
      .getByText("Weitere doppelte Personen und Konflikte", { exact: true })
      .click();
    await dialog
      .getByLabel("Abgleich für Kind", { exact: true })
      .selectOption("kid");
    await dialog.getByLabel("Name des neuen Stammbaums").fill("Unsere Familie");
    await dialog
      .getByLabel(
        "Ich bestätige, dass die zugeordneten Personen jeweils dieselbe Person sind.",
      )
      .check();
    assert(
      (await dialog.locator(".merge-result strong").textContent()).includes(
        "7 Mitglieder",
      ),
    );
    await page.screenshot({ path: "docs/merge-preview.png" });
    await dialog
      .getByRole("button", { name: "Als neuen Stammbaum anlegen", exact: true })
      .click();
    await page.waitForFunction(() => !document.querySelector("dialog"));
    assert.equal(await page.locator(".person").count(), 7);
    await page
      .getByRole("button", { name: "Meine Stammbäume", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.locator(".history-list button").first().waitFor();
    assert.equal(await dialog.locator(".history-list button").count(), 3);
    await dialog.getByRole("button").filter({ hasText: "Mutterseite" }).click();
    await page.waitForFunction(() => !document.querySelector("dialog"));
    assert.equal(await page.locator(".person").count(), 5);
    await page
      .getByRole("button", { name: "Sicherungsverlauf", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.locator(".history-list button").first().waitFor();
    assert.equal(await dialog.locator(".history-list button").count(), 1);
    assert(
      (await dialog.locator(".history-list").textContent()).includes(
        "Original Mutter",
      ),
    );
    await dialog
      .getByRole("button", { name: "Schließen", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Meine Stammbäume", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button")
      .filter({ hasText: "Vaterseite" })
      .click();
    await page.waitForFunction(() => !document.querySelector("dialog"));
    assert.equal(await page.locator(".person").count(), 5);
    await page.reload();
    await page.locator(".person").first().waitFor();
    assert(
      (await page.locator(".canvas-meta").textContent()).includes("Vaterseite"),
    );
    await page.waitForTimeout(450);
    await page.locator('[data-person="m2"]').dblclick();
    dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: "Familienstand: Verheiratet", exact: true })
      .click();
    const marriageDialog = page.getByRole("dialog").last();
    await marriageDialog
      .getByLabel("Familienstand", { exact: true })
      .selectOption("divorced");
    await marriageDialog
      .getByRole("button", { name: "Familienstand speichern", exact: true })
      .click();
    await page.waitForFunction(() => !document.querySelector("dialog"));
    assert.equal(await page.locator(".separated").count(), 1);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: explicit spouse mapping, married eligibility, duplicate child match, third tree, unchanged originals, isolated history, switching/reload, divorce editing. No browser errors.",
    );
  } catch (e) {
    const p = browser?.contexts()[0]?.pages()[0];
    if (p) {
      await p.screenshot({ path: "docs/merge-failure.png" });
      console.error(await p.locator("dialog").allTextContents());
    }
    throw e;
  } finally {
    await browser?.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
