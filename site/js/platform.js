/* Peerless platform layer.
   The app was written against the Claude artifact runtime: use("db"), use("sample"), use("mcp").
   This file gives it the same three services on free infrastructure:
     db     Firebase Firestore (Spark plan) under users/{uid}, or this browser's storage in local mode
     sample Gemini API free tier, with the key stored in your own record
     mcp    Google Drive REST, with the token from your Google sign-in
   It also owns sign-in, the service worker, install, and morning push. */
(function(){
"use strict";
const CFG=window.PEERLESS_CONFIG||{};
const LS="peerless:";
const GSCOPE="https://www.googleapis.com/auth/drive";
const lsGet=k=>{try{return localStorage.getItem(LS+k);}catch(e){return null;}};
const lsSet=(k,v)=>{try{if(v==null)localStorage.removeItem(LS+k);else localStorage.setItem(LS+k,v);}catch(e){}};
const err=(code,extra)=>Object.assign(new Error(code),{code:code},extra||{});

const P={mode:CFG.firebase?"cloud":"local",user:null,uid:null,settings:{},onChange:null,installEvt:null,pushMsg:"",driveMsg:"",keyMsg:""};
const changed=()=>{if(typeof P.onChange==="function")P.onChange();};

/* ---------- local db: same surface as the Firestore calls the app makes ---------- */
function localDb(){
 const subs={};const fire=path=>{(subs[path]||[]).forEach(f=>f());const col=path.split("/")[0];(subs["col:"+col]||[]).forEach(f=>f());};
 const read=path=>{const v=lsGet("db/"+path);return v?JSON.parse(v):null;};
 const keys=()=>{const out=[];try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.indexOf(LS+"db/")===0)out.push(k.slice((LS+"db/").length));}}catch(e){}return out;};
 const on=(key,fn)=>{(subs[key]=subs[key]||[]).push(fn);setTimeout(fn,0);return()=>{subs[key]=subs[key].filter(f=>f!==fn);};};
 return {
  doc:path=>({
   set:async d=>{lsSet("db/"+path,JSON.stringify(d));fire(path);},
   delete:async()=>{lsSet("db/"+path,null);fire(path);},
   onSnapshot:(cb)=>on(path,()=>{const v=read(path);cb({exists:v!=null,data:()=>v});})}),
  collection:name=>({onSnapshot:(cb)=>on("col:"+name,()=>{
   const docs=keys().filter(k=>k.split("/")[0]===name&&k.split("/").length===2).map(k=>{const v=read(k);return {id:k.split("/")[1],data:()=>v};});
   cb({docs:docs});})})};
}

/* ---------- Firebase ---------- */
function loadScript(src){return new Promise((ok,no)=>{const s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=()=>no(err("sdk_load_failed"));document.head.append(s);});}
let fb=null,fs=null,auth=null,provider=null;
async function loadFirebase(){
 const v=CFG.firebaseSdk||"10.14.1",base="https://www.gstatic.com/firebasejs/"+v+"/";
 await loadScript(base+"firebase-app-compat.js");
 await Promise.all([loadScript(base+"firebase-auth-compat.js"),loadScript(base+"firebase-firestore-compat.js")]);
 fb=window.firebase;fb.initializeApp(CFG.firebase);
 auth=fb.auth();fs=fb.firestore();
 try{await fs.enablePersistence({synchronizeTabs:true});}catch(e){}
 provider=new fb.auth.GoogleAuthProvider();provider.addScope(GSCOPE);
}
function keepToken(result){const c=result&&result.credential;if(c&&c.accessToken){lsSet("gtoken",JSON.stringify({t:c.accessToken,exp:Date.now()+50*60000}));}}
function token(){const v=lsGet("gtoken");if(!v)return null;try{const o=JSON.parse(v);return o.exp>Date.now()?o.t:null;}catch(e){return null;}}
function scoped(){const root="users/"+P.uid+"/";return {doc:p=>fs.doc(root+p),collection:p=>fs.collection(root+p)};}

