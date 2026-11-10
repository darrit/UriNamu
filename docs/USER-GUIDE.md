# Using UriNamu

This guide uses the English control names. Choose German, English, Japanese or Korean when prompted on first launch, or change the language in **Settings** once a tree is open.

## Identify the installed build

The version badge beside **UriNamu** shows the current app version. Click it on the welcome screen or with a tree open to see **Version & build**, including the build time and whether you are using the desktop app or browser preview. To update an installed copy, install a newer package.

## Start a family tree

Choose **Start your own family** or **Explore the example**. Demo people are fictional. Use **Settings** to rename the tree, to choose whether removing a parent asks about the descendant tree, and to show or hide the partner placeholder. **My family trees** lets you create, switch, and delete independent trees. The trash icon removes a tree and its history. Each tree keeps its own history. Imported files become additional trees; existing trees remain available.

**Guide** in the sidebar walks through the controls. Each explanation that needs a picture shows that window or button. The first hints can be skipped and stay quiet afterwards.

## People, names and dates

Choose **Add member** to create a person. Enter the given name, the surname, and optionally the birth name. A nonempty birth name is displayed between the other names: `Testae Testbt (Testfamilieh) Testfamiliec`. Leaving it empty shows `Testae Testbt Testfamiliec` without parentheses. Older profiles remain readable; their existing names are used to initialize the new fields. When editing an older compound surname, check the given-name/surname split before saving.

For birth, death and wedding dates, choose **Full date**, **Year only** or **unknown** in the date field when available. Type a full date in the order shown in the field's example (German `DD.MM.YYYY`, English `DD/MM/YYYY`, Japanese `YYYY/MM/DD`, Korean `YYYY.MM.DD`) or use the calendar button. Choose **Year only** to enter four digits, such as `1985`. Dates display at the precision you entered. The examples in the fields are placeholders.

Double-click a card to open the profile. In read-only mode the fields show stored values only: examples, the calendar button and the hidden date picker stay hidden. Clicking the dimmed area outside the profile closes it, including while **Edit** is open. If something was changed, **Discard changes?** offers **Discard** to close and **Go back** to keep editing. **Save changes** applies the changes.

## Choose and crop a portrait

1. Choose **Choose photo** and select a JPG, PNG, WebP or AVIF file up to 50 MB.
2. The **Crop photo** dialog opens. Drag the image freely in both directions, including beyond the crop boundary. Use the mouse wheel or zoom slider (10–800%) to zoom out or in. Horizontal and vertical sliders also support precise or keyboard positioning. **Reset** restores the centered initial crop. The dashed frame is the portrait: that framing is stored, and uncovered areas remain transparent.
3. The rounded guide previews the portrait area. Choose **Use this crop** to accept, or **Cancel** to leave the previous photo unchanged.
4. Save the person to persist the new portrait.

The selected portrait-shaped crop is stored at up to 1024 pixels on its long edge without enlarging smaller source regions. The card shows that frame without cropping it again. The original file is unchanged. Removing a photo also takes effect only after saving. The tapestry view uses the same rounded frame.

## Divorce, new partners and children from multiple relationships

Recording divorce keeps both people in their existing positions and marks their relationship line. Adding a new partner places the new person on the nearest free side (right/left; above/below in the horizontal view), without rearranging existing people. Placement accounts for the full cards and tapestry name ribbons. A partner placeholder is portrait-sized and sits directly beside the person; neighbouring people shift just enough to open that place.

Each relationship keeps its own child branch, including after divorce and when either person has another partner. Use **Add a child with …** from the person's context menu to add a child to a specific parent pair. Drag people to arrange complex families. Their connections follow as you move them.

For some people with multiple partnerships and a divorce, **More partners** expands the list of additional partners on the tree. This changes the view temporarily. Their profiles and relationships stay saved when the list is collapsed.

## Record a death from the context menu

Right-click a person's card and choose **Mark as deceased**. Enter a full date or year and choose **Save date of death**, or choose **Date unknown** to mark the person as deceased without a date. Confirm the change when prompted. The confirmation also applies when editing the date in the full profile.

Portrait views dim the photo or initials for a deceased person and display a dagger with the recorded date, year or **unknown**. The **Chart** view uses `+` for the death entry.

Right-click again and choose **Change date of death** to correct the date. In that dialog, **Remove date of death** clears both the date and the deceased marking. These changes use the normal undo and backup history.

## Partnerships, divorce and children

A person without an active partner has a portrait-sized **Add partner** place directly on their left or right. If someone already stands there, the tree opens a gap so the place stays beside the person. Hide these places under **Settings**. You can also right-click their card and choose **Add a new partner**, or select an existing person as the current partner in the profile. Each person can have one active partnership; earlier partnerships are retained.

To record divorce, open the relationship controls in the profile or right-click the person and select **Record a divorce**, then confirm. Both people and their shared connection remain visible, even without children. The connection receives a double slash and the relationship is stored as divorced. Right-click either former partner to add a new partner. Existing children keep their original parents.

An active partnership can be married or unmarried. Use **Marital status** in the profile to record the actual status. To end an active unmarried partnership, choose **Record separation** from the context menu. Former partners keep their connection and any shared children.

For a married or divorced couple, you can enter a **Wedding date** in the marital status dialog. The date or year appears beside the couple.

