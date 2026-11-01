"""Independent, static checks of local-test app ZIPs. No Gatekeeper claim."""
from pathlib import Path,PurePosixPath
import hashlib,json,os,plistlib,posixpath,stat,struct,zipfile
from build_mac_signature_helpers import code_directories

ROOT=Path(__file__).resolve().parents[1]
VERSION=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version']
RELEASE=ROOT/'release'/VERSION

def private_patterns():
    values=[str(Path.home()),str(ROOT),str(ROOT).replace('\\','/'),os.environ.get('USERNAME','')]
    user=Path(os.environ.get('APPDATA',str(Path.home())))/'uric-acid-companion/data.json'
    if user.exists():
        d=json.loads(user.read_text(encoding='utf-8'));values.append(d.get('profile',{}).get('clinicianNote',''))
        def collect(v,key=''):
            if key in ['provider','identity','permission']:return
            if isinstance(v,str) and len(v)>=8:values.append(v)
            elif isinstance(v,dict):
                for k,x in v.items():collect(x,k)
        collect(d.get('sync',{}))
    return [v.encode(e) for v in values if len(v)>=5 for e in ['utf-8','utf-16-le']]

def check(file):
    with zipfile.ZipFile(file) as z:
        infos={i.filename.rstrip('/'):i for i in z.infolist()}
        def resolve(name):
            for _ in range(40):
                parts=name.split('/');changed=False
                for at in range(1,len(parts)+1):
                    key='/'.join(parts[:at]);info=infos.get(key)
                    if info and stat.S_ISLNK(info.external_attr>>16):
                        name=posixpath.normpath(posixpath.join(posixpath.dirname(key),z.read(info).decode(),*parts[at:]));changed=True;break
                if not changed:return name
            raise ValueError('Symbolic link loop')
        def read(name):return z.read(infos[resolve(name)])
        def exists(name):return resolve(name) in infos
        def main_binary(bundle):
            if exists(bundle+'/Contents/Info.plist'):
                p=plistlib.loads(read(bundle+'/Contents/Info.plist'));return bundle+'/Contents/MacOS/'+p['CFBundleExecutable']
            p=plistlib.loads(read(bundle+'/Resources/Info.plist'));return bundle+'/'+p['CFBundleExecutable']
        fingerprints=private_patterns();privacy=[];resources=0;cdhashes=0;slots=0
        for name,info in infos.items():
            if info.is_dir() or stat.S_ISLNK(info.external_attr>>16):continue
            data=z.read(info)
            if any(pattern in data for pattern in fingerprints):privacy.append(name)
            directories=code_directories(data)
            if directories:
                parent=posixpath.dirname(name)
                if '/Contents/MacOS/' in name:
                    bundle=name.rsplit('/Contents/MacOS/',1)[0]+'/Contents'
                    outside={1:bundle+'/Info.plist',3:bundle+'/_CodeSignature/CodeResources'}
                else:outside={1:parent+'/Resources/Info.plist',3:parent+'/_CodeSignature/CodeResources'}
                for cd in directories:
                    for number,expected in cd['special'].items():
                        if not any(expected):continue
                        value=cd['blobs'].get(number)
                        if value is None and number in outside and exists(outside[number]):value=read(outside[number])
                        if value is None:raise ValueError('Unresolved special hash slot '+str(number)+' in '+name)
                        if hashlib.new(cd['algorithm'],value).digest()[:len(expected)]!=expected:raise ValueError('Special hash mismatch in '+name)
                        slots+=1
            if not name.endswith('/_CodeSignature/CodeResources'):continue
            envelope=plistlib.loads(data);base=name.rsplit('/_CodeSignature/',1)[0]
            for relative,entry in envelope.get('files2',{}).items():
                target=posixpath.normpath(base+'/'+relative)
                if not exists(target):
                    if isinstance(entry,dict) and entry.get('optional'):continue
                    raise ValueError('Missing sealed resource: '+target)
                if isinstance(entry,dict) and 'symlink' in entry:
                    raw=infos.get(target)
                    if not raw or not stat.S_ISLNK(raw.external_attr>>16) or z.read(raw).decode()!=entry['symlink']:raise ValueError('Sealed link mismatch')
                elif isinstance(entry,dict) and 'cdhash' in entry:
                    binary=main_binary(target) if infos[resolve(target)].is_dir() else target
                    candidates=code_directories(read(binary))
                    if entry['cdhash'] not in [c['cdhash'] for c in candidates]:raise ValueError('Nested code hash mismatch: '+target)
                    cdhashes+=1
                else:
                    raw=read(target)
                    for key,algo in [('hash','sha1'),('hash2','sha256')]:
                        if isinstance(entry,dict) and key in entry and hashlib.new(algo,raw).digest()!=entry[key]:raise ValueError('Sealed file hash mismatch: '+target)
                    resources+=1
        if privacy:raise ValueError('Private fingerprint found in '+str(len(privacy))+' files')
        return {'file':file.name,'privateMatches':0,'sealedResourcesChecked':resources,'nestedCodeHashesChecked':cdhashes,'specialHashSlotsChecked':slots,'appleNotarized':False,'testedOnMac':False}

results=[check(f) for f in sorted(RELEASE.glob('*-Mac-*-试用版.zip'))]
if len(results)!=2:raise ValueError('Expected both Mac architectures')
(RELEASE/'Mac隐私与签名结构检查.json').write_text(json.dumps({'ok':True,'scope':'static content hashes, resource seals and private fingerprints; no Apple trust or Mac runtime test','results':results},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'ok':True,'results':results},ensure_ascii=True))
