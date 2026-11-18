(function(){
"use strict";
const GAPS=[1,3,7,14,30,60];
const DRIVE="Google Drive";
const FOLDER={root:"1MFTpH7kpazLqm5udkXkRVVOiZ_CSD1bG",briefs:"1Qhyig9RdyTBeoxVBHZMoWv1iIwuEK-kk",sources:"1SQty1GSFx_43ClNQECFv3qyloQrxDSQL",exports:"1-dhlGmDPGiC47macsaUwLT4pst5xMplG"};
const FOLDER_URL=id=>"https://drive.google.com/drive/folders/"+id;
const $=s=>document.querySelector(s);
function h(tag,attrs){const e=document.createElement(tag);if(attrs)for(const k in attrs){const v=attrs[k];if(v==null||v===false)continue;if(k==="class")e.className=v;else if(k==="text")e.textContent=v;else if(k.slice(0,2)==="on")e.addEventListener(k.slice(2),v);else e.setAttribute(k,v===true?"":v);}
 for(let i=2;i<arguments.length;i++){const c=arguments[i];if(c==null||c===false)continue;if(Array.isArray(c))c.forEach(x=>x&&e.append(x));else e.append(c);}return e;}
const pad=n=>String(n).padStart(2,"0");
const ymd=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parse=s=>{const p=s.split("-").map(Number);return new Date(p[0],p[1]-1,p[2]);};
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return ymd(d);};
const dow=s=>parse(s).getDay();
const isWeekend=s=>dow(s)===0||dow(s)===6;
const roll=s=>{while(isWeekend(s))s=addDays(s,1);return s;};
const diff=(a,b)=>Math.round((parse(a)-parse(b))/86400000);
const nice=s=>parse(s).toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});
const long=s=>parse(s).toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});
const monday=s=>addDays(s,-((dow(s)+6)%7));
const clone=o=>JSON.parse(JSON.stringify(o||{}));
const today=ymd(new Date());

let db=null,sample=null,mcp=null,dbState="wait";
const S={items:{},lessons:{},days:{},fc:{},sets:{},sync:{}};
const loaded={items:false,lessons:false,days:false,fc:false,sets:false,sync:false};
const allLoaded=()=>Object.keys(loaded).every(k=>loaded[k]);
const ui={tab:"today",sel:today,week:monday(today),open:null,moreLesson:false,fcErr:"",confirmDel:null,copied:false,
  drive:{state:"idle",msg:"",sources:[],checked:false},jobs:{},exportMsg:""};
let R=null;

/* ---------- content registry: built-in sets plus sets built from Drive ---------- */
let SETLIST=[],LESSON_ALL=[],ITEM_ALL=[],itemById={},lessonById={};
function rebuild(){
 SETLIST=SPRINTS.map(sp=>({id:sp.p,prefix:sp.p,title:sp.name,kind:"sprint",skill:sp.skill,n:sp.n,start:sp.start,end:sp.end,url:BRIEF_URL[sp.p]}));
 LESSON_ALL=LESSONS.slice();ITEM_ALL=ITEMS.slice();
 Object.keys(S.sets).sort((a,b)=>(S.sets[a].created||"")<(S.sets[b].created||"")?-1:1).forEach(k=>{const s=S.sets[k];if(!s||!s.prefix||!Array.isArray(s.lessons))return;
  SETLIST.push({id:k,prefix:s.prefix,title:s.title,kind:s.kind||"library",skill:s.skill||"",n:s.n,start:s.start,end:s.end,url:s.url,active:s.active!==false,dynamic:true});
  s.lessons.forEach(l=>LESSON_ALL.push(Object.assign({},l,{b:s.prefix})));
  (s.items||[]).forEach(i=>ITEM_ALL.push([i.id,i.lesson,i.q,i.a]));});
 ["L","S","T"].forEach(p=>SETLIST.push({id:p,prefix:p,title:BANKS[p],kind:"standing",url:BRIEF_URL.STD}));
 itemById={};ITEM_ALL.forEach(i=>itemById[i[0]]=i);lessonById={};LESSON_ALL.forEach(l=>lessonById[l.id]=l);
}
const prefix=id=>id.split("-")[0];
const setByPrefix=p=>SETLIST.find(s=>s.prefix===p);
const liveSprints=d=>SETLIST.filter(s=>s.kind==="sprint"&&s.start&&s.start<=d&&diff(d,s.end||s.start)<=14);
function activeSets(){return liveSprints(today).concat(SETLIST.filter(s=>s.kind==="library"&&s.active));}

/* ---------- saving: one write at a time per document ---------- */
const pending={},busy={};
function save(path,data){if(!db)return;pending[path]=clone(data);if(!busy[path])flush(path);}
async function flush(path){busy[path]=true;try{while(path in pending){const d=pending[path];delete pending[path];
  if(d&&d.__delete)await db.doc(path).delete();else await db.doc(path).set(d);}}
 catch(e){note("A change did not save ("+(e&&e.code||"error")+"). Check your connection, then make the change again.");delete pending[path];}
 finally{busy[path]=false;}}
const writing=path=>busy[path]||(path in pending);
function note(t){const n=$("#note");if(!t){n.hidden=true;n.textContent="";}else{n.hidden=false;n.textContent=t;}}

/* ---------- state helpers ---------- */
const day=d=>S.days[d]||{};
function setDay(d,patch){S.days[d]=Object.assign({},day(d),patch);save("days/"+d,S.days[d]);}
const saveItems=()=>save("state/items",{m:S.items});
const saveLessons=()=>save("state/lessons",{done:S.lessons});
const saveSync=()=>save("state/sync",S.sync);
const hasRefl=D=>!!(D.r1||D.r2||D.r3);

function buildQueue(){
 const due=ITEM_ALL.filter(i=>{const s=S.items[i[0]];return s&&s.d<=today&&s.l!==today&&!(s.i===today&&!s.a);})
   .sort((a,b)=>S.items[a[0]].d<S.items[b[0]].d?-1:1).slice(0,8).map(i=>({id:i[0],kind:"q"}));
 const fresh=ITEM_ALL.filter(i=>i[1]&&S.lessons[i[1]]&&!S.items[i[0]]).slice(0,Math.max(0,10-due.length)).map(i=>({id:i[0],kind:"q"}));
 const introd=Object.keys(S.items).filter(k=>S.items[k].i===today).length;
 const std=ITEM_ALL.filter(i=>!i[1]&&!S.items[i[0]]).sort((a,b)=>{const x=a[0].split("-")[1],y=b[0].split("-")[1];return x<y?-1:x>y?1:0;})
   .slice(0,Math.max(0,2-introd)).map(i=>({id:i[0],kind:"intro"}));
 return due.concat(fresh,std);
}
function record(id,ok,conf){
 const it=Object.assign({s:0,a:0,c:0},S.items[id]);
 if(ok){it.s=it.s+1;it.d=roll(addDays(today,GAPS[Math.min(it.s,6)-1]));}else{it.s=0;it.d=roll(addDays(today,1));}
 it.l=today;it.r=ok?1:0;it.a=it.a+1;it.c=it.c+(ok?1:0);if(conf)it.k=conf;S.items[id]=it;saveItems();
 const d=day(today),by=clone(d.by),p=prefix(id);by[p]=by[p]||{a:0,c:0};by[p].a++;by[p].c+=ok?1:0;
 const cal=clone(d.cal);if(conf){cal[conf]=cal[conf]||{a:0,c:0};cal[conf].a++;cal[conf].c+=ok?1:0;}
 setDay(today,{asked:(d.asked||0)+1,correct:(d.correct||0)+(ok?1:0),by:by,cal:cal});
}
function nextLesson(){
 let best=null,bestDone=1e9;
 activeSets().forEach(s=>{const ls=LESSON_ALL.filter(l=>l.b===s.prefix),left=ls.filter(l=>!S.lessons[l.id]),done=ls.length-left.length;
  if(left.length&&done<bestDone){best=left[0];bestDone=done;}});
 return best;
}
function sprintLine(sp){
 const n=diff(today,sp.start)+1;let step;
 if(n<=2)step="First pass. Read the brief and its first worked example, then take the first lessons.";
 else if(n<=11)step="Use the method on your live VantageScore problem. Retrieval keeps running each morning.";
 else if(n<=14)step="Teach it to your direct report. Record it or write it out so it can be graded.";
 else step="Past its end date. The Monday session runs the mastery check.";
 return {n:n,step:step};
}

/* ---------- Gemini as second opinion ---------- */
const HIDE=["no_key","bad_key","not_granted","sampling_disabled","not_declared","capability_disabled","capability_removed"];
async function grade(entry){
 if(!sample)return;const it=itemById[entry.id];
 const prompt="You are checking one short case-diagnosis item. Be strict on the substance and lenient on wording. "
  +"The answer is correct only if it names the same diagnosis as the reference answer and gives the same reason. Naming the right concept without the reason is a miss. "
  +"Reply with only a JSON object like {\"correct\":true,\"note\":\"one short sentence on what was right or missing\"}.\n\n"
  +"Case: "+it[2]+"\nReference answer: "+it[3]+"\nLearner's answer: "+(R.ans||"(blank)");
 try{const v=await sample.json(prompt,{modelTier:"quick",cache:false});
  if(R&&R.queue[R.i]===entry&&v&&typeof v.correct==="boolean"){R.verdict={correct:v.correct,note:String(v.note||"")};render(true);}}
 catch(e){if(e&&HIDE.indexOf(e.code)>=0)sample=null;if(R&&R.queue[R.i]===entry){R.verdict={failed:true};render(true);}}
}

/* ---------- Google Drive: briefs in, sources in, record out ---------- */
function driveCopy(e){const c=e&&e.code;
 if(c==="needs_reauth")return "Google Drive needs reconnecting. Tap Connect Google Drive under This app, below.";
 if(c==="server_not_connected"||c==="selection_required")return "Google Drive is not connected. Sign in, then tap Connect Google Drive under This app.";
 if(c==="not_in_manifest"||c==="approval_required"||c==="consent_required"||c==="not_granted")return "Drive refused the request. Tap Connect Google Drive and allow full Drive access.";
 if(c==="blocked_by_policy")return "Your organization blocks this Drive action.";
 if(c==="server_unavailable"||c==="rate_limited")return "Google Drive did not answer. Try again in a minute.";
 return "The Drive call failed ("+(c||"error")+").";}
