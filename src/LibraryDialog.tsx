import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { type Family } from "./domain";
import { listTrees, type TreeInfo } from "./storage";
import { Modal } from "./App";
import { shown, t } from "./i18n";
export default function LibraryDialog({
  busy,
  onClose,
  onOpen,
  onNew,
  onDelete,
  onRename,
}: {
  busy: boolean;
  onClose: () => void;
  onOpen: (id: string) => Promise<boolean>;
  onNew: (f: Family) => Promise<boolean>;
  onDelete: (tree: TreeInfo) => Promise<boolean>;
  onRename: (tree: TreeInfo, name: string) => Promise<boolean>;
}) {
  const [trees, setTrees] = useState<TreeInfo[]>([]),
    [name, setName] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [draft, setDraft] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    listTrees()
      .then(setTrees)
      .catch((e) => setError(String(e)));
  }, []);
  return (
    <Modal title={t("myTrees")} onClose={() => !busy && onClose()}>
      <p>{t("libraryIntro")}</p>
      <div className="history-list">
        {trees.map((tree) =>
          editing === tree.id ? (
            <form
              className="tree-rename"
              key={tree.id}
              onSubmit={async (e) => {
                e.preventDefault();
                if (!(await onRename(tree, draft))) return;
                setEditing(null);
                try {
                  setTrees(await listTrees());
                } catch (err) {
                  setError(String(err));
                }
              }}
            >
              <input
                aria-label={t("renameTree")}
                required
                maxLength={100}
                value={draft}
                autoFocus
                disabled={busy}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditing(null);
                }}
              />
              <button className="primary" disabled={busy || !draft.trim()}>
                {t("save")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                {t("cancel")}
              </button>
            </form>
          ) : (
            <div className="tree-row" key={tree.id}>
              <button
                disabled={busy || tree.current}
                onClick={async () => {
                  if (await onOpen(tree.id)) onClose();
                }}
              >
                <span>
                  <strong>{tree.name}</strong>
                  <small>
                    {t("membersOpen", {
                      count: tree.members,
                      suffix: tree.current ? t("openNow") : "",
                    })}
                  </small>
                </span>
                <span>{tree.current ? t("current") : t("open")}</span>
              </button>
              <button
                type="button"
                className="icon tree-rename-button"
                aria-label={t("renameNamed", { name: tree.name })}
                title={t("renameTree")}
                disabled={busy}
                onClick={() => {
                  setDraft(tree.name);
                  setEditing(tree.id);
                  setError("");
                }}
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                className="icon tree-delete"
                aria-label={t("deleteNamed", { name: tree.name })}
                title={t("deleteTree")}
                disabled={busy}
                onClick={async () => {
                  if (!(await onDelete(tree))) return;
                  try {
                    setTrees(await listTrees());
                  } catch (err) {
                    setError(String(err));
                  }
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ),
        )}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await onNew({
              version: 2,
              name: name.trim(),
              members: [],
              unions: [],
            })
          )
            onClose();
        }}
      >
        <div className="fields">
          <label>
            {t("createTree")}
            <input
              required
              maxLength={100}
              placeholder={t("treePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        </div>
        <div className="actions">
          <button className="primary" disabled={busy || !name.trim()}>
            {t("createTreeButton")}
          </button>
        </div>
      </form>
      {error && <p className="form-error">{shown(error)}</p>}
    </Modal>
  );
}