function gate(){return new Promise(resolve=>{
 const box=document.createElement("div");box.className="gate";box.setAttribute("role","dialog");box.setAttribute("aria-label","Sign in");
 const msg=document.createElement("p");msg.className="small quiet";
 const b=document.createElement("button");b.className="act fill";b.textContent="Sign in with Google";
 b.onclick=async()=>{msg.textContent="";try{const r=await auth.signInWithPopup(provider);keepToken(r);}catch(e){
  msg.textContent=e&&e.code==="auth/popup-blocked"?"The sign-in window was blocked. Allow pop-ups for this site, then tap again.":"Sign-in did not finish ("+(e&&e.code||"error")+"). Tap again.";}};
 const h1=document.createElement("h2");h1.textContent="Peerless Daily";
 const p=document.createElement("p");p.textContent="Sign in to load your record. It is stored in your own Firebase project and nobody else can read it.";
 const card=document.createElement("div");card.className="gatecard";card.append(h1,p,b,msg);box.append(card);
 document.body.append(box);
 const stop=auth.onAuthStateChanged(u=>{if(u){box.remove();stop();resolve(u);}});
});}

/* ---------- Gemini ---------- */
function geminiKey(){return P.mode==="cloud"?(P.settings.geminiKey||""):(lsGet("geminiKey")||"");}
const gem=CFG.gemini||{};
async function callGemini(model,prompt){
 let r;
 try{r=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent",{method:"POST",
  headers:{"Content-Type":"application/json","x-goog-api-key":geminiKey()},
  body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",temperature:0.2}})});}
 catch(e){throw err("network");}
 const body=await r.json().catch(()=>({}));
 if(!r.ok){const m=(body.error&&body.error.message)||"";
  if(r.status===404)throw err("model_not_found");
  if(r.status===429)throw err("rate_limited");
  if(r.status===400&&/API key|API_KEY/i.test(m))throw err("bad_key");
  if(r.status===400&&/token|too long|exceeds/i.test(m))throw err("prompt_too_large");
  if(r.status===403)throw err("bad_key");
  throw err("gemini_"+r.status);}
 if(body.promptFeedback&&body.promptFeedback.blockReason)throw err("refused");
 const c=body.candidates&&body.candidates[0];
 if(!c||c.finishReason==="SAFETY"||c.finishReason==="PROHIBITED_CONTENT")throw err("refused");
 let t=((c.content&&c.content.parts)||[]).map(p=>p.text||"").join("").trim();
 t=t.replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/,"");
 try{return JSON.parse(t);}catch(e){throw err("invalid_json");}
}
const sample={json:async(prompt,opts)=>{
 if(!geminiKey())throw err("no_key");
 const m=opts&&opts.modelTier==="quick"?(gem.quickModel||gem.model):(P.settings.geminiModel||gem.model);
 try{return await callGemini(m,prompt);}
 catch(e){if(e.code==="model_not_found"&&gem.fallbackModel&&m!==gem.fallbackModel)return callGemini(gem.fallbackModel,prompt);throw e;}
}};

/* ---------- Google Drive, shaped like the Drive connector the app was built on ---------- */
async function gd(url,init){
 const t=token();if(!t)throw err("needs_reauth",{server:true});
 let r;try{r=await fetch(url,Object.assign({},init,{headers:Object.assign({Authorization:"Bearer "+t},(init&&init.headers)||{})}));}catch(e){throw err("server_unavailable",{server:true});}
 if(r.status===401){lsSet("gtoken",null);throw err("needs_reauth",{server:true});}
 if(r.status===403){const b=await r.json().catch(()=>({}));const m=JSON.stringify(b);if(/rate|quota/i.test(m))throw err("rate_limited",{server:true});throw err("not_granted",{server:true});}
 if(r.status===429)throw err("rate_limited",{server:true});
 if(r.status>=500)throw err("server_unavailable",{server:true});
 if(!r.ok)throw err("drive_"+r.status,{server:true});
 return r;
}
const DAPI="https://www.googleapis.com/drive/v3/files";
const TEXTY=/^text\/|json|xml|markdown|csv/;
const drive={callTool:async(server,tool,input)=>{
 if(tool==="search_files"){
  const m=/parentId\s*=\s*'([^']+)'/.exec(input.query||"");if(!m)throw err("bad_query");
  const q=encodeURIComponent("'"+m[1]+"' in parents and trashed = false");
  const r=await gd(DAPI+"?q="+q+"&pageSize="+(input.pageSize||50)+"&orderBy=modifiedTime desc&fields=files(id,name,mimeType,webViewLink,modifiedTime)&supportsAllDrives=true&includeItemsFromAllDrives=true");
  const b=await r.json();return {payload:{files:(b.files||[]).map(f=>({id:f.id,title:f.name,mimeType:f.mimeType,viewUrl:f.webViewLink,modifiedTime:f.modifiedTime}))}};}
 if(tool==="read_file_content"){
  const id=encodeURIComponent(input.fileId);
  const meta=await (await gd(DAPI+"/"+id+"?fields=mimeType,name&supportsAllDrives=true")).json();
  if(meta.mimeType==="application/vnd.google-apps.document")return {payload:{content:await (await gd(DAPI+"/"+id+"/export?mimeType=text/plain")).text()}};
  if(TEXTY.test(meta.mimeType||""))return {payload:{content:await (await gd(DAPI+"/"+id+"?alt=media")).text()}};
  /* PDFs and Word files: Drive converts a copy to a Google Doc, we read its text, then delete the copy. */
  const copy=await (await gd(DAPI+"/"+id+"/copy?fields=id",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"peerless-temp "+meta.name,mimeType:"application/vnd.google-apps.document"})})).json();
  try{return {payload:{content:await (await gd(DAPI+"/"+copy.id+"/export?mimeType=text/plain")).text()}};}
  finally{gd(DAPI+"/"+copy.id,{method:"DELETE"}).catch(()=>{});}}
 if(tool==="create_file"){
  const bd="peerless"+Date.now().toString(36);
  const meta={name:input.title,mimeType:input.contentMimeType||"text/plain",parents:input.parentId?[input.parentId]:undefined};
  const body="--"+bd+"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"+JSON.stringify(meta)+"\r\n--"+bd+"\r\nContent-Type: "+(input.contentMimeType||"text/plain")+"; charset=UTF-8\r\n\r\n"+(input.textContent||"")+"\r\n--"+bd+"--";
  const r=await gd("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink",{method:"POST",headers:{"Content-Type":"multipart/related; boundary="+bd},body:body});
  return {payload:await r.json()};}
 throw err("unknown_tool");
}};
async function connectDrive(){
 P.driveMsg="";
 try{const r=await auth.currentUser.reauthenticateWithPopup(provider);keepToken(r);P.driveMsg="Drive is connected for the next hour.";}
 catch(e){P.driveMsg="Drive did not connect ("+(e&&e.code||"error")+").";}
 changed();
}

