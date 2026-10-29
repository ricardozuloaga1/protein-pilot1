import {readFile,readdir,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import Database from 'better-sqlite3';
const email='ios-eval@proteinpilot.test';
const state=JSON.parse(await readFile('evaluation/private/simulator.json','utf8'));
if(state.port!==3101||!path.resolve(state.dataDir).startsWith(path.join(tmpdir(),'protein-pilot-simulator-eval-')))throw Error('Refusing non-evaluation environment');
const db=new Database(path.join(state.dataDir,'protein-pilot.sqlite'),{readonly:true});
const user=db.prepare('SELECT id FROM users WHERE email=?').get(email) as {id:string}|undefined;
if(!user)throw Error('Account already absent; no mutation performed');
const tables=['sessions','targets','target_guidance','meals','drafts','operations','jobs','ai_usage','favorites','plans','messages','support','exports','meal_photos'];
const counts=()=>Object.fromEntries(tables.map(t=>[t,(db.prepare(`SELECT count(*) n FROM ${t} WHERE user_id=?`).get(user.id) as any).n]));
const before=counts();
const base='http://127.0.0.1:3101';
async function call(route:string,method:string,body?:unknown,token?:string){const r=await fetch(base+route,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error(`${method} ${route}: HTTP ${r.status}`);return r.status===204?null:r.json();}
const started=Date.now();await call('/v1/auth/request-link','POST',{email});
const files=await readdir(path.join(state.dataDir,'mail'));let link:string|undefined;
for(const f of files){const full=path.join(state.dataDir,'mail',f);if((await stat(full)).mtimeMs<started-1000)continue;const row=JSON.parse(await readFile(full,'utf8'));if(row.to===email)link=row.link;}
if(!link)throw Error('No fresh intercepted sign-in link');
const auth=await call('/v1/auth/verify','POST',{token:new URL(link).hash.slice(7)});
const me=await call('/v1/me','GET',undefined,auth.accessToken);
if(me.email!==email||me.id!==user.id)throw Error('Account identity mismatch');
await call('/v1/me','DELETE',{confirmation:'DELETE MY ACCOUNT'},auth.accessToken);
const after=counts();const absent=!db.prepare('SELECT id FROM users WHERE id=?').get(user.id);
const revoked=(await fetch(base+'/v1/me',{headers:{authorization:`Bearer ${auth.accessToken}`}})).status===401;
const evidence={account:email,method:'normal authenticated API; native UI unavailable',before,after,accountAbsent:absent,sessionRevoked:revoked,pass:absent&&revoked&&Object.values(after).every(n=>n===0)};
await writeFile('evaluation/ios/deletion.json',JSON.stringify(evidence,null,2));db.close();
console.log(JSON.stringify(evidence));if(!evidence.pass)process.exitCode=1;
