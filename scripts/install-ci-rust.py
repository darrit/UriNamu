"""Install the pinned Rust SDK through a verified mature rustup into CI-local directories."""
import hashlib,json,os,pathlib,platform,subprocess,urllib.request
root=pathlib.Path(__file__).resolve().parents[1];p=json.loads((root/'dependency-policy.json').read_text())
from release_policy import eligible,policy
policy()
audit=json.loads((root/'docs/toolchain-release-audit.json').read_text())
for name,key in [('Rust','rust'),('rustup','rustup')]:
 record=next(t for t in audit['tools'] if t['name']==name)
 if record['version']!=p[key] or not eligible(record['published']):raise SystemExit(f'Unverified or too young toolchain: {name}')
runner=pathlib.Path(os.environ['RUNNER_TEMP'])/'urinamu-rust';bootstrap=runner/'bootstrap';bootstrap.mkdir(parents=True,exist_ok=True)
windows=platform.system()=='Windows';machine=platform.machine().lower()
if windows:host='aarch64-pc-windows-msvc' if machine in ['arm64','aarch64'] else 'x86_64-pc-windows-msvc'
elif platform.system()=='Darwin':host='aarch64-apple-darwin' if machine in ['arm64','aarch64'] else 'x86_64-apple-darwin'
else:host='aarch64-unknown-linux-gnu' if machine in ['arm64','aarch64'] else 'x86_64-unknown-linux-gnu'
name='rustup-init.exe' if windows else 'rustup-init';url=f'https://static.rust-lang.org/rustup/archive/{p["rustup"]}/{host}/{name}'
with urllib.request.urlopen(url,timeout=120) as r:data=r.read()
with urllib.request.urlopen(url+'.sha256',timeout=60) as r:expected=r.read().decode().split()[0]
if hashlib.sha256(data).hexdigest()!=expected:raise SystemExit('rustup checksum mismatch')
installer=bootstrap/name;installer.write_bytes(data);installer.chmod(0o755)
env={**os.environ,'CARGO_HOME':str(runner/'cargo'),'RUSTUP_HOME':str(runner/'toolchains'),'RUSTUP_INIT_SKIP_PATH_CHECK':'yes'}
subprocess.run([str(installer),'--default-toolchain',p['rust'],'--profile','minimal','--no-modify-path','-y'],env=env,check=True)
rustup=runner/'cargo/bin'/('rustup.exe' if windows else 'rustup');subprocess.run([str(rustup),'set','auto-self-update','disable'],env=env,check=True)
with open(os.environ['GITHUB_ENV'],'a',encoding='utf-8') as f:f.write(f'CARGO_HOME={env["CARGO_HOME"]}\nRUSTUP_HOME={env["RUSTUP_HOME"]}\n')
with open(os.environ['GITHUB_PATH'],'a',encoding='utf-8') as f:f.write(str(runner/'cargo/bin')+'\n')
print(f'Verified rustup {p["rustup"]}; installed Rust {p["rust"]} in isolated CI directory.')
