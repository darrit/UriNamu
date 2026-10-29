# Using UriNamu

The names below are the English names of the controls. The installed application still shows those controls in German.

## Identify the installed build

The version badge beside **UriNamu** shows the current app version, including on the welcome screen and smaller windows. Click it to open **Version & Build**, which shows the version, build time and desktop/browser mode. The sidebar and footer show the same version. Updating the source does not change an already installed application; install a newly built package to update that app.

## Start a family tree

Choose **Start your own family** or **Explore the example**. Demo people are fictional. Use **Settings** to rename the tree, to choose whether removing a parent asks about the descendant tree, and to show or hide the partner placeholder. **My family trees** lets you create, switch, and delete independent trees. The trash icon removes a tree and its history. Each tree keeps its own history. Imported files become additional trees; existing trees remain available.

**Guide** in the sidebar walks through the controls. Each explanation that needs a picture shows that window or button. The first hints can be skipped and stay quiet afterwards.

## People, names and dates

Choose **Add member** to create a person. Enter the given name, the surname, and optionally the birth name. A nonempty birth name is displayed between the other names: `Anna Maria (Miller) Berg`. Leaving it empty shows `Anna Maria Berg` without parentheses. Older profiles remain readable; their existing names are used to initialize the new fields. When editing an older compound surname, check the given-name/surname split before saving.

Birth and death dates can remain empty. The fields show examples such as **14.03.1985**, rather than a format mask. Examples are placeholders and are not stored as real dates. Enter dates as `DD.MM.YYYY` or use the calendar button beside each field; they are stored internally as ISO calendar dates. Person cards, member lists and tapestry ribbons show the full birth date as `DD.MM.YYYY`. On cards and ribbons, the dates sit directly below the name.

Double-click a card to open the profile. In read-only mode the fields show stored values only: examples, the calendar button and the hidden date picker stay hidden. Clicking the dimmed area outside the profile closes it, including while **Edit** is open. If something was changed, **Discard changes?** offers **Discard** to close and **Go back** to keep editing. **Save changes** applies the changes.

## Choose and crop a portrait

1. Choose **Choose photo** and select a JPG, PNG, WebP or AVIF file up to 50 MB.
2. The **Crop photo** dialog opens. Drag the image freely in both directions, including beyond the crop boundary. Use the mouse wheel or zoom slider (10–800%) to zoom out or in. Horizontal and vertical sliders also support precise or keyboard positioning. **Reset** restores the centered initial crop. The dashed frame is the portrait: that framing is stored, and uncovered areas remain transparent.
3. The rounded guide previews the portrait area. Choose **Use this crop** to accept, or **Cancel** to leave the previous photo unchanged.
4. Save the person to persist the new portrait.

The selected portrait-shaped crop is stored at up to 1024 pixels on its long edge without enlarging smaller source regions. The card shows that frame without cropping it again. The original file is unchanged. Removing a photo also takes effect only after saving. The tapestry view uses the same rounded frame.

## Divorce, new partners and children from multiple relationships

Recording divorce keeps both people in their existing positions and marks their relationship line. Adding a new partner places the new person on the nearest free side (right/left; above/below in the horizontal view), without rearranging existing people. Placement accounts for the full cards and tapestry name ribbons. A partner placeholder is portrait-sized and sits directly beside the person; neighbouring people shift just enough to open that place.

Each relationship keeps its own child branch, including after divorce and when either person has another partner. Use the **+** on the relevant relationship to add a child to that parent pair. Drag people to arrange complex families; partner and child connections update immediately. Long tapestry partner connections leave portraits sideways before passing below the name ribbons.

## Record a death from the context menu

Right-click a person's card and choose **Mark as deceased**. Enter the actual death date, for example `15.07.2020`, and choose **Save death date**. Before any change is saved, a confirmation dialog names the action and person. Choose **Confirm** to apply it, or **Cancel** to keep the stored profile unchanged. This confirmation also applies when correcting/removing a death date or changing it in the full profile. Empty, invalid dates and dates before birth are rejected before confirmation; an example date is not entered automatically.

A saved death date shows the portrait in grayscale at half opacity, without a cross. The full date still appears with a dagger marker (`† 15.07.2020`). Existing profiles with a death date receive the same appearance automatically. Initials without a photo are dimmed the same way. The original stored photo is unchanged.

Right-click again and choose **Change death date** to correct the date. **Remove death date** clears the recorded death and its automatic portrait styling. These changes use the normal save, undo and backup history. Death does not automatically record divorce or change parent/partner links.

## Partnerships, divorce and children

A person without an active partner has a portrait-sized **Add partner** place directly on their left or right. If someone already stands there, the tree opens a gap so the place stays beside the person. Hide these places under **Settings**. You can also right-click their card and choose **Add a new partner**, or select an existing person as the current partner in the profile. Each person can have one active partnership; earlier partnerships are retained.

To record divorce, open the relationship controls in the profile or right-click the person and select **Record a divorce**, then confirm. Both people and their shared connection remain visible, even without children. The connection receives a double slash and the relationship is stored as divorced. Right-click either former partner to add a new partner. Existing children keep their original parents.