async function drive(tool,input){const r=await mcp.callTool(DRIVE,tool,input);return r;}
function textOf(r){const p=r&&r.payload;if(typeof p==="string")return p;
 if(p&&typeof p==="object"){for(const k of ["content","text","fileContent","markdown","body"])if(typeof p[k]==="string")return p[k];}
 const t=(r&&r.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n");return t||(p?JSON.stringify(p):"");}
const filesOf=r=>{const p=r&&r.payload;const a=p&&(p.files||p.results)||(Array.isArray(p)?p:[]);return a.filter(f=>f&&f.id&&f.mimeType!=="application/vnd.google-apps.folder");};
const setIdFor=f=>"d"+String(f.id).replace(/[^A-Za-z0-9_-]/g,"_");
async function checkDrive(manual){
 if(!mcp){ui.drive={state:"off",msg:"This view cannot reach your connectors.",sources:[],checked:true};render();return;}
 ui.drive.state="busy";ui.drive.msg="";render();
 try{
  const q=id=>({query:"parentId = '"+id+"'",pageSize:50,excludeContentSnippets:true});
  const briefs=filesOf(await drive("search_files",q(FOLDER.briefs)));
  const sources=filesOf(await drive("search_files",q(FOLDER.sources)));
  ui.drive={state:"ok",msg:"",sources:sources,checked:true,at:Date.now()};render();
  for(const f of briefs){if(!S.sets[setIdFor(f)]&&!ui.jobs[f.id])await build(f,"sprint");}
 }catch(e){ui.drive={state:"err",msg:driveCopy(e),sources:ui.drive.sources||[],checked:true};render();}
}
function freePrefix(want){const used=new Set(SETLIST.map(s=>s.prefix));let p=(want||"").toUpperCase().replace(/[^A-Z]/g,"").slice(0,3);
 if(p.length>=2&&!used.has(p))return p;for(let i=1;i<200;i++){p="X"+i;if(!used.has(p))return p;}return "X"+Date.now();}
async function build(file,kind){
 const job=m=>{ui.jobs[file.id]=m;render();};
 if(!sample){job("Add a Gemini key under This app to build lessons from Drive files.");return;}
 try{
  job("Reading "+file.title);
  let text=textOf(await drive("read_file_content",{fileId:file.id}));
  if(!text||text.length<400){job("That file had too little readable text. PDFs, Word files, Google Docs, and text files work.");return;}
  const cut=text.length>150000;text=text.slice(0,150000);
  const meta={n:(text.match(/sprint:\s*(\d+)/i)||[])[1],skill:((text.match(/skill:\s*([^|\n]+)/i)||[])[1]||"").trim(),
   start:(text.match(/start:\s*(\d{4}-\d{2}-\d{2})/i)||[])[1],end:(text.match(/end:\s*(\d{4}-\d{2}-\d{2})/i)||[])[1],
   prefix:(text.match(/prefix:\s*([A-Za-z]{2,3})\b/i)||[])[1],doc:(text.match(/doc:\s*(https:\/\/\S+)/i)||[])[1]};
  if(kind==="sprint"&&!meta.start)kind="library";
  job("Writing lessons from "+file.title+". This can take two minutes.");
  const rules="Write in plain text. Short sentences. No em dashes, no semicolons, no markdown, straight quotes, Oxford commas. No praise and no filler.";
  const shape="Reply with only one JSON object of this shape: {\"title\":\"short name of the source\",\"lessons\":[{\"t\":\"lesson title\",\"g\":\"evidence grade as the source states it, or Not graded\",\"body\":\"80 to 130 words teaching one claim or one method step\",\"ex\":\"Composite example. One short case set in corporate government affairs or investor relations at a credit scoring company\",\"miss\":\"the one mistake people most often make\"}],\"items\":[{\"lesson\":0,\"q\":\"short-answer question that ends with a why question\",\"a\":\"reference answer in one to three sentences\"}]}. The lesson field is the zero-based index of the lesson that teaches the item.";
  const task=kind==="sprint"
   ?"Below is a sprint brief from a personal training program. Turn it into 6 to 10 short lessons that follow the brief's own order of claims and method steps, and into retrieval items. Use the brief's own retrieval bank and its answers for the items, lightly shortened, and map each to the lesson that teaches it. Keep every evidence grade exactly as the brief states it. Examples must be new composites and must differ from the brief's worked examples. Include one last lesson on the brief's strongest objection."
   :"Below is source material the learner wants to study. Turn it into 5 to 9 short lessons, each teaching one claim or one method step from the source, in the source's order, and write 2 retrieval items per lesson. Teach only what the source says. Do not add evidence grades of your own. If the source states how strong its evidence is, repeat that, otherwise set g to \"Not graded. Taken from the source as written.\" Add one last lesson on the strongest objection to the source's argument.";
  const out=await sample.json(task+"\n\n"+rules+"\n\n"+shape+"\n\nSOURCE FILE: "+file.title+"\n\n"+text,{cache:false});
  const ls=out&&Array.isArray(out.lessons)?out.lessons.filter(l=>l&&l.t&&l.body):[];
  if(ls.length<2)throw {code:"invalid_json"};
  const p=freePrefix(meta.prefix||String(out.title||file.title).split(/\s+/).map(w=>w[0]).join(""));
  const lessons=ls.slice(0,12).map((l,i)=>({id:p+(i+1),t:String(l.t),g:String(l.g||"Not graded"),body:String(l.body),ex:String(l.ex||""),miss:String(l.miss||"")}));
  let k=0;const items=(Array.isArray(out.items)?out.items:[]).filter(x=>x&&x.q&&x.a&&lessons[x.lesson]).slice(0,30)
   .map(x=>({id:p+"-"+pad(++k),lesson:lessons[x.lesson].id,q:String(x.q),a:String(x.a)}));
  const id=setIdFor(file);
  S.sets[id]={title:String(out.title||file.title).slice(0,80),kind:kind,prefix:p,fileId:file.id,url:meta.doc||file.viewUrl||"",skill:meta.skill||"",
   n:meta.n?Number(meta.n):null,start:meta.start||null,end:meta.end||null,active:true,created:today,cut:cut,lessons:lessons,items:items};
  save("sets/"+id,S.sets[id]);rebuild();delete ui.jobs[file.id];R=null;render();
 }catch(e){
  if(e&&HIDE.indexOf(e.code)>=0)sample=null;
  ui.jobs[file.id]=e&&e.code==="invalid_json"?"Gemini's lessons came back malformed. Tap Build again."
   :e&&e.code==="refused"?"Gemini declined this file."
   :e&&e.code==="prompt_too_large"?"That file is too long. Split it into chapters and add those."
   :e&&e.code==="rate_limited"?"You have hit a usage limit. Try again later."
   :e&&(e.server||/server|reauth|manifest|approval/.test(e.code||""))?driveCopy(e):"Building failed ("+(e&&e.code||"error")+"). Tap Build again.";
  render();
 }
}
function exportText(){
 const out=["PEERLESS APP EXPORT","generated: "+new Date().toISOString(),"local date: "+today,"",
  "DAILY LOG, last 21 days","date | regulation | strengths | trained | wake | sprint work | retrieval correct/asked | learned | code tested | change tomorrow"];
 for(let n=20;n>=0;n--){const d=addDays(today,-n),D=S.days[d];if(!D)continue;const y=v=>v?"yes":"no";
  out.push([d,y(D.reg),y(D.str),y(D.trained),y(D.wake),y(D.work),(D.correct||0)+"/"+(D.asked||0),D.r1||"",D.r2||"",D.r3||""].join(" | "));}
 const ws=monday(today),prev=addDays(ws,-7);
 [prev,ws].forEach(w0=>{const w=weekStats(w0);out.push("","WEEK ENDING "+addDays(w0,4),"regulation "+w.reg+"/5, strengths "+w.str+"/5, reflection "+w.refl+"/5, sprint work "+w.work+"/5, training "+Math.min(w.trained,6)+"/6, wake "+w.wake+"/7",
  "retrieval "+w.corr+"/"+w.asked+", forecasts logged "+w.fc+", weekdays with no entry "+w.empty);
  Object.keys(w.by).forEach(p=>{const s=setByPrefix(p);out.push("  "+(s?s.title:p)+" items: "+w.by[p].c+"/"+w.by[p].a);});
  const c=calSum(w.days.slice(0,5));out.push("  calibration: sure "+c[3].c+"/"+c[3].a+", probably "+c[2].c+"/"+c[2].a+", guessing "+c[1].c+"/"+c[1].a);});
 out.push("","ITEM LOG","item | last asked | result | correct streak | next due | lifetime correct/asked | last confidence");
 Object.keys(S.items).sort().forEach(k=>{const s=S.items[k];out.push([k,s.l||"not yet asked",s.a?(s.r?"correct":"missed"):"introduced",s.s,s.d,s.c+"/"+s.a,s.k?CONF[s.k].toLowerCase():""].join(" | "));});
 out.push("","LESSONS DONE");Object.keys(S.lessons).sort().forEach(k=>out.push(k+" | "+S.lessons[k]+" | "+(lessonById[k]?lessonById[k].t:"")));
 out.push("","FORECASTS","logged | question | base rate | percent | resolves by | outcome | brier");
 Object.keys(S.fc).forEach(k=>{const f=S.fc[k],o=f.outcome===1?"happened":f.outcome===0?"did not happen":"open";
  out.push([f.created,f.q,f.base,f.pct,f.by,o,(f.outcome===0||f.outcome===1)?Math.pow(f.pct/100-f.outcome,2).toFixed(3):""].join(" | "));});
 return out.join("\n");
}
let exporting=false;
async function exportNow(manual){
 if(!mcp||exporting)return;exporting=true;ui.exportMsg="Sending your record to Drive.";render();
 try{await drive("create_file",{title:"Peerless Export "+today,textContent:exportText(),contentMimeType:"text/plain",parentId:FOLDER.exports});
  S.sync=Object.assign({},S.sync,{lastExport:today,at:new Date().toISOString()});saveSync();ui.exportMsg="";}
 catch(e){ui.exportMsg=driveCopy(e)+" If the file may have been created, check the App exports folder before sending again.";}
 exporting=false;render();
}

/* ---------- views ---------- */
function check(label,why,on,fn){return h("button",{class:"check",onclick:fn,"aria-pressed":on?"true":"false"},
 h("span",{class:"box","aria-hidden":"true",text:on?"✓":""}),h("span",null,h("span",{class:"strong",text:label}),why?h("span",{class:"why",text:why}):null));}
function stationList(d){
 const D=day(d),isToday=d===today;
 const flip=p=>()=>{const o={};o[p]=!D[p];setDay(d,o);render(true);};
 const sts=[];
 sts.push({key:"morning",title:"Morning",short:"AM",done:!!(D.reg&&D.str),
  sum:(D.reg&&D.str)?"Done":D.reg?"2 min":"Start",
  body:()=>viewMorning(d,D,flip)});
 if(isToday){
  const doneToday=LESSON_ALL.filter(l=>S.lessons[l.id]===today),nx=nextLesson();
  sts.push({key:"lesson",title:doneToday.length?"Lesson":"Lesson",short:"Lesson",done:doneToday.length>0||!nx,sum:doneToday.length?"Read":nx?"4 min":"All read",body:viewLesson});
  const q=buildQueue(),mid=R&&!R.done;
  sts.push({key:"retrieval",title:"Retrieval",short:"Cases",done:!mid&&q.length===0,
   sum:D.asked?(D.correct||0)+"/"+D.asked+(q.length?" +"+q.length:""):q.length?q.length+" due":"None due",body:viewRetrieval});
 }
 sts.push({key:"work",title:"Sprint work",short:"Work",done:!!D.work,sum:D.work?"Done":(D.kernel||D.tl)?"Building":"Open",body:()=>{
  const b=[h("p",{class:"quiet small",text:"The method on your real problem. A memo, a meeting, a decision, or a plan. Reading about it does not count."})];
  liveSprints(d).forEach(sp=>{const s=sprintLine(sp);b.push(h("div",{class:"stack",style:"gap:4px"},h("h3",{text:sp.title+(isToday&&s.n<=14?", day "+s.n+" of 14":"")}),
   isToday?h("p",{class:"small quiet",text:s.step+" "},sp.url?h("a",{href:sp.url,target:"_blank",rel:"noopener",text:"Open the brief"}):null):null));
   if(sp.prefix==="R")b.push(h("details",{open:ui.bOpen==="R"||(!ui.bOpen&&!!D.kernel),ontoggle:e=>{if(e.target.open)ui.bOpen="R";}},h("summary",{text:"Kernel builder"}),builderR(d)));
   if(sp.prefix==="A")b.push(h("details",{open:ui.bOpen==="A"||(!ui.bOpen&&!!D.tl&&!D.kernel),ontoggle:e=>{if(e.target.open)ui.bOpen="A";}},h("summary",{text:"Throughline builder"}),builderA(d)));});
  if(b.length===1)b.push(h("p",{class:"quiet",text:"No sprint is live on this date."}));
  if(isToday&&dow(today)===3)b.push(h("p",{class:"small"},"Wednesday: one forecast is due. ",h("a",{href:"#forecasts",text:"Log it"}),"."));
  if(isToday&&dow(today)===4)b.push(h("p",{class:"small",text:"Thursday: if you ran a meeting, gave a talk, hit a milestone, or saw a decision play out this week, type \"debrief\" in the Peerless project chat."}));
  b.push(check("I used a sprint method on a live VantageScore problem today","",!!D.work,flip("work")));return b;}});
 sts.push({key:"reflection",title:"Evening reflection",short:"PM",done:hasRefl(D),sum:hasRefl(D)?"Saved":"3 lines",body:()=>{
  const ta=(id,lab,val)=>h("label",{for:id},lab,h("textarea",{id:id,class:"read",rows:"2"},val||""));
  return [h("p",{class:"quiet small",text:"Ten minutes. Saving sends the day to Drive."}),ta("r1","What I learned today",D.r1),ta("r2","Where the code was tested, and what I did",D.r2),ta("r3","One change tomorrow",D.r3),
   h("label",{for:"r4"},"Tomorrow I open this at ___ after ___",h("input",{id:"r4",type:"text",class:"read",value:D.intent||"",placeholder:"7:20, after the first coffee"})),
   h("div",{class:"row"},h("button",{class:"act fill",text:"Save reflection",onclick:()=>{setDay(d,{r1:$("#r1").value.trim(),r2:$("#r2").value.trim(),r3:$("#r3").value.trim(),intent:$("#r4").value.trim()});ui.open=null;render(true);
     if(d===today&&mcp&&S.sync.lastExport!==today&&hasRefl(day(d)))exportNow(false);}}))];}});
 return sts;
}

/* ---------- morning: the smallest first step, then the pacer does the counting ---------- */
let pacer=null;
function stopPacer(){if(pacer){clearInterval(pacer.t);pacer=null;}}
function viewMorning(d,D,flip){
 const b=[];const prev=day(addDays(d,-1)).intent;
 if(prev&&!(D.reg&&D.str))b.push(h("p",{class:"small quiet",text:"You said: "+prev+"."}));
 if(pacer&&pacer.d===d){
  const el=Math.floor((Date.now()-pacer.t0)/1000),left=Math.max(0,600-el),ph=Math.floor(el/5)%2,m=Math.floor(left/60),ss=pad(left%60);
  b.push(h("div",{class:"pacer"},h("div",{class:"breath "+(ph?"out":"in"),"aria-hidden":"true"}),h("p",{class:"cue",text:ph?"out":"in"}),h("p",{class:"small quiet",id:"pleft",text:m+":"+ss+" left"})),
   h("p",{class:"small quiet",text:"Five seconds in, five seconds out. Six breaths a minute. The screen counts, you breathe."}),
   h("div",{class:"row"},h("button",{class:"plain",text:"Stop early and mark it done",onclick:()=>{stopPacer();setDay(d,{reg:true});render(true);}}),h("button",{class:"plain",text:"Stop",onclick:()=>{stopPacer();render(true);}})));
  return b;}
 if(!D.reg){b.push(h("div",{class:"guess"},h("p",{class:"strong",text:"Start with two minutes. The rest follows."}),h("p",{class:"small quiet",text:"Ten minutes of slow breathing, grade A for stress. Tap once. The app paces it and marks it done at ten."}),
   h("div",{class:"row"},h("button",{class:"act amber",text:"Start the pacer",onclick:()=>{pacer={d:d,t0:Date.now()};pacer.t=setInterval(()=>{const el=Math.floor((Date.now()-pacer.t0)/1000);if(el>=600){stopPacer();setDay(d,{reg:true});render(true);return;}
     const br=$(".breath"),pl=$("#pleft"),cue=$(".pacer .cue");if(!br){render(true);return;}const ph=Math.floor(el/5)%2,left=600-el;br.className="breath "+(ph?"out":"in");cue.textContent=ph?"out":"in";pl.textContent=Math.floor(left/60)+":"+pad(left%60)+" left";},1000);render(true);}}),
    h("button",{class:"plain",text:"I did it another way",onclick:flip("reg")}))));}
 else b.push(check("Regulation practice","Done.",true,flip("reg")));
 if(!D.str){const vals=D.strengths||["","",""];const inp=i=>h("input",{type:"text",class:"read",value:vals[i]||"","aria-label":"strength "+(i+1),placeholder:["one thing you did well as a leader","another","a third"][i]});
  const ins=[inp(0),inp(1),inp(2)];
  b.push(h("div",{class:"stack",style:"gap:8px"},h("p",{class:"strong",text:"Strengths line. Three things that make you a good leader."}),h("p",{class:"small quiet",text:"Two minutes. Grade B, one study of 65. Specific beats grand: a thing you did this week."}),ins,
   h("div",{class:"row"},h("button",{class:"act fill",text:"Save the three",onclick:()=>{const v=ins.map(x=>x.value.trim());if(v.filter(Boolean).length<3){note("Three lines, then save.");return;}note("");setDay(d,{strengths:v,str:true});render(true);}}))));}
 else b.push(check("Strengths line",(D.strengths||[]).filter(Boolean).join(" · ")||"Done.",true,flip("str")));
 b.push(h("div",{class:"sec"},check("Trained","Today's body session.",!!D.trained,flip("trained")),check("Woke inside the 30-minute window","",!!D.wake,flip("wake"))));
 return b;
}
function viewToday(){
 const d=ui.sel,D=day(d),isToday=d===today,wk=isWeekend(d),out=[];
 const flip=p=>()=>{const o={};o[p]=!D[p];setDay(d,o);render(true);};
 if(!isToday)out.push(h("div",{class:"row spread"},h("button",{class:"plain",onclick:()=>{ui.sel=addDays(d,-1);ui.open=null;render(true);},text:"Earlier day"}),
  h("span",{class:"quiet small",text:"Filling in "+nice(d)}),h("button",{class:"plain",onclick:()=>{ui.sel=addDays(d,1);ui.open=null;render(true);},text:"Later day"})));
 if(wk){ui._sts=null;out.push(h("div",{class:"card stack"},h("h2",{text:"Weekend"}),h("p",{text:"Nothing is assigned, scored, or due. Two body check-ins only."}),
   check("Trained","",!!D.trained,flip("trained")),check("Woke inside the 30-minute window","",!!D.wake,flip("wake"))));
  if(isToday){const mp=sprintMap();if(mp)out.push(mp);}
  out.push(h("div",{class:"row"},h("button",{class:"plain",onclick:()=>{ui.sel=addDays(d,-1);ui.open=null;render(true);},text:"Fill in an earlier day"})));return out;}
 const sts=stationList(d);ui._sts=sts;
 let open=ui.open;if(open==null||!sts.find(s=>s.key===open)){const f=sts.find(s=>!s.done);open=f?f.key:"done";}
 ui._open=open;ui._done=sts.filter(s=>s.done).length;ui._total=sts.length;
 const idx=sts.findIndex(s=>s.key===open),cur=sts[idx];
 if(cur){const scr=h("section",{class:"card station screen","aria-labelledby":"sttitle"},h("div",{class:"head"},h("h2",{id:"sttitle",text:cur.title}),h("span",{class:"n",text:"Station "+(idx+1)+" of "+sts.length})),cur.body());
  const nxt=sts.slice(idx+1).find(s=>!s.done)||sts.find(s=>!s.done&&s!==cur);
  if(nxt)scr.append(h("div",{class:"next"},h("button",{class:"plain",text:"Next: "+nxt.title,onclick:()=>{ui.open=nxt.key;window.scrollTo({top:0});render(true);}})));
  out.push(scr);}
 else{const c=calSum([d]);out.push(h("section",{class:"card station screen"},h("div",{class:"head"},h("h2",{text:"Day complete"}),h("span",{class:"n",text:nice(d)})),
   h("div",{class:"figs"},fig("Cases",(D.correct||0)+"/"+(D.asked||0)),fig("Sure",c[3].a?c[3].c+"/"+c[3].a:"0"),fig("Guessing",c[1].a?c[1].c+"/"+c[1].a:"0"),fig("Sprint work",D.work?"Done":"Open")),
   h("p",{class:"read",text:"Every station is done. "+(S.sync.lastExport===d?"The record went to Drive.":"The record is saved here.")+" Tap any station in the strip to look back at it."})));}
 if(isToday){const mp=sprintMap();if(mp)out.push(mp);}
 else out.push(h("div",{class:"row"},h("button",{class:"plain",onclick:()=>{ui.sel=today;ui.open=null;render(true);},text:"Back to today"})));
 Object.keys(ui.jobs).forEach(k=>out.push(h("p",{class:"notice",text:ui.jobs[k]})));
 if(ui.exportMsg)out.push(h("p",{class:"notice",text:ui.exportMsg}));
 return out;
}
function renderStrip(){
 const el=$("#strip"),sts=ui._sts;
 if(ui.tab!=="today"||!sts){el.hidden=true;el.replaceChildren();return;}
 el.hidden=false;const first=sts.find(s=>!s.done);
 el.replaceChildren.apply(el,sts.map(s=>h("button",{class:(s.done?"done":"")+(s===first?" live":""),"aria-current":ui._open===s.key?"true":null,onclick:()=>{ui.open=s.key;window.scrollTo({top:0});render(true);}},
  h("b",{text:s.short}),h("i",{text:s.sum}))));
}
/* A figure whose key labels can be hidden. Tap a hidden label to reveal it; guess first. */
function figureBlock(key,startHidden){
 if(!key||typeof FIG!=="function")return null;
 const wrap=h("div",{class:"figwrap"});let quiz=!!startHidden;
 function draw(){const s=FIG(key);if(!s)return;wrap.replaceChildren(s,bar());
  if(!quiz)return;
  const labels=[...s.querySelectorAll("text.lbl")];let left=labels.length;
  labels.forEach(t=>{const size=Number(t.getAttribute("font-size"))||13,len=t.textContent.length,w=Math.max(22,len*size*.56+10),hgt=size+8,
   x=Number(t.getAttribute("x")),y=Number(t.getAttribute("y")),an=t.getAttribute("text-anchor"),x0=an==="middle"?x-w/2:an==="end"?x-w:x-5;
   const r=document.createElementNS("http://www.w3.org/2000/svg","rect");
   ["x",x0,"y",y-size-2,"width",w,"height",hgt,"rx",4].forEach((v,i,a)=>{if(i%2===0)r.setAttribute(v,a[i+1]);});
   r.setAttribute("fill","var(--brass)");r.setAttribute("opacity",".9");r.setAttribute("class","mask");r.setAttribute("tabindex","0");r.setAttribute("role","button");r.setAttribute("aria-label","Reveal label");
   const q=document.createElementNS("http://www.w3.org/2000/svg","text");q.setAttribute("x",x0+w/2);q.setAttribute("y",y);q.setAttribute("text-anchor","middle");q.setAttribute("font-size",size);q.setAttribute("font-weight","700");q.setAttribute("fill","var(--on-brass)");q.setAttribute("class","mask");q.textContent="?";q.style.pointerEvents="none";
   t.style.opacity="0";const reveal=()=>{r.remove();q.remove();t.style.opacity="1";left--;if(!left){const b=wrap.querySelector(".figbar .quiet");if(b)b.textContent="All labels shown.";}};
   r.addEventListener("click",reveal);r.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();reveal();}});
   s.append(r,q);});
 }
 function bar(){return h("div",{class:"row figbar"},h("button",{class:"plain",text:quiz?"Show the figure":"Hide the labels and test yourself",onclick:()=>{quiz=!quiz;draw();}}),
  quiz?h("span",{class:"small quiet",text:"Say each label out loud, then tap it."}):null);}
 draw();return wrap;
}
function lessonCard(l){
 const set=setByPrefix(l.b);
 return h("div",{class:"lesson stack"},h("h3",{text:l.t}),h("p",{class:"small quiet",text:(set?set.title:"")+". Evidence grade: "+l.g+"."}),
  figureBlock(l.f),h("p",{text:l.body}),l.ex?h("p",null,h("span",{class:"strong",text:"In your work. "}),l.ex):null,l.miss?h("p",null,h("span",{class:"strong",text:"The usual mistake. "}),l.miss):null);
}
/* Sprint map: where you are, what is read, what is learned, due, or missed. */
function sprintMap(){
 const sps=liveSprints(today);if(!sps.length)return null;
 const box=h("div",{class:"map"});
 sps.forEach(sp=>{const n=Math.min(14,diff(today,sp.start)+1),ls=LESSON_ALL.filter(l=>l.b===sp.prefix),read=ls.filter(l=>S.lessons[l.id]).length,its=ITEM_ALL.filter(i=>prefix(i[0])===sp.prefix);
  let learned=0,due=0,missed=0,seen=0;its.forEach(i=>{const x=S.items[i[0]];if(!x||!x.a)return;seen++;if(x.s>=3)learned++;else if(x.r===0)missed++;else if(x.d<=today)due++;});
  const dots=h("div",{class:"dots","aria-label":"Day "+n+" of 14"});for(let k=1;k<=14;k++){const d=addDays(sp.start,k-1+Math.floor((k-1)/5)*2);dots.append(h("i",{class:k<n?"past":k===n?"now":"",title:nice(d)}));}
  const seg=(cls,v,lab)=>v?h("span",{class:"seg "+cls,style:"flex:"+v,title:lab},String(v)):null;
  const bar=h("div",{class:"segbar","aria-label":learned+" learned, "+due+" due, "+missed+" missed, "+(its.length-seen)+" not yet asked"},seg("ok",learned,"learned"),seg("due",due,"due"),seg("miss",missed,"missed"),seg("idle",its.length-seen,"not yet asked"));
  box.append(h("button",{class:"mapcard",onclick:()=>{ui.lib=sp.id;ui.lq="";location.hash="#library";}},
   h("span",{class:"strong small",text:sp.skill||sp.title}),h("span",{class:"small quiet",text:"day "+n+" of 14"}),dots,
   h("span",{class:"small quiet",text:read+"/"+ls.length+" lessons, "+learned+"/"+its.length+" learned"}),bar));});
 return box;
}
/* Builders: the sprint method applied to live work, with checks that answer as you type. */
const WORDS=t=>String(t||"").trim().split(/\s+/).filter(Boolean).length;
function field(id,lab,val,on,rows,ph){const inp=rows?h("textarea",{id:id,rows:String(rows),placeholder:ph||""},val||""):h("input",{id:id,type:"text",value:val||"",placeholder:ph||""});inp.addEventListener("input",()=>on(inp.value));return h("label",{for:id},lab,inp);}
function tick(ok,text){return h("li",{class:ok?"ok":"",text:text});}
function builderR(d){
 const D=day(d),K=clone(D.kernel||{});K.acts=K.acts&&K.acts.length?K.acts:[{t:"",s:""},{t:"",s:""},{t:"",s:""}];K.out=K.out||["","",""];
 let timer;const put=()=>{clearTimeout(timer);timer=setTimeout(()=>setDay(d,{kernel:clone(K)}),500);refresh();};
 const checks=h("ul",{class:"checks"});
 function refresh(){const nf=WORDS(K.dx)>0,two=[K.f1,K.f2].filter(x=>WORDS(x)).length,ro=K.out.filter(x=>WORDS(x)).length,acts=K.acts.filter(a=>WORDS(a.t)),coh=acts.length&&acts.every(a=>a.s&&a.s!=="none"),test=WORDS(K.win)&&WORDS(K.lose)&&K.by;
  checks.replaceChildren(tick(nf&&two>=1&&two<=2,"Diagnosis names one or two governing factors"+(two>2?" (you have more)":"")),tick(ro>=1,"The policy rules at least one thing out ("+ro+" named)"),
   tick(coh,acts.length?"Every action strengthens another action":"Add at least one action"),tick(test,"The test is falsifiable: a working number, a not-working number, and a date"));
  K.acts.forEach((a,i)=>{const sel=$("#ks"+i);if(sel){sel.classList.toggle("warn",!!WORDS(a.t)&&(!a.s||a.s==="none"));}});}
 const actRow=(a,i)=>{const sel=h("select",{id:"ks"+i,"aria-label":"Which action does this strengthen"});
  const opts=[["","strengthens which action?"],["none","none of them"]].concat(K.acts.map((x,j)=>j===i?null:[String(j),"action "+(j+1)]).filter(Boolean));
  opts.forEach(o=>{const e=h("option",{value:o[0],text:o[1]});if(a.s===o[0])e.selected=true;sel.append(e);});sel.addEventListener("change",()=>{a.s=sel.value;put();});
  const inp=h("input",{id:"ka"+i,type:"text",value:a.t||"",placeholder:"action "+(i+1)});inp.addEventListener("input",()=>{a.t=inp.value;put();});
  return h("div",{class:"actrow"},inp,sel);};
 const el=h("div",{class:"builder stack"},h("p",{class:"small quiet",text:"Your live problem. Fill it in the order of the boxes. The checks answer as you type. It saves by itself."}),
  field("kd","Diagnosis. What is going on, in two sentences",K.dx,v=>{K.dx=v;put();},2),
  h("div",{class:"row"},field("kf1","Governing factor 1",K.f1,v=>{K.f1=v;put();}),field("kf2","Governing factor 2, if there is one",K.f2,v=>{K.f2=v;put();})),
  field("kp","Guiding policy. The approach, one sentence",K.pol,v=>{K.pol=v;put();}),
  h("div",{class:"row"},K.out.map((o,i)=>field("ko"+i,i?"and not":"It rules out",o,v=>{K.out[i]=v;put();},0,"something people might have expected"))),
  h("div",{class:"stack",style:"gap:8px"},h("span",{class:"small strong",text:"Coherent actions. Each one must name the action it strengthens."}),K.acts.map(actRow)),
  h("div",{class:"row"},field("kw","Working looks like (a number)",K.win,v=>{K.win=v;put();}),field("kl","Not working looks like (a number)",K.lose,v=>{K.lose=v;put();}),h("label",{for:"kb"},"Check on",h("input",{id:"kb",type:"date",value:K.by||"",onchange:e=>{K.by=e.target.value;put();}}))),
  checks);
 refresh();return el;
}
function builderA(d){
 const D=day(d),T=clone(D.tl||{});T.sec=T.sec&&T.sec.length?T.sec:["","",""];T.ev=T.ev&&T.ev.length?T.ev:[{d:"",e:""},{d:"",e:""},{d:"",e:""}];T.ask=T.ask||{};
 let timer;const put=()=>{clearTimeout(timer);timer=setTimeout(()=>setDay(d,{tl:clone(T)}),500);refresh();};
 const checks=h("ul",{class:"checks"}),wc=h("span",{class:"count"}),oc=h("span",{class:"count"});
 function refresh(){const w=WORDS(T.claim),ow=WORDS(T.open);wc.textContent=w+" of 15 words";wc.className="count "+(w===0?"":w<=15?"ok":"warn");oc.textContent=ow+" words, about "+Math.round(ow/2.5)+" seconds";oc.className="count "+(ow===0?"":ow<=75?"ok":"warn");
  const secs=T.sec.filter(WORDS).length,ev=T.ev.filter(x=>WORDS(x.d)&&WORDS(x.e)).length,orphan=T.ev.filter(x=>WORDS(x.e)&&!WORDS(x.d)).length,A=T.ask;
  checks.replaceChildren(tick(w>0&&w<=15,"Throughline is 15 words or fewer"),tick(WORDS(T.who)>0,"Someone specific could disagree, and you named the objection"),tick(secs>=1&&secs<=3,"Three sections or fewer, each named in a phrase"),
   tick(ev>=1&&!orphan,orphan?orphan+" piece"+(orphan===1?"":"s")+" of evidence answers no stated doubt: cut or name the doubt":"Every piece of evidence answers a doubt the room holds"),
   tick(WORDS(A.dec)&&A.date&&WORDS(A.cons),"The ask names the decision, the date, and what happens if nothing is done"),tick(ow>0&&ow<=75,"The opening fits in 30 seconds and carries the claim"));}
 const el=h("div",{class:"builder stack"},h("p",{class:"small quiet",text:"Your live message. Idea first, then structure, then material. It saves by itself."}),
  h("label",{for:"tc"},h("span",{class:"row spread"},"Throughline. One claim the room could reject",wc),h("input",{id:"tc",type:"text",value:T.claim||"",oninput:e=>{T.claim=e.target.value;put();}})),
  field("tw","Who in the room could disagree, and what would they say",T.who,v=>{T.who=v;put();}),
  h("div",{class:"row"},T.sec.map((s,i)=>field("ts"+i,"Section "+(i+1)+", a phrase",s,v=>{T.sec[i]=v;put();}))),
  h("div",{class:"stack",style:"gap:8px"},h("span",{class:"small strong",text:"Evidence. Name the doubt first, then what answers it."}),
   T.ev.map((x,i)=>h("div",{class:"actrow"},h("input",{type:"text",value:x.d||"",placeholder:"the room's doubt","aria-label":"doubt "+(i+1),oninput:e=>{x.d=e.target.value;put();}}),h("input",{type:"text",value:x.e||"",placeholder:"evidence that answers it","aria-label":"evidence "+(i+1),oninput:e=>{x.e=e.target.value;put();}})))),
  h("div",{class:"row"},field("ta","The ask. The decision you want",T.ask.dec,v=>{T.ask.dec=v;put();}),h("label",{for:"td"},"By",h("input",{id:"td",type:"date",value:T.ask.date||"",onchange:e=>{T.ask.date=e.target.value;put();}}))),
  field("tn","If the room does nothing",T.ask.cons,v=>{T.ask.cons=v;put();}),
  h("label",{for:"to"},h("span",{class:"row spread"},"Opening, word for word",oc),h("textarea",{id:"to",rows:"3",oninput:e=>{T.open=e.target.value;put();}},T.open||"")),
  checks);
 refresh();return el;
}
const CONF={3:"Sure",2:"Probably",1:"Guessing"};
function calSum(days){const t={1:{a:0,c:0},2:{a:0,c:0},3:{a:0,c:0}};days.forEach(d=>{const c=day(d).cal||{};for(const k in c){if(t[k]){t[k].a+=c[k].a||0;t[k].c+=c[k].c||0;}}});return t;}
function calView(t,title,note){
 const rows=[3,2,1].map(k=>{const x=t[k],p=x.a?Math.round(100*x.c/x.a):null;return h("tr",null,h("td",{text:CONF[k]}),h("td",{text:x.a?x.c+"/"+x.a:"0"}),h("td",{text:p==null?"":p+"%"}));});
 const s=t[3],g=t[1],msgs=[];
 if(s.a>=10&&s.c/s.a<.8)msgs.push("When you say Sure you are right under 80 percent of the time. That is overconfidence. Slow down before choosing Sure.");
 if(g.a>=10&&g.c/g.a>.7)msgs.push("When you say Guessing you are right over 70 percent of the time. You know more than you credit. Choose Probably when the answer forms.");
 if(s.a+t[2].a+g.a<10)msgs.push("Under 10 rated answers this is noise. The pattern shows after a few weeks.");
 return h("div",{class:"sec"},h("h3",{text:title}),h("p",{class:"small quiet",text:note}),
  h("div",{class:"tablewrap"},h("table",null,h("thead",null,h("tr",null,["You said","Correct / asked","Hit rate"].map(x=>h("th",{text:x})))),h("tbody",null,rows))),
  msgs.map(m=>h("p",{class:"small",text:m})));
}