/* ---------- service worker, install, push ---------- */
let swReg=null;
if("serviceWorker" in navigator){window.addEventListener("load",()=>{navigator.serviceWorker.register("sw.js").then(r=>{swReg=r;}).catch(()=>{});});}
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();P.installEvt=e;changed();});
const standalone=()=>(window.matchMedia&&matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true;
const isIOS=()=>/iPhone|iPad|iPod/.test(navigator.userAgent);
function b64u(s){const pad="=".repeat((4-s.length%4)%4);const raw=atob((s+pad).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
async function subId(endpoint){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(endpoint));return Array.from(new Uint8Array(d)).slice(0,12).map(b=>b.toString(16).padStart(2,"0")).join("");}
async function currentSub(){const r=swReg||await navigator.serviceWorker.ready;return r.pushManager.getSubscription();}
async function enablePush(){
 P.pushMsg="";
 try{
  if(!("PushManager" in window)){P.pushMsg=isIOS()&&!standalone()?"On iPhone, add the app to your Home Screen first, then open it from there and tap this again.":"This browser does not support push.";changed();return;}
  const perm=await Notification.requestPermission();
  if(perm!=="granted"){P.pushMsg="Notifications are blocked. Allow them in Settings for this app, then tap again.";changed();return;}
  const r=swReg||await navigator.serviceWorker.ready;
  const s=(await r.pushManager.getSubscription())||await r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(CFG.vapidPublicKey)});
  const j=s.toJSON();
  await fs.doc("users/"+P.uid+"/push/"+await subId(j.endpoint)).set({endpoint:j.endpoint,keys:j.keys,tz:Intl.DateTimeFormat().resolvedOptions().timeZone,ua:navigator.userAgent.slice(0,120),created:new Date().toISOString()});
  P.settings.pushOn=true;P.pushMsg="Morning push is on for this device. It arrives weekdays around 8:11 am.";
 }catch(e){P.pushMsg="Push did not turn on ("+(e&&(e.code||e.name)||"error")+").";}
 changed();
}
async function disablePush(){
 try{const s=await currentSub();if(s){await fs.doc("users/"+P.uid+"/push/"+await subId(s.endpoint)).delete();await s.unsubscribe();}P.settings.pushOn=false;P.pushMsg="Morning push is off for this device.";}
 catch(e){P.pushMsg="Could not turn push off ("+(e&&e.code||"error")+").";}
 changed();
}
async function pushState(){try{if(!("PushManager" in window)||!("serviceWorker" in navigator))return false;return !!(await currentSub());}catch(e){return false;}}

