"""Propose latest stable releases older than seven days; never installs or updates code.
Review the proposal, apply compatible versions and cutoff, then audit locks and test.
"""
import concurrent.futures,datetime,json,re,tomllib,urllib.parse,urllib.request
from release_policy import ROOT,instant
now=datetime.datetime.now(datetime.timezone.utc);cutoff=now-datetime.timedelta(days=7)
def stable(v):return bool(re.fullmatch(r'\d+\.\d+\.\d+',v))
def key(v):return tuple(map(int,v.split('.')))
def old(date):return bool(date) and instant(date)<cutoff
def get(url):
 with urllib.request.urlopen(url,timeout=90) as r:return json.load(r)
def npm(name):
 d=get('https://registry.npmjs.org/'+urllib.parse.quote(name,safe=''))
 versions=[v for v,t in d['time'].items() if stable(v) and old(t) and v in d.get('versions',{}) and not d['versions'][v].get('deprecated')]
 version=max(versions,key=key);meta=d['versions'][version]
 return {'name':name,'version':version,'published':d['time'][version],'engines':meta.get('engines'),'peers':meta.get('peerDependencies')}
def crate(name):
 d=get('https://crates.io/api/v1/crates/'+name);v=max([v for v in d['versions'] if stable(v['num']) and old(v['created_at']) and not v['yanked']],key=lambda v:key(v['num']))
 return {'name':name,'version':v['num'],'published':v['created_at'],'minimumRust':v.get('rust_version')}
p=json.loads((ROOT/'package.json').read_text());cargo=tomllib.loads((ROOT/'src-tauri/Cargo.toml').read_text())
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 npm_versions=list(pool.map(npm,[*p['dependencies'],*p['devDependencies'],'npm']))
 crate_versions=list(pool.map(crate,[*cargo['dependencies'],*cargo['build-dependencies']]))
node=max([n for n in get('https://nodejs.org/dist/index.json') if n['lts'] and stable(n['version'][1:]) and old(n['date']+'T23:59:59Z')],key=lambda n:key(n['version'][1:]))
proposal={'evaluatedAt':now.isoformat(),'cutoff':cutoff.isoformat(),'nodeTrack':'latest mature LTS','node':node,'npm':npm_versions,'cargo':crate_versions,'notes':['Engine-/Peer-Kompatibilität und Rust-Toolchain zusätzlich prüfen.','Vorschlag ändert keine Dateien außer diesem Bericht und installiert nichts.','Nach Änderungen beide Lockdateien auditieren und Tests/Builds ausführen.']}
path=ROOT/'docs/dependency-proposal.json';path.write_text(json.dumps(proposal,indent=2)+'\n');print(json.dumps(proposal,indent=2));print('Written:',path)