/* ---------- step player: one screen per idea, a tap or a line on most of them ---------- */
function stepPlayer(lid,onDone,opts){
 opts=opts||{};const steps=(typeof STEPS==="object"&&STEPS[lid])||null;if(!steps)return null;
 ui.sp=ui.sp||{};const P=ui.sp[lid]=ui.sp[lid]||{i:0,st:{},ok:0,n:0};
 const i=Math.min(P.i,steps.length-1),st=steps[i],S0=P.st[i]=P.st[i]||{};
 const wrap=h("div",{class:"player stack"});
 const track=h("div",{class:"ptrack","aria-label":"step "+(i+1)+" of "+steps.length});steps.forEach((x,k)=>track.append(h("i",{class:k<i?"done":k===i?"now":""})));
 wrap.append(h("div",{class:"row spread"},track,h("span",{class:"small quiet",text:(i+1)+" / "+steps.length})));
 const go=()=>{if(i>=steps.length-1){onDone(P);return;}P.i=i+1;window.scrollTo({top:0});render(true);};
 const nextBtn=(label)=>h("div",{class:"row spread"},i>0?h("button",{class:"plain",text:"Back",onclick:()=>{P.i=i-1;render(true);}}):h("span"),h("button",{class:"act "+(i>=steps.length-1?"amber":"fill"),text:label||(i>=steps.length-1?(opts.doneLabel||"Done"):"Next"),onclick:go}));
 const fb=(ok,why)=>h("div",{class:"feedback "+(ok?"ok":"miss")},h("span",{class:"strong",text:ok?"Right. ":"Not that one. "}),why);
 if(st.k==="say"){keys({enter:go});wrap.append(st.fig?figureBlock(st.fig):null,h("p",{class:"read",text:st.t}),nextBtn());}
 else if(st.k==="pick"||st.k==="spot"){
  wrap.append(h("p",{class:"q",text:st.q}));
  const opts_=h("div",{class:"opts"});st.o.forEach((o,k)=>{const chosen=S0.c===k,isA=k===st.a;
   opts_.append(h("button",{class:"opt"+(S0.c!=null?(isA?" right":chosen?" wrong":" dim"):""),disabled:S0.c!=null,onclick:()=>{S0.c=k;P.n++;if(k===st.a)P.ok++;render(true);}},h("span",{class:"key",text:String(k+1)}),o));});
  wrap.append(opts_);if(S0.c!=null){wrap.append(fb(S0.c===st.a,st.why),nextBtn());}
  const km={enter:()=>{if(S0.c!=null)go();}};st.o.forEach((o,k)=>{km[String(k+1)]=()=>{if(S0.c==null){S0.c=k;P.n++;if(k===st.a)P.ok++;render(true);}};});keys(km);}
 else if(st.k==="sort"){
  S0.order=S0.order||[];wrap.append(h("p",{class:"q",text:st.q}),h("p",{class:"small quiet",text:"Tap them in order."}));
  const list=h("div",{class:"opts"});st.items.forEach((it,k)=>{const pos=S0.order.indexOf(k);
   list.append(h("button",{class:"opt"+(pos>=0?" picked":""),disabled:pos>=0||S0.done,onclick:()=>{S0.order.push(k);render(true);}},h("span",{class:"key",text:pos>=0?String(pos+1):""}),it));});
  wrap.append(list);
  if(S0.order.length===st.items.length&&!S0.done){S0.done=true;S0.ok=st.order.every((v,k)=>S0.order[k]===v);P.n++;if(S0.ok)P.ok++;}
  if(S0.done)keys({enter:go});
  if(S0.done)wrap.append(fb(S0.ok,S0.ok?st.why:"The order is "+st.order.map(k=>st.items[k]).join(", ")+". "+st.why),nextBtn());
  else if(S0.order.length)wrap.append(h("div",{class:"row"},h("button",{class:"plain",text:"Start over",onclick:()=>{S0.order=[];render(true);}})));}
 else if(st.k==="write"){
  const wc=h("span",{class:"count"});const ta=h("textarea",{class:"read",rows:"3",placeholder:"one line is enough"},S0.t||"");
  const upd=()=>{const n=WORDS(ta.value);wc.textContent=n+" word"+(n===1?"":"s")+(st.max?" of "+st.max:"");wc.className="count "+(n===0?"":(n>=st.min&&(!st.max||n<=st.max))?"ok":"warn");};
  ta.addEventListener("input",()=>{S0.t=ta.value;upd();});upd();
  wrap.append(h("p",{class:"q",text:st.q}),h("label",null,h("span",{class:"row spread"},"Your line",wc),ta));
  if(S0.shown)keys({enter:go});
  if(S0.shown)wrap.append(h("div",null,h("p",{class:"small quiet",text:"A model answer"}),h("p",{class:"ref",text:st.model})),nextBtn());
  else wrap.append(h("div",{class:"row"},h("button",{class:"act fill",text:"Show a model answer",onclick:()=>{const n=WORDS(ta.value);if(n<st.min){note("Write at least "+st.min+" words first. A guess counts.");return;}if(st.max&&n>st.max){note("Over "+st.max+" words. Cut it first.");return;}note("");S0.t=ta.value;S0.shown=true;P.n++;P.ok++;render(true);}})));}
 return wrap;
}
function viewLesson(){
 const nx=nextLesson(),doneToday=LESSON_ALL.filter(l=>S.lessons[l.id]===today);
 if(doneToday.length&&!ui.moreLesson){return [h("p",{class:"quiet small",text:"Read. Its cases are in the retrieval block. Reread it here any time, or open any past lesson under Library."}),
  doneToday.map(l=>h("details",null,h("summary",{text:"Reread: "+l.t}),lessonCard(l))),
  nx?h("div",{class:"row"},h("button",{class:"act",text:"Read the next lesson now",onclick:()=>{ui.moreLesson=true;ui.guessed=false;render(true);}})):h("p",{class:"quiet",text:"Every lesson in your active sets is read."})];}
 if(!nx)return [h("p",{class:"read",text:"Every lesson in your active sets is read. Retrieval and real work carry it from here. Every lesson stays open under Library."})];
 const set=setByPrefix(nx.b);
 if(typeof STEPS==="object"&&STEPS[nx.id]){
  const done=P=>{S.lessons[nx.id]=today;saveLessons();const D=day(today),ls=clone(D.ls);ls[nx.id]={ok:P.ok,n:P.n};setDay(today,{ls:ls});delete ui.sp[nx.id];ui.moreLesson=false;ui.open=null;R=null;render(true);};
  return [h("p",{class:"lead",text:(set?set.title:"")}),h("h3",{text:nx.t+(nx.g?" · grade "+nx.g.split(",")[0]:"")}),stepPlayer(nx.id,done,{doneLabel:"Done. Unlock its cases"}),
   h("details",null,h("summary",{text:"Read it as one page instead"}),lessonCard(nx))];}
 /* Ask before you explain. The figure comes first with its labels hidden. */
 if(!ui.guessed&&nx.f&&typeof FIG==="function"){
  const fw=figureBlock(nx.f,true);
  return [h("p",{class:"lead",text:(set?set.title:"")}),h("h3",{text:nx.t}),
   h("div",{class:"guess"},h("p",{class:"strong",text:"Before you read: what goes in each amber box?"}),h("p",{class:"small quiet",text:"Say it out loud, then tap to check. A guess, even a wrong one, makes the explanation stick."}),fw),
   h("div",{class:"row"},h("button",{class:"act fill",text:"Now read the lesson",onclick:()=>{ui.guessed=true;render(true);}}))];}
 return [lessonCard(nx),
  h("div",{class:"row"},h("button",{class:"act fill",text:"Read it. Unlock its cases",onclick:()=>{S.lessons[nx.id]=today;saveLessons();ui.moreLesson=false;ui.guessed=false;ui.open=null;R=null;render(true);}}),
   set&&set.url?h("a",{href:set.url,target:"_blank",rel:"noopener",class:"small",text:"Open the source"}):null)];
}
let clockTimer=null;
function tickClock(){clearInterval(clockTimer);const run=()=>{const e=$("#clk");if(!e||!R||R.done){clearInterval(clockTimer);return;}
  const s=Math.floor((Date.now()-(R.t0||Date.now()))/1000),m=Math.floor(s/60),ss=pad(s%60);
  e.textContent=m+":"+ss;e.classList.toggle("past",s>600);};setTimeout(run,0);clockTimer=setInterval(run,1000);}