/* ---------- settings ---------- */
async function loadSettings(){
 if(P.mode!=="cloud")return;
 try{const s=await fs.doc("users/"+P.uid+"/private/settings").get();P.settings=s.exists?s.data():{};}catch(e){P.settings={};}
}
async function saveKey(v){
 v=(v||"").trim();P.keyMsg="";
 try{
  if(P.mode==="cloud"){await fs.doc("users/"+P.uid+"/private/settings").set({geminiKey:v},{merge:true});P.settings.geminiKey=v;}
  else lsSet("geminiKey",v||null);
  P.keyMsg=v?"Saved. Reload the app to turn on answer checking.":"Removed.";
 }catch(e){P.keyMsg="The key did not save ("+(e&&e.code||"error")+").";}
 changed();
}

function settingsNode(h){
 const out=h("div",{class:"sec",id:"settings"},h("h3",{text:"This app"}));
 if(P.mode==="local")out.append(h("p",{class:"small quiet",text:"Local mode. Your record is saved in this browser only. Add the Firebase settings to js/config.js to sync it to your account."}));
 else out.append(h("p",{class:"small quiet",text:"Signed in as "+(P.user&&P.user.email||"you")+". Your record syncs to your Firebase project."}));
 /* install */
 if(!standalone()){
  if(P.installEvt)out.append(h("div",{class:"row"},h("button",{class:"act",text:"Install on this device",onclick:async()=>{const e=P.installEvt;P.installEvt=null;e.prompt();await e.userChoice.catch(()=>{});changed();}})));
  else if(isIOS())out.append(h("p",{class:"small",text:"To install on iPhone: open this page in Safari, tap Share, then Add to Home Screen."}));
 }
 /* gemini */
 const has=!!geminiKey();
 out.append(h("label",{for:"gkey"},"Gemini API key "+(has?"(saved)":"(not set)"),h("input",{id:"gkey",type:"password",autocomplete:"off",placeholder:has?"Paste a new key to replace it":"Paste the key from aistudio.google.com"})),
  h("div",{class:"row"},h("button",{class:"act",text:"Save key",onclick:()=>saveKey(document.getElementById("gkey").value)}),has?h("button",{class:"plain",text:"Remove key",onclick:()=>saveKey("")}):null),
  P.keyMsg?h("p",{class:"small",text:P.keyMsg}):null,
  h("p",{class:"small quiet",text:"Gemini gives a second opinion on retrieval answers and builds lessons from Drive files. Free tier. Google may use free-tier prompts to improve its products, so the app sends it case items and your answers, never your reflections."}));
 if(P.mode==="cloud"){
  /* drive */
  out.append(h("div",{class:"row"},h("button",{class:"act",text:token()?"Reconnect Google Drive":"Connect Google Drive",onclick:connectDrive})),
   h("p",{class:"small quiet",text:token()?"Drive is connected. Google tokens last an hour, then this button renews it.":"Drive is not connected right now. Tap to connect it for the next hour."}),
   P.driveMsg?h("p",{class:"small",text:P.driveMsg}):null);
  /* push */
  if(CFG.vapidPublicKey){
   out.append(h("div",{class:"row"},P.settings.pushOn?h("button",{class:"act",text:"Turn off morning push",onclick:disablePush}):h("button",{class:"act",text:"Turn on morning push",onclick:enablePush})),
    P.pushMsg?h("p",{class:"small",text:P.pushMsg}):null);
  }
  out.append(h("div",{class:"row"},h("button",{class:"plain",text:"Sign out",onclick:async()=>{lsSet("gtoken",null);await auth.signOut();location.reload();}})));
 }
 return out;
}

/* ---------- boot ---------- */
const ready=(async()=>{
 if(P.mode!=="cloud")return {db:localDb()};
 try{await loadFirebase();}catch(e){return {db:null,error:"sdk"};}
 const u=auth.currentUser||await new Promise(res=>{const stop=auth.onAuthStateChanged(x=>{stop();res(x);});});
 P.user=u||await gate();P.uid=P.user.uid;
 await loadSettings();
 P.settings.pushOn=await pushState();
 return {db:scoped()};
})();

window.Peerless={
 get mode(){return P.mode;},
 set onChange(f){P.onChange=f;},
 use:async name=>{const r=await ready;
  if(name==="db")return r.db;
  if(name==="sample")return geminiKey()?sample:null;
  if(name==="mcp")return P.mode==="cloud"&&r.db?drive:null;
  return null;},
 settingsNode:settingsNode,
 connectDrive:()=>P.mode==="cloud"?connectDrive():null
};
})();
