const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
process.chdir(require("node:path").resolve(__dirname, ".."));
fs.mkdirSync(".setup/qa", { recursive: true });
if (!fs.existsSync("dist/index.html"))
  throw Error("Run npm run build before this QA script.");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.route("http://localhost:1421/**", async (route) => {
    const url = new URL(route.request().url());
    const name = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const path = require("node:path").resolve("dist", name);
    if (
      !path.startsWith(
        require("node:path").resolve("dist") + require("node:path").sep,
      )
    ) {
      await route.abort();
      return;
    }
    const type = name.endsWith(".js")
      ? "application/javascript"
      : name.endsWith(".css")
        ? "text/css"
        : name.endsWith(".svg")
          ? "image/svg+xml"
          : "text/html";
    try {
      await route.fulfill({
        body: require("node:fs").readFileSync(path),
        contentType: type,
      });
    } catch {
      await route.fulfill({ status: 404, body: "" });
    }
  });
  page.setDefaultTimeout(7000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const confirmation = () =>
    page.getByRole("dialog").filter({
      has: page.getByRole("heading", {
        name: "Bitte bestätigen",
        exact: true,
      }),
    });
  try {
    await page.goto("http://localhost:1421/", { timeout: 10000 });
    console.log("Loaded isolated built preview");
    const appVersion = JSON.parse(
      fs.readFileSync("package.json", "utf8"),
    ).version;
    const versionButton = page.getByRole("button", {
      name: "Build-Informationen anzeigen",
      exact: true,
    });
    assert.equal(await versionButton.innerText(), `v${appVersion}`);
    await versionButton.click();
    const versionDialog = page.getByRole("dialog");
    assert.equal(
      await versionDialog.getByText(appVersion, { exact: true }).count(),
      1,
    );
    const buildTime = await versionDialog
      .locator("time")
      .getAttribute("datetime");
    assert(
      Number.isFinite(Date.parse(buildTime)),
      "Build timestamp is missing or invalid",
    );
    await versionDialog
      .getByRole("button", { name: "Schließen", exact: true })
      .click();
    await versionDialog.waitFor({ state: "detached" });
    await page.setViewportSize({ width: 375, height: 800 });
    const badge = await versionButton.boundingBox();
    assert(
      badge && badge.x >= 0 && badge.x + badge.width <= 375,
      "Version badge is outside the mobile viewport",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "Beispiel entdecken" }).click();

    await page.locator(".person").first().waitFor();
    const paths = await page
      .locator(".edges path")
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("d")));
    const positions = await page
      .locator(".person")
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("style")));
    // Test an off-center world point after every wheel frame, including a round trip.
    const area = await page.locator(".canvas").boundingBox();
    const anchor = {
      x: Math.round(area.x + area.width * 0.68),
      y: Math.round(area.y + area.height * 0.42),
    };
    const worldState = () =>
      page.locator(".world").evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, k: Number(el.style.zoom) };
      });
    const beforeZoom = await worldState();
    const point = {
      x: (anchor.x - beforeZoom.x) / beforeZoom.k,
      y: (anchor.y - beforeZoom.y) / beforeZoom.k,
    };
    await page.mouse.move(anchor.x, anchor.y);
    for (const delta of [-100, -60, 60, 100]) {
      const previous = await worldState();
      await page.mouse.wheel(0, delta);
      await page.waitForFunction(
        (k) => Number(document.querySelector(".world").style.zoom) !== k,
        previous.k,
      );
      const current = await worldState();
      assert(
        Math.abs(current.x + point.x * current.k - anchor.x) < 0.2,
        "Wheel zoom shifted the mouse anchor horizontally: " +
          JSON.stringify({ current, beforeZoom, point, anchor, area }),
      );
      assert(
        Math.abs(current.y + point.y * current.k - anchor.y) < 0.2,
        "Wheel zoom shifted the mouse anchor vertically",
      );
    }
    const afterZoom = await worldState();
    assert(
      Math.abs(afterZoom.k - beforeZoom.k) < 0.00001,
      "Wheel round trip changed scale",
    );
    assert(
      Math.abs(afterZoom.x - beforeZoom.x) < 0.2 &&
        Math.abs(afterZoom.y - beforeZoom.y) < 0.2,
      "Wheel round trip moved the canvas",
    );
    assert.deepEqual(
      await page
        .locator(".person")
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("style"))),
      positions,
    );
    assert.deepEqual(
      await page
        .locator(".edges path")
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("d"))),
      paths,
    );
    console.log("Mouse-anchored wheel zoom passed without geometry changes");
    await page.locator('[data-person="7"]').click();
    await page.waitForTimeout(600);
    assert.deepEqual(
      await page
        .locator(".edges path")
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("d"))),
      paths,
    );
    assert.deepEqual(
      await page
        .locator(".person")
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("style"))),
      positions,
    );
    const p = await page.locator('[data-person="7"]').boundingBox(),
      canvas = await page.locator(".canvas").boundingBox();
    assert(
      Math.abs(p.x + p.width / 2 - canvas.x - canvas.width / 2) < 2,
      "Selected card is not horizontally centered: " +
        JSON.stringify({ p, canvas }),
    );
    assert(
      Math.abs(p.y + p.height / 2 - canvas.y - canvas.height / 2) < 2,
      "Selected card is not vertically centered",
    );
    await page
      .getByRole("button", { name: "Verkleinern", exact: true })
      .click();
    const zoom = await page.locator(".zoom output").innerText();
    await page.locator('[data-person="9"]').click();
    await page.waitForTimeout(550);
    assert.equal(await page.locator(".zoom output").innerText(), zoom);
    assert.equal(
      await page
        .locator(".world")
        .evaluate((n) => getComputedStyle(n).transform),
      "none",
    );
    for (const mode of ["Klassisch", "Horizontal", "Wandteppich"]) {
      await page.getByRole("button", { name: mode, exact: true }).click();
      const edges = await page
        .locator(".edges path")
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("d")));
      const fixed = await page
        .locator(".person")
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("style")));
      await page.locator('[data-person="7"]').click();
      await page.waitForTimeout(500);
      assert.deepEqual(
        await page
          .locator(".edges path")
          .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("d"))),
        edges,
      );
      assert.deepEqual(
        await page
          .locator(".person")
          .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("style"))),
        fixed,
      );
    }
    await page
      .getByRole("button", { name: "Mitglied hinzufügen", exact: true })
      .click();
    let dialog = page.getByRole("dialog");
    assert.equal(
      await dialog.getByLabel("Geburtsdatum", { exact: true }).inputValue(),
      "",
    );
    assert.match(
      await dialog
        .getByLabel("Geburtsdatum", { exact: true })
        .getAttribute("placeholder"),
      /14\.03\.1985/,
    );
    await dialog.getByLabel("Vorname", { exact: true }).fill("Anna Maria");
    await dialog.getByLabel("Nachname", { exact: true }).fill("von Berg");
    await dialog
      .getByLabel("Geburtsname (optional)", { exact: true })
      .fill("Müller");
    const calendar = dialog.getByLabel("Geburtsdatum im Kalender auswählen", {
      exact: true,
    });
    assert.equal(await calendar.getAttribute("type"), "date");
    await calendar.evaluate((el) => {
      const original = el.showPicker.bind(el);
      el.showPicker = () => {
        el.dataset.opened = "true";
        original();
      };
    });
    await dialog
      .getByRole("button", {
        name: "Geburtsdatum: Kalender öffnen",
        exact: true,
      })
      .click();
    assert.equal(await calendar.getAttribute("data-opened"), "true");
    await page.keyboard.press("Escape");
    await calendar.fill("1985-03-14");
    assert.equal(
      await dialog.getByLabel("Geburtsdatum", { exact: true }).inputValue(),
      "14.03.1985",
    );
    await dialog.getByLabel("Geburtsdatum", { exact: true }).fill("14.03.1985");
    await dialog.getByLabel("Geschlecht").selectOption("female");
    const png = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 1200;
      c.height = 800;
      const x = c.getContext("2d");
      x.fillStyle = "#ff0000";
      x.fillRect(0, 0, 600, 800);
      x.fillStyle = "#00ff00";
      x.fillRect(600, 0, 600, 800);
      return c.toDataURL("image/png").split(",")[1];
    });
    await dialog.locator("input[type=file]").setInputFiles({
      name: "crop-test.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
    const crop = page.getByRole("dialog", { name: "Foto zuschneiden" });
    await crop.locator("img").evaluate((img) => img.decode());
    const preview = crop.locator(".crop-preview");
    const box = await preview.boundingBox();
    const imageBefore = await crop.locator("img").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 400,
      box.y + box.height / 2 + 370,
      { steps: 8 },
    );
    await page.mouse.up();
    const imageAfter = await crop.locator("img").boundingBox();
    assert(
      Math.abs(imageAfter.x - imageBefore.x - 400) < 1,
      "Horizontal crop drag was clamped",
    );
    assert(
      Math.abs(imageAfter.y - imageBefore.y - 370) < 1,
      "Vertical crop drag was clamped",
    );
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 160);
    await page.waitForFunction(
      () =>
        Number(
          document.querySelector(
            '[aria-label="Vergrößerung des Fotoausschnitts"]',
          ).value,
        ) < 1,
    );
    await crop
      .getByRole("button", { name: "Zurücksetzen", exact: true })
      .click();
    await crop
      .getByRole("slider", { name: "Vergrößerung des Fotoausschnitts" })
      .fill("0.5");
    await crop.getByRole("button", { name: "Ausschnitt übernehmen" }).click();
    await crop.waitFor({ state: "detached" });
    const alpha = await dialog
      .locator(".portrait img")
      .evaluate(async (img) => {
        await img.decode();
        const c = document.createElement("canvas");
        c.width = c.height = 100;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, 100, 100);
        return [
          ctx.getImageData(0, 0, 1, 1).data[3],
          ctx.getImageData(50, 50, 1, 1).data[3],
        ];
      });
    assert.deepEqual(
      alpha,
      [0, 255],
      "Export must preserve transparent margins and the visible image",
    );
    await dialog.locator("input[type=file]").setInputFiles({
      name: "crop-test.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
    await crop.locator("img").evaluate((img) => img.decode());
    console.log(
      "Free crop drag, wheel zoom, zoom-out and transparent export passed",
    );

    await crop
      .getByRole("slider", { name: "Vergrößerung des Fotoausschnitts" })
      .fill("2");
    await crop
      .getByRole("slider", { name: "Horizontaler Ausschnitt" })
      .fill("0.75");
    await crop.getByRole("button", { name: "Ausschnitt übernehmen" }).click();
    await crop.waitFor({ state: "detached" });
    await dialog.getByRole("button", { name: "Änderungen speichern" }).click();
    await dialog.waitFor({ state: "detached" });
    const card = page
      .locator(".person")
      .filter({ hasText: "Anna Maria (Müller) von Berg" });
    assert.equal(await card.count(), 1);
    assert.match(await card.textContent(), /14\.03\.1985/, "The card must display the full birth date");
    const rgb = await card.locator("img").evaluate(async (img) => {
      await img.decode();
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      c.getContext("2d").drawImage(img, 0, 0, 1, 1);
      return [...c.getContext("2d").getImageData(0, 0, 1, 1).data];
    });
    assert(
      rgb[1] > 200 && rgb[0] < 30,
      "Crop did not use the selected right side: " + rgb,
    );
    await page.reload();
    await card.waitFor();
    const retainedPositions = () =>
      page
        .locator(".person")
        .evaluateAll((nodes) =>
          Object.fromEntries(
            nodes.map((n) => [n.dataset.person, n.getAttribute("style")]),
          ),
        );
    const beforeDivorce = await retainedPositions();
    const beforeDivorceView = await page
      .locator(".world")
      .getAttribute("style");
    await page.locator('[data-person="7"]').click({ button: "right" });
    await page.getByRole("menuitem", { name: "Scheidung eintragen" }).click();
    await page.getByRole("button", { name: "Bestätigen", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector("dialog"));
    await page.locator(".separated").waitFor({ state: "attached" });
    assert.equal(await page.locator(".separated").count(), 1);
    assert.deepEqual(
      await retainedPositions(),
      beforeDivorce,
      "Divorce rearranged existing people",
    );
    assert.equal(
      await page.locator(".world").getAttribute("style"),
      beforeDivorceView,
      "Divorce moved the viewport",
    );
    await page.locator('[data-person="7"]').click({ button: "right" });
    await page
      .getByRole("menuitem", { name: "Neuen Partner hinzufügen", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Vorname", { exact: true }).fill("Alex");
    await dialog.getByLabel("Nachname", { exact: true }).fill("Neu");
    await dialog.getByRole("button", { name: "Änderungen speichern" }).click();
    await dialog.waitFor({ state: "detached" });
    const afterPartnerPositions = await retainedPositions();
    for (const [id, style] of Object.entries(beforeDivorce))
      assert.equal(
        afterPartnerPositions[id],
        style,
        "Adding a partner moved an existing person",
      );

    assert.equal(await page.locator(".separated").count(), 1);
    // Center the childless badge on the actual SVG branch in every orientation.
    const alexId = await page
      .locator(".person")
      .filter({ hasText: "Alex Neu" })
      .getAttribute("data-person");
    const unionId = ["7", alexId].sort().join("|");
    await page.locator(`[data-union="${unionId}"]`).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Keine Kinder · Linie abschließen" })
      .click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    for (const mode of ["Klassisch", "Horizontal", "Wandteppich"]) {
      await page.getByRole("button", { name: mode, exact: true }).click();
      const delta = await page
        .locator(`[data-union="${unionId}"]`)
        .evaluate((button, id) => {
          const path = document.querySelector(
            `[data-relationship="${id}"] > path.child`,
          );
          const point = path.getPointAtLength(path.getTotalLength() / 2);
          const target = new DOMPoint(point.x, point.y).matrixTransform(
            path.getScreenCTM(),
          );
          const rect = button.getBoundingClientRect();
          return {
            x: Math.abs(rect.x + rect.width / 2 - target.x),
            y: Math.abs(rect.y + rect.height / 2 - target.y),
          };
        }, unionId);
      assert(
        delta.x < 1 && delta.y < 1,
        `Childless badge is off-center in ${mode}: ${JSON.stringify(delta)}`,
      );
    }
    // Record/correct death through the context menu, preserving the stored photo.
    await card.click({ button: "right" });
    await page
      .getByRole("menuitem", { name: "Als verstorben markieren", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Sterbedatum", { exact: true }).fill("01.01.1800");
    await dialog
      .getByRole("button", { name: "Sterbedatum speichern", exact: true })
      .click();
    await dialog.getByRole("alert").waitFor();
    assert.equal(await confirmation().count(), 0);
    await dialog.getByLabel("Sterbedatum", { exact: true }).fill("15.07.2020");
    await dialog
      .getByRole("button", { name: "Sterbedatum speichern", exact: true })
      .click();
    await confirmation().waitFor();
    assert.match(
      await confirmation().innerText(),
      /Als verstorben markieren.*Anna Maria/s,
    );
    await confirmation()
      .getByRole("button", { name: "Abbrechen", exact: true })
      .click();
    await confirmation().waitFor({ state: "detached" });
    assert.equal(await card.locator(".portrait-cross").count(), 0);
    await dialog
      .getByRole("button", { name: "Sterbedatum speichern", exact: true })
      .click();
    await confirmation()
      .getByRole("button", { name: "Bestätigen", exact: true })
      .click();
    await dialog.waitFor({ state: "detached" });
    assert.equal(await card.locator(".portrait-cross").count(), 0);
    assert.match(await card.textContent(), /† 15\.07\.2020/);
    const deceased = await card.locator(".portrait").evaluate((el) => {
      const style = getComputedStyle(el);
      return { filter: style.filter, opacity: style.opacity };
    });
    assert.match(deceased.filter, /grayscale/);
    assert.equal(deceased.opacity, "0.5");
    const storedPhoto = await card.locator("img").getAttribute("src");
    await page.reload();
    await card.waitFor();
    assert.equal(await card.locator(".portrait-cross").count(), 0);
    assert.equal(await card.locator("img").getAttribute("src"), storedPhoto);
    await card.click({ button: "right" });
    await page
      .getByRole("menuitem", { name: "Sterbedatum ändern", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    assert.equal(
      await dialog.getByLabel("Sterbedatum", { exact: true }).inputValue(),
      "15.07.2020",
    );
    await dialog
      .getByRole("button", { name: "Sterbedatum entfernen", exact: true })
      .click();
    await confirmation()
      .getByRole("button", { name: "Bestätigen", exact: true })
      .click();
    await dialog.waitFor({ state: "detached" });
    assert.equal(await card.locator(".portrait-cross").count(), 0);

    // One ancestor entry, followed by one partner slot that completes this child's parents.
    const childId = await card.getAttribute("data-person");
    await card.click({ button: "right" });
    await page
      .getByRole("menuitem", { name: "Vorfahren ergänzen", exact: true })
      .click();
    for (const mode of ["Klassisch", "Horizontal", "Wandteppich"]) {
      await page.getByRole("button", { name: mode, exact: true }).click();
      assert.equal(await page.locator(".ancestor-slot").count(), 1);
    }
    await page.locator(".ancestor-slot").click();
    dialog = page.getByRole("dialog");
    assert.equal(await dialog.getByLabel("Geschlecht").inputValue(), "");
    await dialog.getByLabel("Vorname", { exact: true }).fill("Marion");
    await dialog.getByLabel("Nachname", { exact: true }).fill("Berg");
    await dialog.getByLabel("Geschlecht").selectOption("female");
    await dialog
      .getByRole("button", { name: "Änderungen speichern", exact: true })
      .click();
    await dialog.waitFor({ state: "detached" });
    const marion = page.locator(".person").filter({ hasText: "Marion Berg" });
    await marion.waitFor();
    const marionId = await marion.getAttribute("data-person");
    assert.equal(await page.locator(".ancestor-slot").count(), 0);
    await marion.click(); // Centering the ancestor must not lose the child association.
    await page.waitForTimeout(500);
    const partnerSlot = page.locator(`[data-partner-for="${marionId}"]`);
    assert.equal(await partnerSlot.count(), 1);
    assert.equal(await partnerSlot.getAttribute("data-ancestor-for"), childId);
    await partnerSlot.click();
    dialog = page.getByRole("dialog");
    assert.equal(
      await dialog
        .getByLabel("Aktueller Partner / aktuelle Partnerin")
        .inputValue(),
      marionId,
    );
    await dialog.getByLabel("Vorname", { exact: true }).fill("Paul");
    await dialog.getByLabel("Nachname", { exact: true }).fill("Berg");
    await dialog.getByLabel("Geschlecht").selectOption("male");
    await dialog
      .getByRole("button", { name: "Änderungen speichern", exact: true })
      .click();
    await dialog.waitFor({ state: "detached" });
    const paul = page.locator(".person").filter({ hasText: "Paul Berg" });
    const paulId = await paul.getAttribute("data-person");
    assert.equal(
      await page.locator(`[data-partner-for="${marionId}"]`).count(),
      0,
    );
    assert.equal(await page.locator(".ancestor-slot").count(), 0);
    await card.dblclick();
    dialog = page.getByRole("dialog");
    assert.equal(
      await dialog.getByLabel("Elternteil 1").inputValue(),
      marionId,
    );
    assert.equal(await dialog.getByLabel("Elternteil 2").inputValue(), paulId);
    await dialog
      .getByRole("button", { name: "Schließen", exact: true })
      .click();
    await dialog.waitFor({ state: "detached" });

    // Context-menu removal is inert until explicitly confirmed, and supports undo.
    await marion.click({ button: "right" });
    await page
      .getByRole("menuitem", { name: "Person entfernen", exact: true })
      .click();
    assert.match(
      await confirmation().innerText(),
      /Person entfernen.*Marion Berg/s,
    );
    await confirmation()
      .getByRole("button", { name: "Abbrechen", exact: true })
      .click();
    await confirmation().waitFor({ state: "detached" });
    assert.equal(await marion.count(), 1);
    await marion.click({ button: "right" });
    await page
      .getByRole("menuitem", { name: "Person entfernen", exact: true })
      .click();
    await confirmation()
      .getByRole("button", { name: "Bestätigen", exact: true })
      .click();
    await marion.waitFor({ state: "detached" });
    assert.equal(await paul.count(), 1);
    assert.equal(await card.count(), 1);
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    await marion.waitFor();
    await page
      .getByRole("button", { name: "Wandteppich", exact: true })
      .click();
    await page.screenshot({ path: ".setup/qa/profile-canvas.png" });
    // Separate synthetic multi-divorce fixture in this disposable browser context.
    const fixture = {
      version: 2,
      name: "Multiple partnerships",
      members: ["a", "b", "c", "d", "child1", "child2", "child3"].map(
        (id, index) => ({
          id,
          name: id,
          born: "",
          died: "",
          place: "",
          bio: "",
          gender: "",
          appearance: "normal",
          photo: "",
          parents: index < 4 ? [] : ["a", ["b", "c", "d"][index - 4]],
        }),
      ),
      unions: ["b", "c", "d"].map((b) => ({
        id: `a|${b}`,
        a: "a",
        b,
        status: b === "d" ? "active" : "separated",
        ended: false,
      })),
    };
    await page.evaluate(async (family) => {
      const db = await new Promise((resolve, reject) => {
        const r = indexedDB.open("urinamu-preview", 2);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction("state", "readwrite");
        tx.objectStore("state").put(family, "family");
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    }, fixture);
    await page.reload();
    await page.locator('[data-person="a"]').waitFor();
    for (const mode of ["Klassisch", "Horizontal", "Wandteppich"]) {
      await page.getByRole("button", { name: mode, exact: true }).click();
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      assert.equal(await page.locator(".edges .separated").count(), 2);
      for (const mate of ["b", "c", "d"])
        assert.equal(
          await page.locator(`[data-relationship="a|${mate}"] .child`).count(),
          2,
          "A union lost its child branch",
        );
      const before = await retainedPositions();
      const worldBefore = await page.locator(".world").getAttribute("style");
      const edgesBefore = await page.locator(".edges").innerHTML();
      const movedCard = page.locator('[data-person="a"]');
      const box = await movedCard.boundingBox();
      const k = await page
        .locator(".world")
        .evaluate((el) => Number(el.style.zoom));
      await page.mouse.move(box.x + box.width / 2, box.y + 20 * k);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 - 90, box.y + 20 * k - 80, {
        steps: 7,
      });
      assert.notEqual(
        await page.locator(".edges").innerHTML(),
        edgesBefore,
        "Edges did not follow during dragging: " +
          JSON.stringify({
            mode,
            box,
            k,
            hit: await page.evaluate(
              ({ x, y }) =>
                document.elementFromPoint(x, y)?.outerHTML.slice(0, 250),
              { x: box.x + box.width / 2, y: box.y + 20 * k },
            ),
          }),
      );
      await page.mouse.up();
      await page.waitForFunction(() =>
        document.body.innerText.includes("Gespeichert · Person verschoben"),
      );
      await page.waitForTimeout(300); // Verify that the drag click does not recenter the viewport.
      const after = await retainedPositions();
      assert.notEqual(after.a, before.a);
      for (const [id, style] of Object.entries(before))
        if (id !== "a")
          assert.equal(after[id], style, "Dragging moved another person");
      assert.equal(
        await page.locator(".world").getAttribute("style"),
        worldBefore,
        "Dragging moved the viewport: " + mode,
      );
      await page.reload();
      await page.getByRole("button", { name: mode, exact: true }).click();
      assert.deepEqual(
        await retainedPositions(),
        after,
        "Saved person positions were lost on reload",
      );
      const rects = await page
        .locator(".person,.partner-slot")
        .evaluateAll((nodes) =>
          nodes.map((n) => ({
            x: parseFloat(n.style.left),
            y: parseFloat(n.style.top),
          })),
        );
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++)
          assert(
            Math.abs(rects[i].x - rects[j].x) >=
              (mode === "Wandteppich" ? 240 : 210) ||
              Math.abs(rects[i].y - rects[j].y) >= 150,
            "Cards or partner placeholders overlap",
          );
    }
    // Dropping on an occupied card resolves to free space and is one undo step.
    const beforeCollision = await retainedPositions();
    const sourceBox = await page.locator('[data-person="b"]').boundingBox();
    const targetBox = await page.locator('[data-person="c"]').boundingBox();
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 3,
    );
    await page.mouse.down();
    await page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 3,
      { steps: 6 },
    );
    await page.mouse.up();
    await page.waitForFunction(() =>
      document.body.innerText.includes("Gespeichert · Person verschoben"),
    );
    const afterCollision = await retainedPositions();
    assert.notEqual(afterCollision.b, beforeCollision.b);
    for (const [id, style] of Object.entries(beforeCollision))
      if (id !== "b") assert.equal(afterCollision[id], style);
    const points = await page
      .locator(".person")
      .evaluateAll((nodes) =>
        nodes.map((n) => ({
          x: parseFloat(n.style.left),
          y: parseFloat(n.style.top),
        })),
      );
    for (let i = 0; i < points.length; i++)
      for (let j = i + 1; j < points.length; j++)
        assert(
          Math.abs(points[i].x - points[j].x) >= 240 ||
            Math.abs(points[i].y - points[j].y) >= 150,
          "Collision drop overlaps a person",
        );
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    await page.waitForTimeout(200);
    assert.deepEqual(
      await retainedPositions(),
      beforeCollision,
      "Drag undo did not restore positions",
    );
    await page
      .getByRole("button", { name: "Alles einpassen", exact: true })
      .click();
    await page.screenshot({ path: ".setup/qa/multiple-partnerships.png" });
    console.log(
      "PASS: divorce/new partner retain positions; three unions keep separate children; drag updates edges without panning; saved positions and collision checks pass in all views.",
    );

    assert.deepEqual(errors, []);
    console.log(
      "PASS: profiles/crops/layouts, centered childless labels, death confirmation/cancellation, single ancestor entry, partner completes parents, confirmed context removal and undo.",
    );
  } catch (error) {
    console.error("UI error:", error.message, errors);
    require("node:fs").writeFileSync(
      ".setup/qa/profile-canvas-dom.html",
      await page.content(),
    );
    throw error;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
