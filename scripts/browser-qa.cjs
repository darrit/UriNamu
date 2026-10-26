// Run with PLAYWRIGHT_MODULE pointing to an already installed Playwright module.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
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
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:1420");
    await page.getByRole("button", { name: "Beispiel entdecken" }).click();
    await page.locator(".person").first().waitFor();
    assert.equal(await page.locator(".person").count(), 11);
    assert.equal(await page.locator(".partner-slot").count(), 3);
    await page.locator('[data-person="7"]').click();
    await page.waitForTimeout(700);
    let box = await page.locator('[data-person="7"]').boundingBox(),
      canvas = await page.locator(".canvas").boundingBox();
    assert(Math.abs(box.x + box.width / 2 - (canvas.x + canvas.width / 2)) < 2);
    assert(
      Math.abs(box.y + box.height / 2 - (canvas.y + canvas.height / 2)) < 2,
    );
    assert.equal(await page.locator('input[type="checkbox"]').count(), 0);
    await page.locator('[data-person="7"]').click({ button: "right" });
    assert.equal(
      await page
        .getByRole("menuitem", { name: "Eltern bereits vollständig" })
        .isDisabled(),
      true,
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("menu").count(), 0);

    await page.getByRole("button", { name: "Gesamtansicht" }).click();
    await page.locator('[data-person="1"]').click({ button: "right" });
    await page
      .getByRole("menuitem", { name: "Vorfahren ergänzen", exact: true })
      .click();
    await page.waitForTimeout(650);
    assert.equal(await page.locator(".ancestor-slot").count(), 1);
    await page.locator(".ancestor-slot").first().click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Vorname", { exact: true }).fill("Otto");
    await dialog.getByLabel("Nachname", { exact: true }).fill("Morgenstern");
    await dialog.getByLabel("Geburtsdatum", { exact: true }).fill("01.01.1900");
    await dialog.getByRole("button", { name: "Änderungen speichern" }).click();
    await page.waitForFunction(() => !document.querySelector("dialog"));
    assert.equal(await page.locator(".person").count(), 12);
    assert.equal(await page.locator(".ancestor-slot").count(), 0);
    await page.locator('[data-person="1"]').click({ button: "right" });
    await page
      .getByRole("menuitem", { name: "Ergänzung beenden", exact: true })
      .click();
    assert.equal(await page.locator(".ancestor-slot").count(), 0);
    await page.locator('[data-person="1"]').focus();
    await page.keyboard.press("Shift+F10");
    await page
      .getByRole("menuitem", { name: "Vorfahren ergänzen", exact: true })
      .waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("menu").count(), 0);

    assert.equal(await page.locator(".person").count(), 12);
    await page.getByRole("button", { name: "Gesamtansicht" }).click();
    await page.locator('[data-person="7"]').dblclick();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Scheidung eintragen" }).click();
    await page
      .getByRole("dialog")
      .last()
      .getByRole("button", { name: "Bestätigen" })
      .click();
    await page.waitForFunction(() => !document.querySelector("dialog"));
    assert.equal(await page.locator(".separated").count(), 1);
    assert.equal(await page.locator(".partner-slot").count(), 6);
    await page.getByRole("button", { name: "Mitglied hinzufügen" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Vorname", { exact: true }).fill("Alex");
    await dialog.getByLabel("Nachname", { exact: true }).fill("Test");
    await dialog.getByLabel("Geschlecht").selectOption("male");
    await dialog
      .getByLabel("Aktueller Partner / aktuelle Partnerin")
      .selectOption("7");
    await dialog.getByRole("button", { name: "Änderungen speichern" }).click();
    await page.waitForFunction(() => !document.querySelector("dialog"));
    assert.equal(await page.locator(".person").count(), 13);
    assert.equal(await page.locator(".separated").count(), 1);
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelectorAll(".person").length === 12,
    );
    await page
      .getByRole("button", { name: "Wiederherstellen", exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelectorAll(".person").length === 13,
    );
    await page.reload();
    await page.waitForTimeout(800);
    await page.locator(".person").first().waitFor();
    assert.equal(await page.locator(".person").count(), 13);
    await page.locator('[data-person="9"]').dblclick();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Bearbeiten" }).click();
    await dialog.getByLabel("Geburtsort").fill("Neuer Ort");
    await dialog
      .getByRole("button", { name: "Schließen", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .last()
      .getByRole("button", { name: "Abbrechen" })
      .click();
    assert.equal(
      await dialog.getByLabel("Geburtsort").inputValue(),
      "Neuer Ort",
    );
    await dialog.getByRole("button", { name: "Änderungen speichern" }).click();
    await page.waitForFunction(() => !document.querySelector("dialog"));
    await page.locator(".branch-add").last().click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: "Keine Kinder · Linie abschließen" })
      .click();
    await page.locator(".branch-end").waitFor();
    await page.locator(".branch-end").click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: "Kind hinzufügen", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name", { exact: true }).fill("Juni Test");
    await dialog.getByLabel("Geburtsdatum", { exact: true }).fill("2020-01-01");
    await dialog.getByLabel("Geschlecht").selectOption("female");
    await dialog.getByRole("button", { name: "Änderungen speichern" }).click();
    await page.waitForFunction(() => !document.querySelector("dialog"));
    assert.equal(await page.locator(".person").count(), 14);
    assert.equal(await page.locator(".branch-end").count(), 0);
    await page.locator('[data-person="9"]').dblclick();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Bearbeiten" }).click();
    await dialog
      .locator("input[type=file]")
      .setInputFiles("src-tauri/icons/128x128.png");
    await page.waitForFunction(() =>
      document.querySelector(".profile-heading img"),
    );
    await dialog.getByLabel("Darstellung").selectOption("dimmed");
    await dialog.getByRole("button", { name: "Änderungen speichern" }).click();
    await page.waitForFunction(() => !document.querySelector("dialog"));
    await page.reload();
    await page.waitForTimeout(800);
    assert.equal(await page.locator('[data-person="9"] img').count(), 1);
    assert(
      (await page.locator('[data-person="9"]').getAttribute("class")).includes(
        "dimmed",
      ),
    );
    for (const name of ["Klassisch", "Horizontal", "Wandteppich"])
      await page.getByRole("button", { name, exact: true }).click();
    await page.waitForTimeout(450);
    fs.mkdirSync("docs", { recursive: true });
    await page.screenshot({ path: "docs/desktop-preview.png" });
    await page.getByRole("button", { name: "Sicherungsverlauf" }).click();
    await page.locator(".history-list button").first().waitFor();
    assert((await page.locator(".history-list button").count()) >= 6);
    await page.getByRole("button", { name: "Schließen", exact: true }).click();
    const fresh = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const preview = await fresh.newPage();
    await preview.goto("http://127.0.0.1:1420");
    await preview.getByRole("button", { name: "Beispiel entdecken" }).click();
    await preview.locator(".person").first().waitFor();
    await preview.waitForTimeout(4600);
    await preview.screenshot({ path: "docs/desktop-preview.png" });
    await fresh.close();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: photo reload, childless closure and child addition, 11 initial members, exact centering, per-person ancestor context menu on/off and parent save, separation and new partner, undo/redo, reload persistence, unsaved cancel, profile save, all layouts, revision history. No browser errors.",
    );
  } catch (e) {
    const page = browser?.contexts()[0]?.pages()[0];
    if (page) {
      await page.screenshot({ path: "docs/browser-failure.png" });
      console.error(await page.locator("dialog").allTextContents());
    }
    throw e;
  } finally {
    await browser?.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