function keys(map){ui.keys=map;}
document.addEventListener("keydown",e=>{if(!ui.keys||e.metaKey||e.ctrlKey||e.altKey)return;const a=document.activeElement,typing=a&&(a.tagName==="TEXTAREA"||a.tagName==="INPUT"||a.tagName==="SELECT");
 const f=ui.keys[e.key.toLowerCase()];if(f&&(!typing||(e.key==="Enter"&&a.tagName==="TEXTAREA"&&e.shiftKey===false&&ui.keys.enter))){e.preventDefault();f();}});
function viewRetrieval(){
 const D=day(today);keys(null);
 if(!R||R.done){const q=buildQueue(),nq=q.filter(x=>x.kind==="q").length,ni=q.length-nq,out=[];
  if(R&&R.done&&R.res){const asked=R.res.filter(x=>x===0||x===1).length,ok=R.res.filter(x=>x===1).length,mins=Math.max(1,Math.round((Date.now()-R.t0)/60000));
   const back=R.queue.filter((x,i)=>R.res[i]===0).map(x=>itemById[x.id]).filter(Boolean);
   out.push(h("div",{class:"card stack"},h("span",{class:"lead",text:"Block done"}),h("div",{class:"figs"},fig("Correct",ok+"/"+asked),fig("Minutes",mins),fig("Today",(D.correct||0)+"/"+(D.asked||0))),
    back.length?h("div",{class:"stack",style:"gap:6px"},h("p",{class:"small strong",text:"Back tomorrow"}),back.map(i=>h("p",{class:"small quiet",text:i[0]+". "+(i[1]&&lessonById[i[1]]?lessonById[i[1]].t:i[2].slice(0,60))}))):h("p",{class:"small quiet",text:"Nothing missed. Every item moved out to a longer gap."})));}
  if(!q.length){out.push(h("p",{class:"read",text:D.asked?"Nothing else is due today.":"Nothing is due yet. Read today's lesson to unlock its cases."}));return out;}
  if(R&&R.done)out.push(h("p",{class:"strong",text:"One more?"}));
  const go=n=>()=>{R={queue:q.slice(0,n),rest:q.slice(n),i:0,phase:"ask",ans:"",verdict:null,conf:0,t0:Date.now(),res:[]};ui.open="retrieval";render(true);};
  out.push(h("p",{class:"read",text:(R&&R.done?"":"")+nq+" case"+(nq===1?"":"s")+" ready"+(ni?", and "+ni+" new standing claim"+(ni===1?"":"s")+" to read":"")+(R&&R.done?".":". Each case is a situation you have not seen. Diagnose it with the lesson's idea, type your answer from memory, rate how sure you are, then look.")}),
   h("div",{class:"row"},q.length>3?h("button",{class:"act amber",text:R&&R.done?"Three more":"Do 3",onclick:go(3)}):null,h("button",{class:"act "+(q.length>3?"":"amber"),text:q.length>3?"Do all "+q.length:(R&&R.done?"Finish the last "+q.length:"Start"),onclick:go(q.length)})));
  if(!D.asked&&typeof FIG==="function")out.push(h("details",null,h("summary",{text:"How the schedule works"}),FIG("spacing"),h("p",{class:"small quiet",text:"A correct answer pushes the item out to 1, 3, 7, 14, 30, then 60 days. A miss brings it back tomorrow. Three in a row counts as learned. The gaps are the point. Easy recall today teaches less than effortful recall next week."})));
  return out;}
 const entry=R.queue[R.i],it=itemById[entry.id],b=[];
 if(!it){R=null;return [h("p",{text:"That item is no longer available."})];}
 const les=it[1]?lessonById[it[1]]:null;
 const track=h("div",{class:"track","aria-hidden":"true"});R.queue.forEach((x,i)=>track.append(h("i",{class:R.res[i]===1?"ok":R.res[i]===0?"miss":i===R.i?"now":""})));
 b.push(h("div",{class:"clock"},h("span",{class:"where",text:"Case "+(R.i+1)+" of "+R.queue.length+(les?" · "+les.t:" · "+it[0])}),h("span",{class:"time",id:"clk","aria-label":"minutes on the block"}),track,R.last?h("span",{class:"last",text:R.last}):null));tickClock();
 const next=()=>{R.i++;R.ans="";R.verdict=null;R.conf=0;R.phase="ask";if(R.i>=R.queue.length){R.done=true;ui.open=null;}window.scrollTo({top:0});render(true);};
 if(entry.kind==="intro"){const go=()=>{S.items[entry.id]={s:0,a:0,c:0,i:today,d:roll(addDays(today,1))};saveItems();R.res[R.i]=2;next();};keys({enter:go});
  b.push(h("div",{class:"case"},h("span",{class:"lead",text:"New claim"}),h("p",{class:"q",text:it[2]}),h("p",{class:"ref",text:it[3]}),h("p",{class:"small quiet",text:"Read both now. The case comes back on the next weekday with the answer hidden."})),
   h("div",{class:"row"},h("button",{class:"act fill",onclick:go},"Got it",h("kbd",{text:"Enter"}))));return b;}
 b.push(h("div",{class:"case"},h("span",{class:"lead",text:"Case"}),h("p",{class:"q",text:it[2]})));
 if(R.phase==="ask"){const rate=k=>()=>{R.ans=$("#ans").value.trim();R.conf=k;R.phase="reveal";R.verdict=null;render(true);grade(entry);};keys({"1":rate(3),"2":rate(2),"3":rate(1)});
  b.push(h("label",{for:"ans"},"Your diagnosis, from memory",h("textarea",{id:"ans",class:"read",rows:"3",autofocus:true},R.ans)),
   h("p",{class:"small strong",text:"How sure are you? Rate it, then the answer shows."}),
   h("div",{class:"conf"},[3,2,1].map(k=>h("button",{class:"act"+(k===3?" fill":""),onclick:rate(k)},CONF[k],h("kbd",{text:String(4-k)})))));}
 else{const v=R.verdict;const mark=ok=>()=>{record(entry.id,ok,R.conf);R.res[R.i]=ok?1:0;const x=S.items[entry.id];R.last=entry.id+(ok?" moves out to "+diff(x.d,today)+" day"+(diff(x.d,today)===1?"":"s")+(x.s>=3?", learned":""):" comes back tomorrow");next();};keys({c:mark(true),m:mark(false)});
  b.push(h("div",{class:"verdict"},h("div",null,h("p",{class:"small quiet",text:"You wrote, "+CONF[R.conf].toLowerCase()}),h("p",{class:"mine",text:R.ans||"(nothing)"})),
   h("div",null,h("p",{class:"small quiet",text:"Reference answer"}),h("p",{class:"ref",text:it[3]}))));
  if(sample&&!v)b.push(h("p",{class:"small quiet",text:"Gemini is checking your answer."}));
  if(v&&!v.failed)b.push(h("div",{class:"feedback "+(v.correct?"ok":"miss")},h("span",{class:"strong",text:"Second opinion: "+(v.correct?"correct. ":"missed. ")}),v.note));
  b.push(h("p",{class:"small quiet",text:"You make the call. Correct means the same diagnosis and the same reason. A miss brings it back on the next weekday."}),
   h("div",{class:"row"},h("button",{class:"act yes"+(v&&v.correct?" hint":""),onclick:mark(true)},"Correct",h("kbd",{text:"C"})),
    h("button",{class:"act no"+(v&&v.correct===false?" hint":""),onclick:mark(false)},"Missed",h("kbd",{text:"M"}))));
  if(les)b.push(h("details",null,h("summary",{text:"Reread the lesson before you move on"}),lessonCard(les)));}
 return b;
}
function weekStats(ws){
 const days=[0,1,2,3,4,5,6].map(n=>addDays(ws,n)),wd=days.slice(0,5),cnt=(arr,f)=>arr.filter(x=>f(day(x))).length;
 const asked=wd.reduce((s,x)=>s+(day(x).asked||0),0),corr=wd.reduce((s,x)=>s+(day(x).correct||0),0);
 const by={};wd.forEach(x=>{const b=day(x).by||{};for(const p in b){by[p]=by[p]||{a:0,c:0};by[p].a+=b[p].a;by[p].c+=b[p].c;}});
 const fc=Object.keys(S.fc).filter(k=>S.fc[k].created>=ws&&S.fc[k].created<=days[6]).length;
 return {days:days,reg:cnt(wd,x=>x.reg),str:cnt(wd,x=>x.str),refl:cnt(wd,hasRefl),work:cnt(wd,x=>x.work),trained:cnt(days,x=>x.trained),wake:cnt(days,x=>x.wake),
  asked:asked,corr:corr,by:by,fc:fc,empty:wd.filter(x=>x<=today&&!S.days[x]).length};
}
const fig=(lab,val)=>h("div",{class:"fig"},h("b",{text:String(val)}),h("span",{text:lab}));
function viewWeek(){
 const ws=ui.week,w=weekStats(ws),fri=addDays(ws,4),out=[];
 out.push(h("div",{class:"row spread"},h("button",{class:"plain",text:"Earlier week",onclick:()=>{ui.week=addDays(ws,-7);render(true);}}),
  h("h2",{text:"Week ending "+nice(fri)}),ws<monday(today)?h("button",{class:"plain",text:"Later week",onclick:()=>{ui.week=addDays(ws,7);render(true);}}):h("span")));
 out.push(h("div",{class:"figs"},fig("Regulation",w.reg+"/5"),fig("Strengths line",w.str+"/5"),fig("Reflection",w.refl+"/5"),fig("Sprint work",w.work+"/5"),
  fig("Retrieval",w.asked?w.corr+"/"+w.asked:"0"),fig("Training",Math.min(w.trained,6)+"/6"),fig("Wake time",w.wake+"/7"),fig("Forecasts",w.fc)));
 const sp=liveSprints(fri>today?today:fri);
 if(sp.length){const sec=h("div",{class:"sec"},h("h3",{text:"Sprint retrieval this week"}),h("p",{class:"small quiet",text:"The mark on each bar is the 90 percent standard a sprint needs to close."}));
  sp.forEach(s=>{const b=w.by[s.prefix]||{a:0,c:0},p=b.a?Math.round(100*b.c/b.a):0;const i=h("i");i.style.width=p+"%";
   sec.append(h("div",{class:"stack",style:"gap:6px"},h("div",{class:"row spread small"},h("span",{text:s.title}),h("span",{class:"strong",text:b.a?b.c+"/"+b.a+" ("+p+"%)":"no answers yet"})),h("div",{class:"meter","aria-hidden":"true"},i)));});
  out.push(sec);}
 if(w.asked)out.push(calView(calSum(w.days.slice(0,5)),"Calibration this week","How often you were right at each confidence level. Sure should land near 90 percent or better."));
 const tb=h("tbody");w.days.forEach(x=>{const D=day(x),m=v=>v?"✓":"";
  tb.append(h("tr",null,h("td",{text:nice(x)}),h("td",{text:m(D.reg)}),h("td",{text:m(D.str)}),h("td",{text:D.asked?(D.correct||0)+"/"+D.asked:""}),h("td",{text:m(D.work)}),h("td",{text:m(hasRefl(D))}),h("td",{text:m(D.trained)}),h("td",{text:m(D.wake)})));});
 out.push(h("div",{class:"sec"},h("div",{class:"tablewrap"},h("table",null,h("thead",null,h("tr",null,["Day","Regulation","Strengths","Retrieval","Sprint work","Reflection","Trained","Wake"].map(t=>h("th",{text:t})))),tb))));
 return out;
}
function viewForecasts(){
 const out=[],ids=Object.keys(S.fc).sort((a,b)=>S.fc[a].created<S.fc[b].created?1:-1);
 const res=ids.map(k=>S.fc[k]).filter(f=>f.outcome===0||f.outcome===1),brier=f=>Math.pow(f.pct/100-f.outcome,2);
 const mean=res.length?(res.reduce((s,f)=>s+brier(f),0)/res.length).toFixed(3):"n/a";
 out.push(h("div",{class:"stack"},h("div",{class:"figs"},fig("Logged",ids.length),fig("Resolved",res.length),fig("Mean Brier, lower is better",mean)),
  h("p",{class:"small quiet",text:"Always saying 50 percent scores 0.250. Under about 30 resolved forecasts, the mean is mostly noise."})));
 out.push(calView(calSum(Object.keys(S.days)),"Retrieval calibration, all time","Every retrieval answer carries a confidence rating. This is the same skill as forecasting, scored daily instead of weekly."));
 out.push(h("div",{class:"sec"},h("h3",{text:"Log a forecast"}),
  h("label",{for:"fq"},"Question, with a yes or no outcome",h("input",{id:"fq",type:"text"})),
  h("label",{for:"fb"},"Base rate: the comparison class and how often it happens",h("input",{id:"fb",type:"text"})),
  h("div",{class:"row"},h("label",{for:"fp",style:"flex:1;min-width:120px"},"Your percent",h("input",{id:"fp",type:"number",min:"1",max:"99",inputmode:"numeric"})),
   h("label",{for:"fd",style:"flex:1;min-width:160px"},"Resolves by",h("input",{id:"fd",type:"date",min:today}))),
  ui.fcErr?h("p",{class:"notice",text:ui.fcErr}):null,
  h("div",{class:"row"},h("button",{class:"act fill",text:"Log forecast",onclick:()=>{
   const q=$("#fq").value.trim(),b=$("#fb").value.trim(),p=Number($("#fp").value),d=$("#fd").value;
   if(!b){ui.fcErr="State a base rate first. No percent is accepted without one.";render(true);return;}
   if(!q||!d||!(p>=1&&p<=99)){ui.fcErr="Add the question, a percent from 1 to 99, and a resolution date.";render(true);return;}
   const id="f"+Date.now().toString(36);S.fc[id]={q:q,base:b,pct:p,by:d,created:today};save("forecasts/"+id,S.fc[id]);ui.fcErr="";render(true);}}))));
 ids.forEach(k=>{const f=S.fc[k],done=f.outcome===0||f.outcome===1,dueNow=!done&&f.by<=today;
  const setO=o=>{S.fc[k]=Object.assign({},f,{outcome:o});save("forecasts/"+k,S.fc[k]);render(true);};
  out.push(h("div",{class:"sec"},h("div",{class:"row spread"},h("h3",{text:f.q}),h("span",{class:"state "+(done?"ok":dueNow?"due":"idle"),text:done?"Resolved":dueNow?"Due now":"Open"})),
   h("p",{class:"small",text:f.pct+" percent. Resolves by "+nice(f.by)+". Logged "+nice(f.created)+"."}),h("p",{class:"small quiet",text:"Base rate: "+f.base}),
   done?h("p",{class:"small",text:(f.outcome?"It happened.":"It did not happen.")+" Brier "+brier(f).toFixed(3)+"."})
    :h("div",{class:"row"},h("button",{class:"act",text:"It happened",onclick:()=>setO(1)}),h("button",{class:"act",text:"It did not happen",onclick:()=>setO(0)}),
      ui.confirmDel===k?h("button",{class:"act no",text:"Tap again to remove",onclick:()=>{delete S.fc[k];save("forecasts/"+k,{__delete:true});ui.confirmDel=null;render(true);}})
       :h("button",{class:"plain",text:"Remove",onclick:()=>{ui.confirmDel=k;render(true);}}))));});
 return out;
}
function setStats(s){
 const ls=LESSON_ALL.filter(l=>l.b===s.prefix),its=ITEM_ALL.filter(i=>prefix(i[0])===s.prefix);
 const st={read:ls.filter(l=>S.lessons[l.id]).length,nl:ls.length,ni:its.length,learned:0,due:0,missed:0,learning:0,ready:0,locked:0,ls:ls,its:its};
 its.forEach(i=>{const x=S.items[i[0]];if(!x||!x.a){if(!i[1]||S.lessons[i[1]])st.ready++;else st.locked++;return;}
  if(x.s>=3)st.learned++;else if(x.r===0&&x.d<=today)st.missed++;else if(x.d<=today)st.due++;else st.learning++;});
 return st;
}
function itemState(i){const x=S.items[i[0]];if(!x||!x.a)return (!i[1]||S.lessons[i[1]])?["Ready","idle"]:["Locked until its lesson","idle"];
 if(x.s>=3)return ["Learned","ok"];if(x.d<=today)return [x.r===0?"Missed, due":"Due","due"];return ["Back "+nice(x.d),"idle"];}
