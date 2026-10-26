"""Resolve Cargo metadata, pin too-young transitive versions, then audit before fetch/build.
Run explicitly during a dependency update. Does not compile or install crate code.
"""
import json,os,pathlib,re,subprocess,sys,tomllib
from release_policy import ROOT,policy,eligible
manifest=ROOT/'src-tauri/Cargo.toml';marker='# BEGIN GENERATED RELEASE-AGE CONSTRAINTS'
base=manifest.read_text().split(marker)[0].rstrip()+'\n'
constraints={};log=[]
registry=pathlib.Path(os.environ.get('CARGO_HOME',pathlib.Path.home()/'.cargo'))/'registry/index'
def semver(v):return tuple(map(int,v.split('.')))
for attempt in range(12):
 if constraints:
  section='\n'+marker+'\n# Latest mature versions required by the locked dependency graph; no runtime dependencies.\n[target.\'cfg(any())\'.dependencies]\n'
  for alias,(name,version) in sorted(constraints.items()):section+=f'{alias} = {{ package = "{name}", version = "={version}" }}\n'
  manifest.write_text(base+section)
 else:manifest.write_text(base)
 subprocess.run(['cargo','update','--manifest-path',str(manifest)],check=True,cwd=ROOT)
 lock=tomllib.loads((ROOT/'src-tauri/Cargo.lock').read_text());bad=[]
 for p in lock['package']:
  if 'source' not in p:continue
  name=p['name'];v=p['version'];rel=f'1/{name}' if len(name)==1 else f'2/{name}' if len(name)==2 else f'3/{name[0]}/{name}' if len(name)==3 else f'{name[:2]}/{name[2:4]}/{name}'
  path=next(registry.glob('*/.cache/'+rel));versions=[json.loads(x) for x in path.read_bytes().split(b'\0') if x.startswith(b'{')];selected=next(x for x in versions if x['vers']==v)
  if eligible(selected.get('pubtime')):continue
  if not re.fullmatch(r'\d+\.\d+\.\d+',v):raise SystemExit(f'Cannot automatically constrain prerequisite {name}@{v}')
  major,minor,_=semver(v)
  candidates=[x for x in versions if re.fullmatch(r'\d+\.\d+\.\d+',x['vers']) and eligible(x.get('pubtime')) and not x.get('yanked') and semver(x['vers'])[0]==major and (major>0 or semver(x['vers'])[1]==minor)]
  if not candidates:raise SystemExit(f'No eligible compatible release for {name}@{v}; update its parent constraint explicitly.')
  target=max(candidates,key=lambda x:semver(x['vers']))['vers'];alias='age_'+name.replace('-','_')+'_'+str(major)+'_'+str(minor if major==0 else 0)
  bad.append((alias,name,v,target,selected.get('pubtime')))
 if not bad:
  (ROOT/'docs/cargo-age-exclusions.json').write_text(json.dumps({'cutoff':policy()['cutoff'],'excluded':log},indent=2)+'\n')
  subprocess.run([sys.executable,str(ROOT/'scripts/audit-cargo.py')],check=True,cwd=ROOT);break
 for alias,name,young,target,date in bad:
  constraints[alias]=(name,target);log.append({'name':name,'excludedVersion':young,'published':date,'selected':target})
else:raise SystemExit('Release-age resolution did not converge; no crate code was built.')