The **+** beside a married couple appears when they have no shared children and the prompt is still open. It offers three choices.

- **Add child** creates a child with both parents prefilled.
- **No children · close the line** marks the relationship as childless.
- **No answer** hides the prompt without marking the relationship as childless.

Click the **No children** badge to reopen the branch or add a child. Adding a shared child clears the marker. In the context menu, **Add child** adds a child of the selected person alone, and **Add a child with …** adds a child of the named pair, including former partners.

## Add ancestors later

Right-click a person and choose **Add ancestors**. The view centers on that person without moving people who are already placed. An **Add ancestor** slot appears only for that person, not automatically for their partner. The slot sits above them, or beside an ancestor they already have, and moves to the nearest free place instead of covering a card. Saving records that parent-child link; no gender is guessed.

If the first parent has no active partner, their **Add partner** slot still enters the second parent. If that parent already has a partner, the new ancestor gets its own free slot. While ancestor-entry mode is active, a free partner slot of the known parent preselects that parent and also links the new person to the original child. Once both parents are saved, the extra slots disappear.

Choose **Stop adding** to hide empty slots. When both parents exist, the menu shows **Parents already complete**. On a focused card, open the context menu with the Context Menu key or Shift+F10. Use the arrow keys to move between actions and Escape to close it.

## Remove a person from the context menu

Right-click a card and choose **Remove person**, or select **Remove** in the profile. If the person has descendants and the question is enabled, the dialog asks which people to remove. **Don't ask this again** remembers your choice. Turn the question back on under **Settings**. When the choice is skipped, the app asks you to confirm the removal.

**Only this person** removes their direct links and keeps the other people. **Remove the whole tree** in this dialog removes the selected person and their descendants. **Undo** restores the people and links removed by that action.

## Move around the tree

- Drag a person to reposition that person. Connections and child branches follow while dragging; the viewport stays still. Dropping onto another person uses a nearby free position. Positions are saved separately for each view and support undo/redo, reload, backups and encrypted exchange.
- Click a person, or press Space on their card: pan the canvas to center that person. Card positions, relationship paths and zoom stay unchanged.
- Double-click a card, or press Enter: open the profile.
- **Fit all** or the fit icon: fit the complete tree into the viewport.
- Drag empty canvas space: pan.
- Mouse wheel: zoom around the mouse pointer without moving the point beneath it. Zoom buttons use the viewport center. Zoom does not change card positions or relationship paths.

Switch between **Classic**, **Horizontal**, **Tapestry** and **Chart**. The **Chart** view uses text cards in place of portraits. Select **Tidy**, the inward-arrow icon beside **Fit all**, to arrange the current view by generation. Other views keep their own saved positions. Drag a partnership line to move both people together. Use **Collapse** or **Expand** in the bar above the tree to hide or show the title, view buttons and search.

Search filters visible cards without deleting data and includes birth names.

To mark a line of descendants, right-click the first person in that line and choose **Dynasty from …**. Give it a name and optionally add an image or coat of arms. A partner can join the dynasty from their own context menu.

## Merge two trees into a new tree

1. Add/import both source trees. Mark the common couple as married or divorced in both trees using **Marital status: …**; active/separated status alone is insufficient evidence of marriage.
2. Choose **Merge**. Load another stored tree or import an encrypted file in the desktop app.
3. Select the common couple in each tree. People with the same name are paired even when the couple is stored in the opposite order. If the names do not decide the pairing, swap the two people.
4. Name the result and confirm the couple's resulting marital status.
5. Empty profile fields are filled from whichever tree has them. When both trees have different values, choose a side for each field.
6. People who share a name and the same partner, parents or child are matched. Other duplicates can be matched under **Further duplicate people and conflicts**. Parents and children already present stay, and those from the second tree are attached to the matched person. Choose a parent or relationship source only when the two records cannot be combined.
7. Review the preview, confirm identity matches and choose **Create as a new family tree**.

The result is a third tree. Both originals and their histories remain unchanged. Cancelling or failing validation creates no result tree. Cycle checks, parent limits and conflicting active relationships prevent invalid saves.

## Undo, backups and encrypted exchange

Undo/redo retains up to 30 changes during a session. **Backup history** provides the latest 100 saved states. Restoring a state requires confirmation and creates another revision. These local backups do not protect against loss of the whole device.

Choose **Export → As PDF** to save a picture of the open tree, in the desktop app or browser preview. By default the PDF also embeds unencrypted family data, including names, dates and notes. Clear **Include names, dates and notes for reading back, without photos** if you only want the rendered tree. Portraits visible in the tree can still appear on the PDF pages.

In the desktop app, choose **Export → As a UriNamu file** for an encrypted copy that includes people, photos and relationships. Use a unique password of at least ten characters and share it separately from the file. To open a `.urinamu` or older `.wurzeln` file, choose **Import → As a UriNamu file** and enter the password. The imported family is saved as a new tree.

On Windows, choose a new export filename if a file already exists. The local working database and backups are not additionally encrypted. Back up the entire application data directory while the app is closed before manual recovery or migration.

For setup and installer builds, see [the developer guide](DEVELOPMENT.md). The browser preview has separate IndexedDB data and does not provide native dialogs or encrypted exchange; it is not the desktop application.