function itemRow(i){const x=S.items[i[0]],st=itemState(i);
 return h("details",null,h("summary",null,h("span",{style:"flex:1;min-width:0"},i[2]),h("span",{class:"state "+st[1],text:st[0]})),
  h("div",{class:"stack"},h("p",{class:"ref",text:i[3]}),h("p",{class:"small quiet",text:i[0]+". "+(x&&x.a?x.c+" correct of "+x.a+" asked. Streak "+x.s+"."+(x.l?" Last asked "+nice(x.l)+".":""):"Not yet asked.")+(i[1]&&lessonById[i[1]]?" Taught in: "+lessonById[i[1]].t+".":"")})));}
function shelfCard(s){const st=setStats(s);
 const live=s.kind==="sprint"?(liveSprints(today).indexOf(s)>=0?"Live sprint":"Sprint"):s.kind==="standing"?"Standing bank":(s.active?"Active":"Paused");
 const seg=(cls,v)=>v?h("span",{class:"seg "+cls,style:"flex:"+v},String(v)):null;
 return h("button",{class:"mapcard shelf",onclick:()=>{ui.lib=s.id;window.scrollTo({top:0});render(true);}},
  h("div",{class:"row spread"},h("span",{class:"t",text:s.title}),h("span",{class:"state "+(live==="Live sprint"||live==="Active"?"ok":"idle"),text:live})),
  h("span",{class:"small quiet",text:(st.nl?st.read+"/"+st.nl+" lessons read · ":"")+st.learned+"/"+st.ni+" learned"}),
  h("div",{class:"segbar"},seg("ok",st.learned),seg("due",st.due),seg("miss",st.missed),seg("idle",st.ni-st.learned-st.due-st.missed)));}