**Marital status** is filled in automatically. A connected partnership is **Married**. A line struck for divorce records **Divorced**. A separated pair that was never connected stays **Single / unspecified**. Older files receive the same reading when opened.

The profile can store an optional **Wedding date** with the marital status. It is drawn beside the couple. Leave it empty when the wedding date is unknown.

The plus on a shared child branch provides:

- **Add child:** create a child with both parents prefilled.
- **No children · close the line:** mark that relationship as childless; available only without shared children.

A childless branch can be reopened. Adding a shared child automatically clears the childless marker.

The **No children** badge is centered by its actual size at the midpoint of its branch line, in all three layouts. Click the badge to reopen the branch or add a child.

## Add ancestors later

Right-click a person and choose **Add ancestors**. The view centers on that person without moving people who are already placed. An **Add ancestor** slot appears only for that person, not automatically for their partner. The slot sits above them, or beside an ancestor they already have, and moves to the nearest free place instead of covering a card. Saving records that parent-child link; no gender is guessed.

If the first parent has no active partner, their **Add partner** slot still enters the second parent. If that parent already has a partner, the new ancestor gets its own free slot. While ancestor-entry mode is active, a free partner slot of the known parent preselects that parent and also links the new person to the original child. Once both parents are saved, the extra slots disappear.

A **+** beside a partnership adds a child of both people. It appears only while that couple has no child yet and the line has not been closed as childless. Once a child exists, the plus disappears. The **No children** badge remains on a closed line so it can be reopened. Divorced partnerships have no plus on the line. **No answer** in that dialog hides the plus without recording that there are no children. Right-click a person and choose **Add child** to record a child of that person alone, including when the other parent is unknown. **Add a child with …** records a child of that partnership. For a divorced partner, that entry sits directly under **Add child**, indented and aligned to the right.

Choose **Finish adding** to hide empty slots without deleting saved people. When both parents exist, the menu shows **Parents already complete**. The context menu is also available with the Context Menu key or Shift+F10 on a focused card. Arrow keys move between actions; Escape or a click outside closes it.

## Remove a person from the context menu

Right-click a card and choose **Remove person**, always the last entry and set off by a horizontal line. If that person has descendants, the dialog asks whether to remove only that person or the whole following tree. **Don't ask this again** remembers the choice. Turn the question back on under **Settings**. A confirmation dialog explicitly names the action and person and explains that their direct links will be removed. Nothing changes until you choose **Confirm**; **Cancel** keeps the person and relationships unchanged. The same confirmation is used by the profile's remove button.

Removal does not delete other people. Their links to the removed person are cleared. The normal undo and backup history remain available; **Undo** restores the removed person and their previous links.

## Move around the tree

- Drag a person to reposition that person. Connections and child branches follow while dragging; the viewport stays still. Dropping onto another person uses a nearby free position. Positions are saved separately for each view and support undo/redo, reload, backups and encrypted exchange.
- Click a person, or press Space on their card: pan the canvas to center that person. Card positions, relationship paths and zoom stay unchanged.
- Double-click a card, or press Enter: open the profile.
- **Fit all** or the fit icon: fit the complete tree into the viewport.
- Drag empty canvas space: pan.
- Mouse wheel: zoom around the mouse pointer without moving the point beneath it. Zoom buttons use the viewport center. Zoom does not change card positions or relationship paths.

Choose **Collapse** in the fixed bar above the tree to hide the title, style buttons and search, and **Expand** to show them again. The button stays in that bar. **Tidy**, the inward-arrow icon beside **Fit all** at the bottom right, rebuilds the current view by generations: partners sit side by side, children form one group centered under their parents, and ancestors stay above their own line. Cards do not cover one another. Other views keep their own positions. Drag a partnership line, whether the couple is married or divorced, to move both people together. The views are **Classic**, **Horizontal** and **Tapestry**. Partner links stay one smooth curve attached to both portraits, including when a child is moved onto that row. Child lines detour around cards. A later partner after a divorce sits on the free outer side of that person, or one row below if that side is taken. Neighbouring cards move so the new person does not sit on the divorce line. Drag the partnership or divorce line to move both people together. Lines route around portraits, partner placeholders and other connections instead of crossing them. The child **+** for a married partnership sits beside that link, off any card. Connection lines attach to visible card/portrait boundaries. SVG paths and layout-based scaling avoid scaling a pre-rasterized canvas layer; at very small zoom levels, physical pixel limits still apply.

Search filters visible cards without deleting data and includes birth names.

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

In the desktop app, **Export** asks whether to write an ordinary PDF or an encrypted `.urinamu` file. **As PDF** saves a normal picture of the open tree. That PDF also works in the browser preview. **As a UriNamu file** contains people, photos and relationships. Use a long unique password of at least ten characters and send it separately. The password is not stored. **Import** reads `.urinamu` and older `.wurzeln` exports as a new tree. Enter the correct password; modified or incomplete encrypted files are rejected.

On Windows, choose a new export filename if a file already exists. The local working database and backups are not additionally encrypted. Back up the entire application data directory while the app is closed before manual recovery or migration.

For setup and installer builds, see [the developer guide](DEVELOPMENT.md). The browser preview has separate IndexedDB data and does not provide native dialogs or encrypted exchange; it is not the desktop application.
