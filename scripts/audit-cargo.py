"""Verify every Cargo-locked release against the recorded seven-day policy."""
import json,os,pathlib,tomllib
from release_policy import ROOT,policy,eligible
registry=pathlib.Path(os.environ.get('CARGO_HOME',pathlib.Path.home()/'.cargo'))/'registry/index'
lock=tomllib.loads((ROOT/'src-tauri/Cargo.lock').read_text())
rows=[];failures=[]
for p in lock['package']:
 if 'source' not in p:continue
 n=p['name'];relative=f'1/{n}' if len(n)==1 else f'2/{n}' if len(n)==2 else f'3/{n[0]}/{n}' if len(n)==3 else f'{n[:2]}/{n[2:4]}/{n}'
 matches=list(registry.glob('*/.cache/'+relative))
 if not matches:raise SystemExit(f'Release-Metadaten fehlen: {n}@{p["version"]}; zuerst cargo metadata --locked ausführen.')
 versions=[json.loads(x) for x in matches[0].read_bytes().split(b'\0') if x.startswith(b'{')]
 v=next(x for x in versions if x['vers']==p['version']);date=v.get('pubtime','')
 if policy().get('stableOnly') and '-' in p['version'].split('+')[0]:raise SystemExit(f'Prerelease nicht zulässig: {n}@{p["version"]}')
 if not eligible(date):failures.append((n,p['version'],date))
 rows.append({'ecosystem':'cargo','name':n,'version':p['version'],'published':date})
if failures:raise SystemExit('Zu jung oder unbekannt: '+json.dumps(failures))
(ROOT/'docs/cargo-release-audit.json').write_text(json.dumps({'cutoff':policy()['cutoff'],'evaluatedAt':policy()['evaluatedAt'],'packages':rows},indent=2)+'\n')
print(f'PASS: {len(rows)} Cargo versions published before {policy()["cutoff"]}')