function viewSet(s){
 const st=setStats(s),out=[];
 out.push(h("div",{class:"row spread"},h("button",{class:"plain",text:"All sets",onclick:()=>{ui.lib=null;render(true);}}),h("span",{class:"state "+(s.kind==="sprint"&&liveSprints(today).indexOf(s)>=0?"ok":"idle"),text:s.kind==="sprint"?"Sprint "+(s.n||""):s.kind==="standing"?"Standing bank":"Study set"})));
 out.push(h("div",{class:"card stack"},h("h2",{text:s.title}),
  h("div",{class:"figs"},st.nl?fig("Lessons read",st.read+"/"+st.nl):null,fig("Learned",st.learned),fig("Due now",st.due+st.missed),fig("In progress",st.learning),fig("Not yet asked",st.ready+st.locked)),
  h("div",{class:"row"},s.url?h("a",{class:"small",href:s.url,target:"_blank",rel:"noopener",text:"Open the source"}):null,
   s.kind==="library"?h("button",{class:"plain",text:s.active?"Pause this set":"Resume this set",onclick:()=>{S.sets[s.id]=Object.assign({},S.sets[s.id],{active:!s.active});save("sets/"+s.id,S.sets[s.id]);rebuild();render(true);}}):null)));
 if(st.ls.length){const sec=h("div",{class:"sec"},h("h3",{text:"Lessons"}),h("p",{class:"small quiet",text:"In the order they are taught. Open any one. The figure self-test works here too."}));
  st.ls.forEach((l,i)=>{const rd=S.lessons[l.id],replay=ui.replay===l.id;
   sec.append(h("details",{open:replay},h("summary",null,h("span",{class:"quiet",text:String(i+1)+"."}),h("span",{style:"flex:1;min-width:0"},l.t),h("span",{class:"state "+(rd?"ok":"idle"),text:rd?"Read "+nice(rd):"Unread"})),
    replay?stepPlayer(l.id,()=>{delete ui.sp[l.id];ui.replay=null;render(true);},{doneLabel:"Done"}):h("div",{class:"stack"},typeof STEPS==="object"&&STEPS[l.id]?h("div",{class:"row"},h("button",{class:"act",text:"Replay the steps",onclick:()=>{ui.replay=l.id;render(true);}})):null,lessonCard(l))));});out.push(sec);}
 const groups=[["Due now",i=>{const x=S.items[i[0]];return x&&x.a&&x.s<3&&x.d<=today;}],["In progress",i=>{const x=S.items[i[0]];return x&&x.a&&x.s<3&&x.d>today;}],["Learned",i=>{const x=S.items[i[0]];return x&&x.s>=3;}],["Not yet asked",i=>{const x=S.items[i[0]];return !x||!x.a;}]];
 groups.forEach(g=>{const its=st.its.filter(g[1]);if(!its.length)return;const sec=h("div",{class:"sec"},h("h3",{text:g[0]+", "+its.length}));its.forEach(i=>sec.append(itemRow(i)));out.push(sec);});
 return out;
}
function viewLibrary(){
 const out=[],dr=ui.drive;
 const Q=(ui.lq||"").trim().toLowerCase(),hit=t=>!Q||String(t||"").toLowerCase().indexOf(Q)>=0;
 if(ui.lib&&!Q){const s=SETLIST.find(x=>x.id===ui.lib);if(s)return viewSet(s).concat(driveSection(dr),recordSection(),settingsSection());ui.lib=null;}
 out.push(h("div",{class:"stack"},h("p",{class:"quiet small",text:"Every lesson, every case with its answer, and your record on each. Open anything, as often as you like."}),
  h("label",{for:"lq"},"Find a lesson or case",h("input",{id:"lq",type:"text",placeholder:"a word from a title, a case, or an answer",value:ui.lq||"",oninput:e=>{ui.lq=e.target.value;ui.lqFocus=true;render(true);}}))));
 if(Q){const sec=h("div",{class:"sec"},h("h3",{text:"Matches"}));let n=0;
  SETLIST.forEach(s=>{const all=hit(s.title),ls=LESSON_ALL.filter(l=>l.b===s.prefix&&(all||hit(l.t)||hit(l.body)||hit(l.ex)||hit(l.miss))),its=ITEM_ALL.filter(i=>prefix(i[0])===s.prefix&&(all||hit(i[2])||hit(i[3])||hit(i[0])));
   if(!ls.length&&!its.length)return;n+=ls.length+its.length;sec.append(h("p",{class:"strong",text:s.title}));
   ls.forEach(l=>{const rd=S.lessons[l.id];sec.append(h("details",{open:true},h("summary",null,h("span",{style:"flex:1;min-width:0"},"Lesson: "+l.t),h("span",{class:"state "+(rd?"ok":"idle"),text:rd?"Read":"Unread"})),lessonCard(l)));});
   its.forEach(i=>sec.append(itemRow(i)));});
  if(!n)sec.append(h("p",{class:"quiet",text:"Nothing matches that word. Try a shorter one."}));out.push(sec);}
 else{const shelf=h("div",{class:"map"});SETLIST.forEach(s=>shelf.append(shelfCard(s)));out.push(h("div",{class:"sec"},h("h3",{text:"Study sets"}),shelf));}
 return out.concat(driveSection(dr),recordSection(),settingsSection());
}
function settingsSection(){return window.Peerless&&window.Peerless.settingsNode?window.Peerless.settingsNode(h):null;}
function driveSection(dr){
 const dsec=h("div",{class:"sec"},h("h3",{text:"From your Google Drive"}),
  h("p",{class:"small"},"New sprint briefs arrive in ",h("a",{href:FOLDER_URL(FOLDER.briefs),target:"_blank",rel:"noopener",text:"Peerless, Briefs"}),
   " and load themselves. To study anything else, put a PDF, Word file, Google Doc, or text file in ",h("a",{href:FOLDER_URL(FOLDER.sources),target:"_blank",rel:"noopener",text:"Peerless, Sources"}),". Chapters work better than whole books."));
 if(dr.state==="busy")dsec.append(h("p",{class:"small quiet",text:"Checking Drive."}));
 if(dr.msg)dsec.append(h("p",{class:"notice",text:dr.msg}));
 (dr.sources||[]).forEach(f=>{const built=S.sets[setIdFor(f)],job=ui.jobs[f.id];
  dsec.append(h("div",{class:"row spread"},h("span",{text:f.title}),built?h("span",{class:"state ok",text:"Built"})
   :h("button",{class:"act",disabled:!!job&&/^(Reading|Writing)/.test(job),text:"Build a study set",onclick:()=>build(f,"library")})),job?h("p",{class:"small quiet",text:job}):null);});
 if(dr.state==="ok"&&!(dr.sources||[]).length)dsec.append(h("p",{class:"small quiet",text:"The Sources folder is empty."}));
 dsec.append(h("div",{class:"row"},h("button",{class:"act",disabled:dr.state==="busy"||!mcp,text:"Check Drive",onclick:()=>checkDrive(true)})));
 return dsec;
}
function recordSection(){
 const xsec=h("div",{class:"sec"},h("h3",{text:"Your record"}),
  h("p",{class:"small"},"Each weekday, when you save your reflection, the app writes your record to ",h("a",{href:FOLDER_URL(FOLDER.exports),target:"_blank",rel:"noopener",text:"Peerless, App exports"}),". The Monday session reads the newest file and fills the ledger."),
  h("p",{class:"small quiet",text:S.sync.lastExport?"Last sent "+nice(S.sync.lastExport)+".":"Nothing sent yet."}),
  ui.exportMsg?h("p",{class:"notice",text:ui.exportMsg}):null,
  h("div",{class:"row"},h("button",{class:"act",disabled:!mcp||exporting,text:"Send record to Drive now",onclick:()=>exportNow(true)})),
  h("details",null,h("summary",{text:"Copy the record by hand"}),h("textarea",{id:"xp",readonly:true,rows:"8"},exportText()),
   h("div",{class:"row"},h("button",{class:"act",text:ui.copied?"Copied":"Copy",onclick:async()=>{try{await navigator.clipboard.writeText(exportText());ui.copied=true;render(true);}catch(e){$("#xp").focus();$("#xp").select();}}}))));
 return xsec;
}

