"""Read registry metadata only; package code is never executed by this audit."""
import concurrent.futures,json,urllib.request,urllib.parse
from release_policy import ROOT,policy,eligible
lock=json.loads((ROOT/'package-lock.json').read_text());packages={(p.split('node_modules/')[-1],v['version']) for p,v in lock['packages'].items() if p}
def check(p):
 name,version=p
 with urllib.request.urlopen('https://registry.npmjs.org/'+urllib.parse.quote(name,safe=''),timeout=90) as r:metadata=json.load(r)
 published=metadata['time'][version]
 if policy().get('stableOnly') and '-' in version.split('+')[0]:raise ValueError(f'Prerelease nicht zulässig: {name}@{version}')
 if not eligible(published):raise ValueError(f'Zu jung: {name}@{version}: {published}')
 return {'ecosystem':'npm','name':name,'version':version,'published':published}
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:rows=list(pool.map(check,sorted(packages)))
(ROOT/'docs/npm-release-audit.json').write_text(json.dumps({'cutoff':policy()['cutoff'],'evaluatedAt':policy()['evaluatedAt'],'packages':rows},indent=2)+'\n')
print(f'PASS: {len(rows)} npm versions published before {policy()["cutoff"]}')
