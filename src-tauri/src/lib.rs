use aes_gcm::{
    aead::{Aead, Payload},
    Aes256Gcm, KeyInit, Nonce,
};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
};
use zeroize::Zeroizing;
const MAX_FILE: u64 = 32 * 1024 * 1024;
type Result<T> = std::result::Result<T, String>;
fn random_u64() -> Result<u64> {
    let mut bytes = [0u8; 8];
    getrandom::fill(&mut bytes).map_err(err)?;
    Ok(u64::from_le_bytes(bytes))
}
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Person {
    pub id: String,
    pub name: String,
    #[serde(default, rename = "firstName")]
    pub first_name: String,
    #[serde(default, rename = "lastName")]
    pub last_name: String,
    #[serde(default, rename = "birthName")]
    pub birth_name: String,
    pub born: String,
    pub died: String,
    pub place: String,
    pub bio: String,
    pub gender: String,
    pub appearance: String,
    pub photo: String,
    pub parents: Vec<String>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub positions: HashMap<String, Position>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dynasty: Option<Dynasty>,
    #[serde(default, rename = "dynastyWith", skip_serializing_if = "Vec::is_empty")]
    pub dynasty_with: Vec<String>,
}
fn unspecified_marriage() -> String {
    "unspecified".into()
}
fn child_prompt_default() -> bool {
    true
}
fn is_true(value: &bool) -> bool {
    *value
}
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Dynasty {
    pub name: String,
    #[serde(default)]
    pub logo: String,
    #[serde(default = "dynasty_corner")]
    pub corner: String,
}
fn dynasty_corner() -> String {
    "left".into()
}
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Union {
    pub id: String,
    pub a: String,
    pub b: String,
    pub status: String,
    pub ended: bool,
    #[serde(default = "unspecified_marriage")]
    pub marriage: String,
    #[serde(default, rename = "marriedOn", skip_serializing_if = "String::is_empty")]
    pub married_on: String,
    #[serde(
        default = "child_prompt_default",
        rename = "childPrompt",
        skip_serializing_if = "is_true"
    )]
    pub child_prompt: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dynasty: Option<Dynasty>,
}
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Family {
    pub version: u32,
    pub name: String,
    pub members: Vec<Person>,
    pub unions: Vec<Union>,
}
fn key(a: &str, b: &str) -> String {
    if a < b {
        format!("{a}|{b}")
    } else {
        format!("{b}|{a}")
    }
}
fn children(f: &Family, u: &Union) -> bool {
    f.members
        .iter()
        .any(|p| p.parents.contains(&u.a) && p.parents.contains(&u.b))
}
fn valid_date(s: &str) -> bool {
    if s.is_empty() {
        return true;
    }
    let b = s.as_bytes();
    if b.len() != 10
        || b[4] != b'-'
        || b[7] != b'-'
        || !b
            .iter()
            .enumerate()
            .all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit())
    {
        return false;
    }
    let y = s[0..4].parse::<u32>().unwrap_or(0);
    let m = s[5..7].parse::<usize>().unwrap_or(0);
    let d = s[8..10].parse::<u32>().unwrap_or(0);
    let days = [
        31,
        if y % 4 == 0 && (y % 100 != 0 || y % 400 == 0) {
            29
        } else {
            28
        },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    y > 0 && (1..=12).contains(&m) && d > 0 && d <= days[m.saturating_sub(1).min(11)]
}
pub fn validate(f: &Family) -> Result<()> {
    if f.version != 2 || f.name.trim().is_empty() || f.name.len() > 400 || f.members.len() > 5000 {
        return Err("Ungültige Familie.".into());
    }
    let mut ids = HashSet::new();
    for p in &f.members {
        if p.id.is_empty()
            || p.id.len() > 100
            || p.id.contains('|')
            || !ids.insert(p.id.clone())
            || p.name.trim().is_empty()
            || p.name.chars().count() > 100
            || p.first_name.chars().count() > 100
            || p.last_name.chars().count() > 100
            || p.birth_name.chars().count() > 100
            || p.parents.len() > 2
            || p.parents.iter().collect::<HashSet<_>>().len() != p.parents.len()
            || !["male", "female", ""].contains(&p.gender.as_str())
            || !["normal", "dimmed", "struck"].contains(&p.appearance.as_str())
            || !valid_date(&p.born)
            || !valid_date(&p.died)
            || (!p.born.is_empty() && !p.died.is_empty() && p.died < p.born)
            || p.bio.len() > 20000
            || p.photo.len() > 2_000_000
            || p.positions.iter().any(|(mode, point)| {
                !["classic", "horizontal", "tapestry"].contains(&mode.as_str())
                    || !point.x.is_finite()
                    || !point.y.is_finite()
                    || point.x.abs() > 1_000_000.0
                    || point.y.abs() > 1_000_000.0
            })
        {
            return Err("Ungültige Profildaten.".into());
        }
        if !p.photo.is_empty() {
            decode_photo(&p.photo)?;
        }
        if let Some(dynasty) = &p.dynasty {
            if dynasty.name.trim().is_empty() || dynasty.name.chars().count() > 80 {
                return Err(
                    "Bitte einen Dynastienamen eingeben (maximal 80 Zeichen).".into(),
                );
            }
            if dynasty.corner != "left" && dynasty.corner != "right" {
                return Err("Ungültige Dynastie.".into());
            }
            if !dynasty.logo.is_empty() {
                decode_photo(&dynasty.logo)?;
            }
        }
    }
    let map: HashMap<_, _> = f.members.iter().map(|p| (p.id.as_str(), p)).collect();
    for p in &f.members {
        for id in &p.parents {
            let parent = map.get(id.as_str()).ok_or("Elternteil fehlt.")?;
            if id == &p.id
                || (!p.born.is_empty() && !parent.born.is_empty() && parent.born >= p.born)
            {
                return Err("Ungültige Abstammung oder Geburtsdaten.".into());
            }
        }
        let mut seen = HashSet::new();
        for founder_id in &p.dynasty_with {
            if founder_id == &p.id
                || !seen.insert(founder_id)
                || map.get(founder_id.as_str()).and_then(|founder| founder.dynasty.as_ref()).is_none()
                || !f.unions.iter().any(|u| {
                    (u.a == p.id && u.b == *founder_id) || (u.b == p.id && u.a == *founder_id)
                })
            {
                return Err("Ungültige Dynastie.".into());
            }
        }
    }
    fn visit<'a>(
        id: &'a str,
        map: &HashMap<&'a str, &'a Person>,
        active: &mut HashSet<&'a str>,
        done: &mut HashSet<&'a str>,
    ) -> Result<()> {
        if active.contains(id) {
            return Err("Kreis in der Abstammung.".into());
        }
        if done.contains(id) {
            return Ok(());
        }
        active.insert(id);
        for parent in &map[id].parents {
            visit(parent, map, active, done)?
        }
        active.remove(id);
        done.insert(id);
        Ok(())
    }
    let mut active = HashSet::new();
    let mut done = HashSet::new();
    for p in &f.members {
        visit(&p.id, &map, &mut active, &mut done)?;
    }
    let mut keys = HashSet::new();
    let mut paired = HashSet::new();
    for u in &f.unions {
        if !ids.contains(&u.a)
            || !ids.contains(&u.b)
            || u.a == u.b
            || u.id != key(&u.a, &u.b)
            || !keys.insert(u.id.clone())
            || !["active", "separated"].contains(&u.status.as_str())
            || !["unspecified", "married", "divorced"].contains(&u.marriage.as_str())
            || !valid_date(&u.married_on)
            || (u.marriage == "married" && u.status != "active")
            || (u.marriage == "divorced" && u.status != "separated")
            || (u.ended && children(f, u))
        {
            return Err("Ungültige Partnerschaft.".into());
        }
        if u.status == "active" && (!paired.insert(&u.a) || !paired.insert(&u.b)) {
            return Err("Mehrere aktive Partnerschaften.".into());
        }
        if let Some(dynasty) = &u.dynasty {
            if dynasty.name.trim().is_empty() || dynasty.name.chars().count() > 80 {
                return Err(
                    "Bitte einen Dynastienamen eingeben (maximal 80 Zeichen).".into(),
                );
            }
            if dynasty.corner != "left" && dynasty.corner != "right" {
                return Err("Ungültige Dynastie.".into());
            }
            if !dynasty.logo.is_empty() {
                decode_photo(&dynasty.logo)?;
            }
        }
        if !u.married_on.is_empty() {
            for person in f.members.iter().filter(|p| p.id == u.a || p.id == u.b) {
                if (!person.born.is_empty() && u.married_on < person.born)
                    || (!person.died.is_empty() && u.married_on > person.died)
                {
                    return Err("Ungültige Partnerschaft.".into());
                }
            }
        }
    }
    for p in &f.members {
        if p.parents.len() == 2 && !keys.contains(&key(&p.parents[0], &p.parents[1])) {
            return Err("Partnerschaft der Eltern fehlt.".into());
        }
    }
    Ok(())
}
fn decode_photo(photo: &str) -> Result<(&str, Vec<u8>)> {
    let (header, data) = photo.split_once(',').ok_or("Ungültiges Foto.")?;
    let ext = match header {
        "data:image/jpeg;base64" => "jpg",
        "data:image/png;base64" => "png",
        "data:image/webp;base64" => "webp",
        "data:image/avif;base64" => "avif",
        _ => return Err("Ungültiges Fotoformat.".into()),
    };
    let bytes = B64.decode(data).map_err(err)?;
    if bytes.is_empty() {
        return Err("Leeres Foto.".into());
    }
    Ok((ext, bytes))
}
#[derive(Serialize)]
pub struct Revision {
    pub id: i64,
    pub created: String,
    pub label: String,
}
#[derive(Serialize)]
pub struct TreeInfo {
    pub id: String,
    pub name: String,
    pub members: usize,
    pub current: bool,
}
#[derive(Serialize)]
pub struct DeletedTree {
    pub family: Option<Family>,
    pub changed: bool,
}
pub struct Store {
    pub root: PathBuf,
}
impl Store {
    pub fn new(root: PathBuf) -> Result<Self> {
        fs::create_dir_all(root.join("photos")).map_err(err)?;
        let s = Self { root };
        s.db()?;
        Ok(s)
    }
    fn db(&self) -> Result<Connection> {
        let mut c = Connection::open(self.root.join("urinamu.sqlite")).map_err(err)?;
        let schema: i64 = c
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .map_err(err)?;
        if schema > 2 {
            return Err("Diese Datenbank benötigt eine neuere UriNamu-Version.".into());
        }
        c.busy_timeout(std::time::Duration::from_secs(10))
            .map_err(err)?;
        c.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;")
            .map_err(err)?;
        let tx = c
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
            .map_err(err)?;
        tx.execute_batch("CREATE TABLE IF NOT EXISTS current(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS revisions(id INTEGER PRIMARY KEY AUTOINCREMENT,created TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%SZ','now')),label TEXT NOT NULL,data TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS trees(id TEXT PRIMARY KEY,name TEXT NOT NULL,data TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS active_tree(id INTEGER PRIMARY KEY CHECK(id=1),tree_id TEXT NOT NULL);").map_err(err)?;
        let has_column: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('revisions') WHERE name='tree_id'",
                [],
                |r| r.get(0),
            )
            .map_err(err)?;
        if has_column == 0 {
            tx.execute_batch(
                "ALTER TABLE revisions ADD COLUMN tree_id TEXT NOT NULL DEFAULT 'legacy';",
            )
            .map_err(err)?;
        }
        let count: i64 = tx
            .query_row("SELECT COUNT(*) FROM trees", [], |r| r.get(0))
            .map_err(err)?;
        if count == 0 {
            let old: Option<String> = tx
                .query_row("SELECT data FROM current WHERE id=1", [], |r| r.get(0))
                .optional()
                .map_err(err)?;
            if let Some(old) = old {
                let value: Value = serde_json::from_str(&old).map_err(err)?;
                let name = value["name"].as_str().unwrap_or("Meine Familie");
                tx.execute(
                    "INSERT INTO trees(id,name,data) VALUES('legacy',?1,?2)",
                    params![name, old],
                )
                .map_err(err)?;
                tx.execute("INSERT INTO active_tree(id,tree_id) VALUES(1,'legacy') ON CONFLICT(id) DO UPDATE SET tree_id='legacy'",[]).map_err(err)?;
            }
        }
        tx.execute_batch("PRAGMA user_version=2;").map_err(err)?;
        tx.commit().map_err(err)?;
        Ok(c)
    }
    fn externalize(&self, f: &Family) -> Result<Value> {
        let mut data = serde_json::to_value(f).map_err(err)?;
        for p in data["members"].as_array_mut().unwrap() {
            let photo = p["photo"].as_str().unwrap_or("").to_string();
            if !photo.is_empty() {
                let (ext, bytes) = decode_photo(&photo)?;
                let hash: String = Sha256::digest(&bytes)
                    .iter()
                    .map(|b| format!("{b:02x}"))
                    .collect();
                let file = format!("{hash}.{ext}");
                let path = self.root.join("photos").join(&file);
                if !path.exists() {
                    atomic_write(&path, &bytes)?
                }
                p["photo"] = Value::String(format!("photo:{file}"));
            }
            let logo = p
                .get("dynasty")
                .and_then(|dynasty| dynasty.get("logo"))
                .and_then(|logo| logo.as_str())
                .unwrap_or("")
                .to_string();
            if !logo.is_empty() {
                let (ext, bytes) = decode_photo(&logo)?;
                let hash: String = Sha256::digest(&bytes)
                    .iter()
                    .map(|b| format!("{b:02x}"))
                    .collect();
                let file = format!("{hash}.{ext}");
                let path = self.root.join("photos").join(&file);
                if !path.exists() {
                    atomic_write(&path, &bytes)?
                }
                p["dynasty"]["logo"] = Value::String(format!("photo:{file}"));
            }
        }
        if let Some(unions) = data["unions"].as_array_mut() {
            for union in unions {
                let logo = union
                    .get("dynasty")
                    .and_then(|dynasty| dynasty.get("logo"))
                    .and_then(|logo| logo.as_str())
                    .unwrap_or("")
                    .to_string();
                if logo.is_empty() {
                    continue;
                }
                let (ext, bytes) = decode_photo(&logo)?;
                let hash: String = Sha256::digest(&bytes)
                    .iter()
                    .map(|b| format!("{b:02x}"))
                    .collect();
                let file = format!("{hash}.{ext}");
                let path = self.root.join("photos").join(&file);
                if !path.exists() {
                    atomic_write(&path, &bytes)?
                }
                union["dynasty"]["logo"] = Value::String(format!("photo:{file}"));
            }
        }
        Ok(data)
    }
    fn hydrate(&self, text: &str) -> Result<Family> {
        let mut data: Value = serde_json::from_str(text).map_err(err)?;
        for p in data["members"]
            .as_array_mut()
            .ok_or("Ungültige Datenbank.")?
        {
            let photo = p["photo"].as_str().unwrap_or("").to_string();
            if let Some(file) = photo.strip_prefix("photo:") {
                if file.contains('/') || file.contains('\\') || file.contains("..") {
                    return Err("Ungültiger Fotopfad.".into());
                }
                let bytes = fs::read(self.root.join("photos").join(file)).map_err(|_| {
                    "Ein gespeichertes Foto fehlt. Bitte eine Sicherung wiederherstellen."
                        .to_string()
                })?;
                let mime = if file.ends_with(".jpg") {
                    "jpeg"
                } else if file.ends_with(".png") {
                    "png"
                } else if file.ends_with(".webp") {
                    "webp"
                } else {
                    "avif"
                };
                p["photo"] =
                    Value::String(format!("data:image/{mime};base64,{}", B64.encode(bytes)));
            }
            let logo = p
                .get("dynasty")
                .and_then(|dynasty| dynasty.get("logo"))
                .and_then(|logo| logo.as_str())
                .unwrap_or("")
                .to_string();
            if let Some(file) = logo.strip_prefix("photo:") {
                if file.contains('/') || file.contains('\\') || file.contains("..") {
                    return Err("Ungültiger Fotopfad.".into());
                }
                let bytes = fs::read(self.root.join("photos").join(file)).map_err(|_| {
                    "Ein gespeichertes Foto fehlt. Bitte eine Sicherung wiederherstellen."
                        .to_string()
                })?;
                let mime = if file.ends_with(".jpg") {
                    "jpeg"
                } else if file.ends_with(".png") {
                    "png"
                } else if file.ends_with(".webp") {
                    "webp"
                } else {
                    "avif"
                };
                p["dynasty"]["logo"] =
                    Value::String(format!("data:image/{mime};base64,{}", B64.encode(bytes)));
            }
        }
        if let Some(unions) = data["unions"].as_array_mut() {
            for union in unions {
                let logo = union
                    .get("dynasty")
                    .and_then(|dynasty| dynasty.get("logo"))
                    .and_then(|logo| logo.as_str())
                    .unwrap_or("")
                    .to_string();
                let Some(file) = logo.strip_prefix("photo:") else {
                    continue;
                };
                if file.contains('/') || file.contains('\\') || file.contains("..") {
                    return Err("Ungültiger Fotopfad.".into());
                }
                let bytes = fs::read(self.root.join("photos").join(file)).map_err(|_| {
                    "Ein gespeichertes Foto fehlt. Bitte eine Sicherung wiederherstellen."
                        .to_string()
                })?;
                let mime = if file.ends_with(".jpg") {
                    "jpeg"
                } else if file.ends_with(".png") {
                    "png"
                } else if file.ends_with(".webp") {
                    "webp"
                } else {
                    "avif"
                };
                union["dynasty"]["logo"] =
                    Value::String(format!("data:image/{mime};base64,{}", B64.encode(bytes)));
            }
        }
        let f: Family = serde_json::from_value(data).map_err(err)?;
        validate(&f)?;
        Ok(f)
    }
    pub fn load(&self) -> Result<Option<Family>> {
        let c = self.db()?;
        let text: Option<String> = c
            .query_row("SELECT data FROM current WHERE id=1", [], |r| r.get(0))
            .optional()
            .map_err(err)?;
        text.map(|s| self.hydrate(&s)).transpose()
    }
    fn write(&self, f: &Family, label: &str, new_tree: bool) -> Result<String> {
        validate(f)?;
        let data = self.externalize(f)?.to_string();
        let mut c = self.db()?;
        let tx = c
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
            .map_err(err)?;
        let active: Option<String> = tx
            .query_row("SELECT tree_id FROM active_tree WHERE id=1", [], |r| {
                r.get(0)
            })
            .optional()
            .map_err(err)?;
        let id = if new_tree {
            format!("tree-{:016x}", random_u64()?)
        } else {
            if let Some(active) = active {
                active
            } else {
                format!("tree-{:016x}", random_u64()?)
            }
        };
        if new_tree {
            tx.execute(
                "INSERT INTO trees(id,name,data) VALUES(?1,?2,?3)",
                params![id, f.name, data],
            )
            .map_err(err)?;
        } else {
            tx.execute("INSERT INTO trees(id,name,data) VALUES(?1,?2,?3) ON CONFLICT(id) DO UPDATE SET name=excluded.name,data=excluded.data",params![id,f.name,data]).map_err(err)?;
        }
        tx.execute("INSERT INTO active_tree(id,tree_id) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET tree_id=excluded.tree_id",params![id]).map_err(err)?;
        tx.execute("INSERT INTO current(id,data) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET data=excluded.data",params![data]).map_err(err)?;
        tx.execute(
            "INSERT INTO revisions(label,data,tree_id) VALUES(?1,?2,?3)",
            params![label.chars().take(160).collect::<String>(), data, id],
        )
        .map_err(err)?;
        tx.execute("DELETE FROM revisions WHERE tree_id=?1 AND id NOT IN (SELECT id FROM revisions WHERE tree_id=?1 ORDER BY id DESC LIMIT 100)",params![id]).map_err(err)?;
        tx.commit().map_err(err)?;
        Ok(id)
    }
    pub fn save(&self, f: &Family, label: &str) -> Result<()> {
        self.write(f, label, false).map(|_| ())
    }
    pub fn create_tree(&self, f: &Family, label: &str) -> Result<String> {
        self.write(f, label, true)
    }
    pub fn list_trees(&self) -> Result<Vec<TreeInfo>> {
        let c = self.db()?;
        let active: Option<String> = c
            .query_row("SELECT tree_id FROM active_tree WHERE id=1", [], |r| {
                r.get(0)
            })
            .optional()
            .map_err(err)?;
        let mut stmt = c
            .prepare("SELECT id,name,data FROM trees ORDER BY name COLLATE NOCASE,id")
            .map_err(err)?;
        let rows = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                ))
            })
            .map_err(err)?;
        rows.map(|row| {
            let (id, name, data) = row.map_err(err)?;
            let v: Value = serde_json::from_str(&data).map_err(err)?;
            let members = v["members"].as_array().ok_or("Ungültige Familie.")?.len();
            Ok(TreeInfo {
                current: active.as_ref() == Some(&id),
                id,
                name,
                members,
            })
        })
        .collect()
    }
    pub fn read_tree(&self, id: &str) -> Result<Family> {
        let c = self.db()?;
        let text: String = c
            .query_row("SELECT data FROM trees WHERE id=?1", [id], |r| r.get(0))
            .map_err(err)?;
        self.hydrate(&text)
    }
    pub fn rename_tree(&self, id: &str, name: &str) -> Result<()> {
        let name = name.trim();
        if name.is_empty() || name.chars().count() > 100 {
            return Err("Bitte einen Namen eingeben (maximal 100 Zeichen).".into());
        }
        let mut c = self.db()?;
        let tx = c
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
            .map_err(err)?;
        let text: Option<String> = tx
            .query_row("SELECT data FROM trees WHERE id=?1", [id], |r| r.get(0))
            .optional()
            .map_err(err)?;
        let Some(text) = text else {
            return Err("Stammbaum nicht gefunden.".into());
        };
        let mut data: Value = serde_json::from_str(&text).map_err(err)?;
        data["name"] = Value::String(name.to_string());
        let stored = serde_json::to_string(&data).map_err(err)?;
        tx.execute(
            "UPDATE trees SET name=?1, data=?2 WHERE id=?3",
            params![name, stored, id],
        )
        .map_err(err)?;
        let active: Option<String> = tx
            .query_row("SELECT tree_id FROM active_tree WHERE id=1", [], |r| r.get(0))
            .optional()
            .map_err(err)?;
        if active.as_deref() == Some(id) {
            tx.execute(
                "UPDATE current SET data=?1 WHERE id=1",
                params![stored],
            )
            .map_err(err)?;
        }
        tx.commit().map_err(err)?;
        Ok(())
    }
    pub fn delete_tree(&self, id: &str) -> Result<DeletedTree> {
        let mut c = self.db()?;
        let tx = c
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
            .map_err(err)?;
        let exists: Option<String> = tx
            .query_row("SELECT id FROM trees WHERE id=?1", [id], |r| r.get(0))
            .optional()
            .map_err(err)?;
        if exists.is_none() {
            return Err("Stammbaum nicht gefunden.".into());
        }
        let active: Option<String> = tx
            .query_row("SELECT tree_id FROM active_tree WHERE id=1", [], |r| r.get(0))
            .optional()
            .map_err(err)?;
        tx.execute("DELETE FROM revisions WHERE tree_id=?1", [id])
            .map_err(err)?;
        tx.execute("DELETE FROM trees WHERE id=?1", [id])
            .map_err(err)?;
        let changed = active.as_deref() == Some(id);
        let family = if !changed {
            None
        } else {
            let next: Option<(String, String)> = tx
                .query_row(
                    "SELECT id, data FROM trees ORDER BY name COLLATE NOCASE, id LIMIT 1",
                    [],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .optional()
                .map_err(err)?;
            if let Some((next_id, data)) = next {
                tx.execute("INSERT INTO active_tree(id,tree_id) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET tree_id=excluded.tree_id",[next_id]).map_err(err)?;
                tx.execute("INSERT INTO current(id,data) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET data=excluded.data",[&data]).map_err(err)?;
                Some(self.hydrate(&data)?)
            } else {
                tx.execute("DELETE FROM active_tree WHERE id=1", [])
                    .map_err(err)?;
                tx.execute("DELETE FROM current WHERE id=1", [])
                    .map_err(err)?;
                None
            }
        };
        tx.commit().map_err(err)?;
        Ok(DeletedTree { family, changed })
    }
    pub fn switch_tree(&self, id: &str) -> Result<Family> {
        let mut c = self.db()?;
        let tx = c
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
            .map_err(err)?;
        let text: String = tx
            .query_row("SELECT data FROM trees WHERE id=?1", [id], |r| r.get(0))
            .map_err(err)?;
        let family = self.hydrate(&text)?;
        tx.execute("INSERT INTO current(id,data) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET data=excluded.data",params![text]).map_err(err)?;
        tx.execute("INSERT INTO active_tree(id,tree_id) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET tree_id=excluded.tree_id",[id]).map_err(err)?;
        tx.commit().map_err(err)?;
        Ok(family)
    }
    pub fn history(&self) -> Result<Vec<Revision>> {
        let c = self.db()?;
        let mut stmt=c.prepare("SELECT id,created,label FROM revisions WHERE tree_id=(SELECT tree_id FROM active_tree WHERE id=1) ORDER BY id DESC LIMIT 100").map_err(err)?;
        let rows = stmt
            .query_map([], |r| {
                Ok(Revision {
                    id: r.get(0)?,
                    created: r.get(1)?,
                    label: r.get(2)?,
                })
            })
            .map_err(err)?;
        rows.map(|r| r.map_err(err)).collect()
    }
    pub fn revision(&self, id: i64) -> Result<Family> {
        let c = self.db()?;
        let text:String=c.query_row("SELECT data FROM revisions WHERE id=?1 AND tree_id=(SELECT tree_id FROM active_tree WHERE id=1)",[id],|r|r.get(0)).map_err(err)?;
        self.hydrate(&text)
    }
}
fn atomic_write(path: &Path, data: &[u8]) -> Result<()> {
    use std::io::Write;
    let parent = path.parent().ok_or("Ungültiger Pfad.")?;
    let temp = parent.join(format!(".urinamu-{}.tmp", random_u64()?));
    let result = (|| {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)
            .map_err(err)?;
        file.write_all(data).map_err(err)?;
        file.sync_all().map_err(err)?;
        drop(file);
        #[cfg(target_os = "windows")]
        if path.exists() {
            return Err(
                "Die Zieldatei existiert bereits. Bitte einen neuen Dateinamen wählen.".into(),
            );
        }
        fs::rename(&temp, path).map_err(err)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}
fn derived(password: &str, salt: &[u8]) -> Result<Zeroizing<[u8; 32]>> {
    let params = Params::new(19456, 2, 1, Some(32)).map_err(err)?;
    let mut output = Zeroizing::new([0u8; 32]);
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
        .hash_password_into(password.as_bytes(), salt, output.as_mut())
        .map_err(err)?;
    Ok(output)
}
pub fn encrypt(f: &Family, password: &str) -> Result<String> {
    validate(f)?;
    if password.chars().count() < 10 {
        return Err("Das Passwort muss mindestens 10 Zeichen lang sein.".into());
    }
    let mut salt = [0u8; 16];
    let mut iv = [0u8; 12];
    getrandom::fill(&mut salt).map_err(err)?;
    getrandom::fill(&mut iv).map_err(err)?;
    let key = derived(password, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(key.as_ref()).map_err(err)?;
    let plain = Zeroizing::new(serde_json::to_vec(f).map_err(err)?);
    let bytes = cipher
        .encrypt(
            &Nonce::from(<[u8; 12]>::try_from(iv.as_slice()).map_err(err)?),
            Payload {
                msg: plain.as_ref(),
                aad: b"urinamu:2",
            },
        )
        .map_err(|_| "Verschlüsselung fehlgeschlagen.")?;
    Ok(serde_json::json!({"format":"urinamu","version":2,"cipher":"AES-256-GCM","kdf":"Argon2id","memory":19456,"iterations":2,"parallelism":1,"salt":B64.encode(salt),"iv":B64.encode(iv),"data":B64.encode(bytes)}).to_string())
}
pub fn decrypt(text: &str, password: &str) -> Result<Family> {
    if text.len() as u64 > MAX_FILE {
        return Err("Die Datei ist zu groß (maximal 32 MB).".into());
    }
    let e: Value = serde_json::from_str(text).map_err(|_| "Ungültige Familiendatei.")?;
    let salt = B64
        .decode(e["salt"].as_str().ok_or("Salt fehlt.")?)
        .map_err(err)?;
    let iv = B64
        .decode(e["iv"].as_str().ok_or("IV fehlt.")?)
        .map_err(err)?;
    if salt.len() != 16 || iv.len() != 12 {
        return Err("Ungültiges Verschlüsselungsformat.".into());
    }
    let old = e["format"] == "wurzeln"
        && e["version"] == 1
        && e["kdf"] == "PBKDF2-SHA256"
        && e["iterations"] == 310000;
    let key = if old {
        let mut k = Zeroizing::new([0u8; 32]);
        pbkdf2::pbkdf2_hmac::<Sha256>(password.as_bytes(), &salt, 310000, k.as_mut());
        k
    } else {
        if e["format"] != "urinamu"
            || e["version"] != 2
            || e["kdf"] != "Argon2id"
            || e["memory"] != 19456
            || e["iterations"] != 2
            || e["parallelism"] != 1
        {
            return Err("Nicht unterstütztes Dateiformat.".into());
        }
        derived(password, &salt)?
    };
    if e["cipher"] != "AES-256-GCM" {
        return Err("Nicht unterstützte Verschlüsselung.".into());
    }
    let bytes = B64
        .decode(e["data"].as_str().ok_or("Daten fehlen.")?)
        .map_err(err)?;
    let cipher = Aes256Gcm::new_from_slice(key.as_ref()).map_err(err)?;
    let plain = Zeroizing::new(
        cipher
            .decrypt(
                &Nonce::from(<[u8; 12]>::try_from(iv.as_slice()).map_err(err)?),
                Payload {
                    msg: &bytes,
                    aad: if old { b"wurzeln:1" } else { b"urinamu:2" },
                },
            )
            .map_err(|_| "Passwort falsch oder Datei beschädigt.")?,
    );
    let mut v: Value = serde_json::from_slice(plain.as_ref()).map_err(err)?;
    if old {
        v["version"] = 2.into();
        v["name"] = "Familie Morgenstern".into();
        let mut unions = Vec::new();
        if let Some(map) = v["relationships"].as_object() {
            for (id, u) in map {
                let mut u = u.clone();
                u["id"] = id.clone().into();
                unions.push(u)
            }
        }
        v["unions"] = unions.into();
        for p in v["members"].as_array_mut().ok_or("Mitglieder fehlen.")? {
            for field in ["born", "died", "place", "bio", "photo", "gender"] {
                if !p[field].is_string() {
                    p[field] = "".into()
                }
            }
            if p["gender"] != "male" && p["gender"] != "female" {
                p["gender"] = "".into()
            }
            if !p["appearance"].is_string() {
                p["appearance"] = "normal".into()
            }
        }
    }
    let f: Family = serde_json::from_value(v).map_err(err)?;
    validate(&f)?;
    Ok(f)
}
#[cfg(feature = "desktop")]
mod desktop {
    use super::*;
    use tauri::{Manager, State};
    #[tauri::command]
    fn list_trees(s: State<'_, Store>) -> Result<Vec<TreeInfo>> {
        s.list_trees()
    }
    #[tauri::command]
    fn read_tree(s: State<'_, Store>, id: String) -> Result<Family> {
        s.read_tree(&id)
    }
    #[tauri::command]
    fn switch_tree(s: State<'_, Store>, id: String) -> Result<Family> {
        s.switch_tree(&id)
    }
    #[tauri::command]
    fn delete_tree(s: State<'_, Store>, id: String) -> Result<DeletedTree> {
        s.delete_tree(&id)
    }
    #[tauri::command]
    fn rename_tree(s: State<'_, Store>, id: String, name: String) -> Result<()> {
        s.rename_tree(&id, &name)
    }
    #[tauri::command]
    fn create_tree(s: State<'_, Store>, family: Family, label: String) -> Result<String> {
        s.create_tree(&family, &label)
    }
    #[tauri::command]
    fn load_family(s: State<'_, Store>) -> Result<Option<Family>> {
        s.load()
    }
    #[tauri::command]
    fn save_family(s: State<'_, Store>, family: Family, label: String) -> Result<()> {
        s.save(&family, &label)
    }
    #[tauri::command]
    fn list_revisions(s: State<'_, Store>) -> Result<Vec<Revision>> {
        s.history()
    }
    #[tauri::command]
    fn read_revision(s: State<'_, Store>, id: i64) -> Result<Family> {
        s.revision(id)
    }
    #[tauri::command]
    fn save_pdf(request: tauri::ipc::Request<'_>) -> Result<()> {
        let header = request
            .headers()
            .get("x-path")
            .ok_or_else(|| "missing path".to_string())?;
        let encoded = header.to_str().map_err(err)?;
        let path = String::from_utf8(B64.decode(encoded).map_err(err)?).map_err(err)?;
        let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
            return Err("expected bytes".into());
        };
        atomic_write(Path::new(&path), bytes)
    }
    #[tauri::command]
    async fn export_family(path: String, password: String, family: Family) -> Result<()> {
        tauri::async_runtime::spawn_blocking(move || {
            let password = Zeroizing::new(password);
            let data = encrypt(&family, &password)?;
            if data.len() as u64 > MAX_FILE {
                return Err("Die Familiendatei überschreitet 32 MB.".into());
            }
            atomic_write(Path::new(&path), data.as_bytes())
        })
        .await
        .map_err(err)?
    }
    #[tauri::command]
    async fn import_family(path: String, password: String) -> Result<Family> {
        tauri::async_runtime::spawn_blocking(move || {
            let password = Zeroizing::new(password);
            let path = Path::new(&path);
            if fs::metadata(path).map_err(err)?.len() > MAX_FILE {
                return Err("Datei größer als 32 MB.".into());
            }
            decrypt(&fs::read_to_string(path).map_err(err)?, &password)
        })
        .await
        .map_err(err)?
    }
    pub fn run() {
        tauri::Builder::default()
            .plugin(tauri_plugin_dialog::init())
            .setup(|app| {
                let root = app.path().app_data_dir()?;
                let store = Store::new(root).map_err(std::io::Error::other)?;
                app.manage(store);
                Ok(())
            })
            .invoke_handler(tauri::generate_handler![
                list_trees,
                read_tree,
                switch_tree,
                delete_tree,
                rename_tree,
                create_tree,
                load_family,
                save_family,
                list_revisions,
                read_revision,
                export_family,
                save_pdf,
                import_family
            ])
            .run(tauri::generate_context!())
            .expect("UriNamu konnte nicht gestartet werden.");
    }
}
#[cfg(feature = "desktop")]
pub use desktop::run;
#[cfg(test)]
mod tests {
    use super::*;
    fn demo() -> Family {
        serde_json::from_str(include_str!("../../src/demo.json")).unwrap()
    }
    fn temp() -> PathBuf {
        std::env::temp_dir().join(format!("urinamu-test-{}", random_u64().unwrap()))
    }
    #[test]
    fn demo_is_valid() {
        validate(&demo()).unwrap()
    }
    #[test]
    fn database_transactions_photos_revisions() {
        let root = temp();
        let store = Store::new(root.clone()).unwrap();
        assert!(store.load().unwrap().is_none());
        let mut f = demo();
        f.members[0].photo = "data:image/png;base64,aGVsbG8=".into();
        store.save(&f, "Erster Stand").unwrap();
        let history = store.history().unwrap();
        let first = history[0].id;
        f.name = "Neue Familie".into();
        store.save(&f, "Umbenannt").unwrap();
        let loaded = store.load().unwrap().unwrap();
        assert_eq!(loaded.name, "Neue Familie");
        assert_eq!(loaded.members[0].photo, "data:image/png;base64,aGVsbG8=");
        assert_eq!(fs::read_dir(root.join("photos")).unwrap().count(), 1);
        assert!(root
            .join("photos/2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824.png")
            .exists());
        assert_eq!(store.revision(first).unwrap().name, "Familie Morgenstern");
        let mut broken = f.clone();
        broken.members[0].parents = vec!["1".into()];
        assert!(store.save(&broken, "Darf nicht speichern").is_err());
        assert_eq!(store.history().unwrap().len(), 2);
        assert_eq!(store.load().unwrap().unwrap().name, "Neue Familie");
        drop(store);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn encryption_roundtrip_and_authentication() {
        let f = demo();
        let encrypted = encrypt(&f, "sicheres-test-passwort").unwrap();
        assert!(!encrypted.contains("Morgenstern"));
        assert_eq!(
            decrypt(&encrypted, "sicheres-test-passwort")
                .unwrap()
                .members
                .len(),
            11
        );
        assert!(decrypt(&encrypted, "falsch").is_err());
        let mut v: Value = serde_json::from_str(&encrypted).unwrap();
        let mut bytes = B64.decode(v["data"].as_str().unwrap()).unwrap();
        bytes[20] ^= 1;
        v["data"] = B64.encode(bytes).into();
        assert!(decrypt(&v.to_string(), "sicheres-test-passwort").is_err());
        assert!(encrypt(&f, "kurz").is_err());
    }
    #[test]
    fn imports_prototype_v1() {
        let f = demo();
        let relationships: serde_json::Map<String, Value> = f
            .unions
            .iter()
            .map(|u| (u.id.clone(), serde_json::to_value(u).unwrap()))
            .collect();
        let payload = serde_json::json!({"members":f.members,"relationships":relationships});
        let salt = [1u8; 16];
        let iv = [2u8; 12];
        let mut key = [0u8; 32];
        pbkdf2::pbkdf2_hmac::<Sha256>(b"altes-passwort", &salt, 310000, &mut key);
        let cipher = Aes256Gcm::new_from_slice(&key).unwrap();
        let bytes = cipher
            .encrypt(
                &Nonce::from(iv),
                Payload {
                    msg: payload.to_string().as_bytes(),
                    aad: b"wurzeln:1",
                },
            )
            .unwrap();
        let e = serde_json::json!({"format":"wurzeln","version":1,"kdf":"PBKDF2-SHA256","iterations":310000,"cipher":"AES-256-GCM","salt":B64.encode(salt),"iv":B64.encode(iv),"data":B64.encode(bytes)});
        assert_eq!(
            decrypt(&e.to_string(), "altes-passwort")
                .unwrap()
                .members
                .len(),
            11
        );
    }
    #[test]
    fn blocks_bad_data() {
        let mut f = demo();
        f.members[0].parents = vec!["11".into()];
        assert!(validate(&f).is_err());
        let mut f = demo();
        f.members[0].born = "1932-02-30".into();
        assert!(validate(&f).is_err());
        let mut f = demo();
        f.unions[0].ended = true;
        assert!(validate(&f).is_err());
    }
}
#[cfg(test)]
mod library_tests {
    use super::*;
    fn f() -> Family {
        serde_json::from_str(include_str!("../../src/demo.json")).unwrap()
    }
    fn root() -> PathBuf {
        std::env::temp_dir().join(format!("urinamu-library-{}", random_u64().unwrap()))
    }
    #[test]
    fn multiple_trees_and_history_are_isolated() {
        let root = root();
        let store = Store::new(root.clone()).unwrap();
        let mut a = f();
        a.name = "Mutterseite".into();
        let aid = store.create_tree(&a, "Mutter angelegt").unwrap();
        let old_revision = store.history().unwrap()[0].id;
        let mut b = f();
        b.name = "Vaterseite".into();
        let bid = store.create_tree(&b, "Vater angelegt").unwrap();
        assert_eq!(store.list_trees().unwrap().len(), 2);
        assert!(store.revision(old_revision).is_err());
        assert_eq!(store.read_tree(&aid).unwrap().name, "Mutterseite");
        b.name = "Vaterseite geändert".into();
        store.save(&b, "Vater geändert").unwrap();
        assert_eq!(store.history().unwrap().len(), 2);
        store.switch_tree(&aid).unwrap();
        assert_eq!(store.load().unwrap().unwrap().name, "Mutterseite");
        assert_eq!(store.history().unwrap().len(), 1);
        assert_eq!(store.revision(old_revision).unwrap().name, "Mutterseite");
        assert_eq!(store.read_tree(&bid).unwrap().name, "Vaterseite geändert");
        let mut merged = f();
        merged.name = "Zusammengeführt".into();
        store.create_tree(&merged, "Neu aus Merge").unwrap();
        assert_eq!(store.list_trees().unwrap().len(), 3);
        assert_eq!(store.read_tree(&aid).unwrap().name, "Mutterseite");
        assert_eq!(store.read_tree(&bid).unwrap().name, "Vaterseite geändert");
        drop(store);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn deleting_a_tree_removes_its_history_and_switches_when_active() {
        let root = root();
        let store = Store::new(root.clone()).unwrap();
        let mut first = f();
        first.name = "Eins".into();
        let first_id = store.create_tree(&first, "Eins").unwrap();
        let first_revision = store.history().unwrap()[0].id;
        let mut second = f();
        second.name = "Zwei".into();
        let second_id = store.create_tree(&second, "Zwei").unwrap();
        let kept = store.delete_tree(&first_id).unwrap();
        assert!(!kept.changed);
        assert!(kept.family.is_none());
        assert_eq!(store.list_trees().unwrap().len(), 1);
        assert_eq!(store.load().unwrap().unwrap().name, "Zwei");
        let db = Connection::open(root.join("urinamu.sqlite")).unwrap();
        let revisions: i64 = db
            .query_row(
                "SELECT COUNT(*) FROM revisions WHERE tree_id=?1",
                [first_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(revisions, 0);
        assert!(store.revision(first_revision).is_err());
        drop(db);
        let opened = store.delete_tree(&second_id).unwrap();
        assert!(opened.changed);
        assert!(opened.family.is_none());
        assert!(store.list_trees().unwrap().is_empty());
        assert!(store.load().unwrap().is_none());
        let mut third = f();
        third.name = "Drei".into();
        store.create_tree(&first, "Eins nochmal").unwrap();
        let active = store.create_tree(&third, "Drei").unwrap();
        let switched = store.delete_tree(&active).unwrap();
        assert!(switched.changed);
        assert_eq!(switched.family.unwrap().name, "Eins");
        assert_eq!(store.load().unwrap().unwrap().name, "Eins");
        drop(store);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn renaming_a_tree_updates_only_that_name() {
        let root = root();
        let store = Store::new(root.clone()).unwrap();
        let mut first = f();
        first.name = "Eins".into();
        let first_id = store.create_tree(&first, "Eins").unwrap();
        let mut second = f();
        second.name = "Zwei".into();
        let second_id = store.create_tree(&second, "Zwei").unwrap();
        let revisions_before = store.history().unwrap().len();
        store.rename_tree(&first_id, "  Eins neu  ").unwrap();
        assert_eq!(store.read_tree(&first_id).unwrap().name, "Eins neu");
        assert_eq!(
            store
                .list_trees()
                .unwrap()
                .into_iter()
                .find(|tree| tree.id == first_id)
                .unwrap()
                .name,
            "Eins neu"
        );
        assert_eq!(store.load().unwrap().unwrap().name, "Zwei");
        assert_eq!(store.read_tree(&second_id).unwrap().name, "Zwei");
        store.rename_tree(&second_id, "Zwei neu").unwrap();
        assert_eq!(store.load().unwrap().unwrap().name, "Zwei neu");
        assert_eq!(store.history().unwrap().len(), revisions_before);
        assert!(store.rename_tree(&first_id, "   ").is_err());
        assert!(store.rename_tree("missing", "Anders").is_err());
        assert_eq!(store.read_tree(&first_id).unwrap().name, "Eins neu");
        drop(store);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn a_dynasty_stays_on_its_couple() {
        let root = root();
        let store = Store::new(root.clone()).unwrap();
        let mut family = f();
        family.unions[0].dynasty = Some(Dynasty {
            name: "Morgenstern".into(),
            logo: String::new(),
            corner: "right".into(),
        });
        let id = store.create_tree(&family, "Dynastie").unwrap();
        let loaded = store.read_tree(&id).unwrap();
        let dynasty = loaded.unions[0].dynasty.as_ref().unwrap();
        assert_eq!(dynasty.name, "Morgenstern");
        assert_eq!(dynasty.corner, "right");
        assert!(loaded.unions[1].dynasty.is_none());
        drop(store);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn a_dynasty_stays_on_its_person() {
        let root = root();
        let store = Store::new(root.clone()).unwrap();
        let mut family = f();
        family
            .members
            .iter_mut()
            .find(|p| p.id == "3")
            .unwrap()
            .dynasty = Some(Dynasty {
            name: "Morgenstern".into(),
            logo: String::new(),
            corner: "left".into(),
        });
        family
            .members
            .iter_mut()
            .find(|p| p.id == "4")
            .unwrap()
            .dynasty_with = vec!["3".into()];
        let id = store.create_tree(&family, "Person").unwrap();
        let loaded = store.read_tree(&id).unwrap();
        let thomas = loaded.members.iter().find(|p| p.id == "3").unwrap();
        let clara = loaded.members.iter().find(|p| p.id == "4").unwrap();
        assert_eq!(thomas.dynasty.as_ref().unwrap().name, "Morgenstern");
        assert_eq!(clara.dynasty_with, vec!["3".to_string()]);
        drop(store);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn migrates_existing_single_family_and_revision() {
        let root = root();
        fs::create_dir_all(&root).unwrap();
        let c = Connection::open(root.join("urinamu.sqlite")).unwrap();
        c.execute_batch("CREATE TABLE current(id INTEGER PRIMARY KEY,data TEXT NOT NULL);CREATE TABLE revisions(id INTEGER PRIMARY KEY,created TEXT NOT NULL,label TEXT NOT NULL,data TEXT NOT NULL);").unwrap();
        let data = serde_json::to_string(&f()).unwrap();
        c.execute("INSERT INTO current VALUES(1,?1)", [&data])
            .unwrap();
        c.execute(
            "INSERT INTO revisions VALUES(1,'2026-10-24T12:00:00Z','Alt',?1)",
            [&data],
        )
        .unwrap();
        drop(c);
        let store = Store::new(root.clone()).unwrap();
        assert_eq!(store.list_trees().unwrap().len(), 1);
        assert_eq!(store.load().unwrap().unwrap().name, "Familie Morgenstern");
        assert_eq!(store.history().unwrap().len(), 1);
        assert_eq!(store.revision(1).unwrap().members.len(), 11);
        drop(store);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn marriage_metadata_roundtrips_and_inconsistent_status_is_rejected() {
        let mut family = f();
        family.unions[0].marriage = "married".into();
        let encrypted = encrypt(&family, "langes-passwort").unwrap();
        assert_eq!(
            decrypt(&encrypted, "langes-passwort").unwrap().unions[0].marriage,
            "married"
        );
        family.unions[0].status = "separated".into();
        assert!(validate(&family).is_err());
        family.unions[0].marriage = "divorced".into();
        assert!(validate(&family).is_ok());
        family.unions[0].married_on = "1958-06-14".into();
        let encrypted = encrypt(&family, "langes-passwort").unwrap();
        assert_eq!(
            decrypt(&encrypted, "langes-passwort")
                .unwrap()
                .unions[0]
                .married_on,
            "1958-06-14"
        );
        family.unions[0].married_on = "1900-01-01".into();
        assert!(validate(&family).is_err());
        family.unions[0].married_on = "2016-01-01".into();
        assert!(validate(&family).is_err());
    }
}
#[cfg(test)]
mod file_compatibility_tests {
    use super::*;
    #[test]
    fn reads_independent_v2_reference() {
        let f = decrypt(
            include_str!("../../tests/fixtures/reference-v2.urinamu"),
            "fixture-passwort",
        )
        .unwrap();
        assert_eq!(f.name, "Referenzfamilie");
        assert_eq!(f.members.len(), 3);
        assert_eq!(f.members[2].parents, vec!["m", "f"]);
    }
    #[test]
    fn reads_actual_old_browser_export() {
        let f = decrypt(
            include_str!("../../tests/fixtures/prototype-v1.wurzeln"),
            "ein-sicheres-passwort",
        )
        .unwrap();
        assert_eq!(f.members.len(), 11);
    }
    #[test]
    fn birth_names_survive_database_and_encrypted_exchange() {
        let mut family: Family = serde_json::from_str(include_str!("../../src/demo.json")).unwrap();
        assert!(family.members[0].birth_name.is_empty());
        family.members[0].first_name = "Anna Maria".into();
        family.members[0].last_name = "von Berg".into();
        family.members[0].birth_name = "Müller".into();
        family.members[0].name = "Anna Maria von Berg".into();
        let encrypted = encrypt(&family, "fixture-passwort").unwrap();
        let restored = decrypt(&encrypted, "fixture-passwort").unwrap();
        assert_eq!(restored.members[0].birth_name, "Müller");
        assert_eq!(restored.members[0].last_name, "von Berg");
        let root =
            std::env::temp_dir().join(format!("urinamu-name-test-{}", random_u64().unwrap()));
        let store = Store::new(root.clone()).unwrap();
        store.save(&family, "Geburtsname").unwrap();
        assert_eq!(
            store.load().unwrap().unwrap().members[0].birth_name,
            "Müller"
        );
        drop(store);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn layout_positions_survive_storage_and_exchange_and_validate() {
        let mut family: Family = serde_json::from_str(include_str!("../../src/demo.json")).unwrap();
        assert!(family.members[0].positions.is_empty());
        family.members[0].positions.insert(
            "tapestry".into(),
            Position {
                x: -475.5,
                y: 310.25,
            },
        );
        let encrypted = encrypt(&family, "fixture-passwort").unwrap();
        let restored = decrypt(&encrypted, "fixture-passwort").unwrap();
        assert_eq!(restored.members[0].positions["tapestry"].x, -475.5);
        let root =
            std::env::temp_dir().join(format!("urinamu-position-test-{}", random_u64().unwrap()));
        let store = Store::new(root.clone()).unwrap();
        store.save(&family, "Verschoben").unwrap();
        let loaded = store.load().unwrap().unwrap();
        assert_eq!(loaded.members[0].positions["tapestry"].y, 310.25);
        family.members[0].positions.insert(
            "classic".into(),
            Position {
                x: f64::NAN,
                y: 0.0,
            },
        );
        assert!(validate(&family).is_err());
        family.members[0].positions.remove("classic");
        family.members[0]
            .positions
            .insert("unknown".into(), Position { x: 0.0, y: 0.0 });
        assert!(validate(&family).is_err());
        drop(store);
        fs::remove_dir_all(root).unwrap();
    }
}