/* ---------- render ---------- */
let dirty=false;
function typing(){const a=document.activeElement;return a&&$("#main").contains(a)&&(a.tagName==="TEXTAREA"||a.tagName==="INPUT");}
function render(force){
 if(!force&&typing()){dirty=true;return;}dirty=false;
 document.querySelectorAll("nav.tabs a").forEach(a=>{if(a.dataset.tab===ui.tab)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});
 const m=$("#main"),dkey=s=>{const c=(s.closest(".sec")||m).querySelector(".strong,h3");return s.textContent+"|"+(c?c.textContent:"");},openDetails=[...m.querySelectorAll("details[open] summary")].map(dkey);
 if(dbState==="wait"||(db&&!allLoaded())){m.replaceChildren(h("p",{text:"Loading your record."}));return;}
 ui.keys=null;
 const v=ui.tab==="week"?viewWeek():ui.tab==="forecasts"?viewForecasts():ui.tab==="library"?viewLibrary():viewToday();
 m.replaceChildren.apply(m,v);
 m.querySelectorAll("details summary").forEach(s=>{if(openDetails.indexOf(dkey(s))>=0)s.parentNode.open=true;});
 if(ui.tab==="library"&&ui.lqFocus){ui.lqFocus=false;const e=$("#lq");if(e){e.focus();try{e.setSelectionRange(e.value.length,e.value.length);}catch(x){}}}
 const onToday=ui.tab==="today",sp=liveSprints(today),ms=$("#mastsub");
 $("#mast").textContent=onToday?(ui.sel===today?parse(ui.sel).toLocaleDateString(undefined,{weekday:"long"}):nice(ui.sel)):({week:"Week",forecasts:"Forecasts",library:"Library"})[ui.tab];
 ms.replaceChildren();
 if(onToday&&!isWeekend(ui.sel)){ms.append(parse(ui.sel).toLocaleDateString(undefined,{month:"long",day:"numeric"})+" · "+(ui._done||0)+" of "+(ui._total||0)+" done");if(sp.length&&ui.sel===today)ms.append(h("b",{text:"Day "+Math.min(14,diff(today,sp[0].start)+1)+" / 14"}));}
 else if(onToday){ms.append("Rest day");}
 else ms.append(long(today));
 renderStrip();
 const wd=$("#wdots");if(wd){const ws=monday(today);wd.replaceChildren.apply(wd,[0,1,2,3,4].map(n=>{const x=addDays(ws,n),Dx=day(x),has=!!(Dx.reg||Dx.str||Dx.asked||Dx.work||hasRefl(Dx));return h("i",{class:(has?"has":"")+(x===today?" today":""),title:nice(x)+(has?", a record":"")});}));}
}
$("#main").addEventListener("focusout",()=>{setTimeout(()=>{if(dirty&&!typing())render();},0);});
function route(){const t=(location.hash||"").replace("#","");ui.tab=["today","week","forecasts","library"].indexOf(t)>=0?t:"today";render(true);
 if(ui.tab==="library"&&mcp&&!ui.drive.checked&&allLoaded())checkDrive(false);}
window.addEventListener("hashchange",route);

/* ---------- start ---------- */
async function start(){
 rebuild();route();
 const C=window.Peerless,offline=()=>{dbState="none";note("Your record could not be reached. Check your connection and reload. Anything you tap now is lost when the page reloads.");Object.keys(loaded).forEach(k=>loaded[k]=true);render(true);};
 if(!C||!C.use){offline();return;}
 C.onChange=()=>render(true);
 C.use("sample").then(s=>{sample=s||null;}).catch(()=>{});
 const mcpReady=C.use("mcp").then(m=>{mcp=m||null;}).catch(()=>{});
 let d=null;try{d=await C.use("db");}catch(e){}
 if(!d){offline();return;}
 db=d;dbState="ok";render(true);
 const slow=setTimeout(()=>{if(!allLoaded())note("Your saved record has not loaded yet. The app stays locked until it does, so nothing gets overwritten.");},10000);
 let kicked=false;
 const got=k=>{loaded[k]=true;if(allLoaded()){clearTimeout(slow);note("");if(!kicked){kicked=true;mcpReady.then(()=>{if(mcp)checkDrive(false);else render();});}}render();};
 const fail=e=>{note("Saved data stopped syncing ("+(e&&e.code||"error")+"). Reload the page to reconnect.");};
 db.doc("state/items").onSnapshot(s=>{if(!writing("state/items"))S.items=s.exists?clone(s.data().m):{};got("items");},fail);
 db.doc("state/lessons").onSnapshot(s=>{if(!writing("state/lessons"))S.lessons=s.exists?clone(s.data().done):{};got("lessons");},fail);
 db.doc("state/sync").onSnapshot(s=>{if(!writing("state/sync"))S.sync=s.exists?clone(s.data()):{};got("sync");},fail);
 db.collection("days").onSnapshot(q=>{q.docs.forEach(x=>{if(!writing("days/"+x.id))S.days[x.id]=clone(x.data());});got("days");},fail);
 db.collection("sets").onSnapshot(q=>{q.docs.forEach(x=>{if(!writing("sets/"+x.id))S.sets[x.id]=clone(x.data());});rebuild();got("sets");},fail);
 db.collection("forecasts").onSnapshot(q=>{const n={};q.docs.forEach(x=>{n[x.id]=writing("forecasts/"+x.id)&&S.fc[x.id]?S.fc[x.id]:clone(x.data());});
  Object.keys(S.fc).forEach(k=>{if(writing("forecasts/"+k)&&!n[k])n[k]=S.fc[k];});S.fc=n;got("fc");},fail);
}
start();
})();
