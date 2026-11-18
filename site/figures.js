/* One drawn figure per lesson. Words and picture carry the same claim (dual coding).
   Every figure is plain SVG in the page's own palette. ink = text, brass = the thing to notice,
   verdigris = kept or correct, rust = cut or wrong, rule = quiet structure. */
const FIG=(function(){
const NS="http://www.w3.org/2000/svg";
function el(tag,attrs,text){const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(text!=null)e.textContent=text;return e;}
function svg(w,h,label){const s=el("svg",{viewBox:"0 0 "+w+" "+h,role:"img","aria-label":label,class:"figure"});s.append(el("title",{},label));return s;}
const C={ink:"var(--ink)",quiet:"var(--quiet)",rule:"var(--rule)",brass:"var(--brass)",ok:"var(--verdigris)",cut:"var(--rust)",page:"var(--page)"};
function box(s,x,y,w,h,t,stroke,fill){s.append(el("rect",{x:x,y:y,width:w,height:h,rx:4,fill:fill||C.page,stroke:stroke||C.ink,"stroke-width":2}));
 if(t)text(s,x+w/2,y+h/2+5,t,{anchor:"middle",size:14,weight:700});}
function text(s,x,y,t,o){o=o||{};const e=el("text",{x:x,y:y,"text-anchor":o.anchor||"start","font-size":o.size||13,"font-weight":o.weight||400,fill:o.fill||C.ink,"font-family":"inherit"},t);if(o.weight===700||o.q)e.setAttribute("class","lbl");s.append(e);return e;}
function line(s,x1,y1,x2,y2,stroke,w,dash){const a={x1:x1,y1:y1,x2:x2,y2:y2,stroke:stroke||C.ink,"stroke-width":w||2,"stroke-linecap":"round"};if(dash)a["stroke-dasharray"]=dash;s.append(el("line",a));}
function arrow(s,x1,y1,x2,y2,stroke){line(s,x1,y1,x2,y2,stroke);const a=Math.atan2(y2-y1,x2-x1),L=9;
 s.append(el("path",{d:"M"+x2+" "+y2+" L"+(x2-L*Math.cos(a-.5))+" "+(y2-L*Math.sin(a-.5))+" M"+x2+" "+y2+" L"+(x2-L*Math.cos(a+.5))+" "+(y2-L*Math.sin(a+.5)),stroke:stroke||C.ink,"stroke-width":2,fill:"none","stroke-linecap":"round"}));}
function cross(s,x,y,r){line(s,x-r,y-r,x+r,y+r,C.cut,3);line(s,x-r,y+r,x+r,y-r,C.cut,3);}
function dot(s,x,y,r,fill){s.append(el("circle",{cx:x,cy:y,r:r,fill:fill||C.ink}));}

const F={};
F.kernel=function(){const s=svg(360,130,"The kernel: diagnosis, then guiding policy, then coherent actions, in that order");
 box(s,8,40,100,44,"Diagnosis",C.brass);arrow(s,112,62,138,62);box(s,142,40,100,44,"Policy");arrow(s,246,62,272,62);box(s,276,40,76,44,"Actions");
 text(s,58,30,"what governs it",{anchor:"middle",size:12,fill:C.quiet});text(s,192,30,"the approach",{anchor:"middle",size:12,fill:C.quiet});text(s,314,30,"reinforce",{anchor:"middle",size:12,fill:C.quiet});
 text(s,180,112,"Nothing on the right is chosen before the box to its left.",{anchor:"middle",size:12,fill:C.quiet});return s;};
F.badstrategy=function(){const s=svg(400,150,"Four marks of bad strategy, each shown against the real thing");
 const rows=[["Fluff","sounds strategic, says nothing"],["No challenge named","the obstacle never appears"],["Goal as strategy","a target stands in for a plan"],["Bad objectives","a long list, or no plan for the obstacle"]];
 rows.forEach((r,i)=>{const y=22+i*32;cross(s,16,y,6);text(s,32,y+5,r[0],{weight:700,size:14});text(s,180,y+5,r[1],{size:12,fill:C.quiet});});return s;};
F.diagnosis=function(){const s=svg(360,146,"Diagnosis: many factors go in, one or two governing factors come out");
 for(let i=0;i<9;i++){const y=14+i*14;line(s,10,y,110,y,C.rule,2);dot(s,10,y,3,C.quiet);}
 s.append(el("path",{d:"M116 8 L210 56 L210 84 L116 132 Z",fill:"none",stroke:C.ink,"stroke-width":2}));
 arrow(s,214,70,250,70,C.brass);text(s,258,66,"governs",{weight:700,size:14});text(s,258,86,"the outcome",{size:12,fill:C.quiet});
 text(s,60,138,"everything in play",{anchor:"middle",size:12,fill:C.quiet});text(s,162,74,"judgment",{anchor:"middle",size:12,fill:C.brass});return s;};
F.rulesout=function(){const s=svg(360,140,"A guiding policy is the line that rules areas out; a goal rules out nothing");
 text(s,90,16,"Policy",{anchor:"middle",weight:700,size:14});s.append(el("rect",{x:14,y:26,width:152,height:100,fill:"none",stroke:C.rule,"stroke-width":2}));
 s.append(el("rect",{x:14,y:26,width:60,height:100,fill:C.ok,opacity:.25}));text(s,44,80,"do",{anchor:"middle",weight:700,size:13,fill:C.ok});
 line(s,74,26,74,126,C.brass,3);text(s,120,76,"not this",{anchor:"middle",size:12,fill:C.cut});text(s,120,92,"not that",{anchor:"middle",size:12,fill:C.cut});
 text(s,270,16,"Goal",{anchor:"middle",weight:700,size:14});s.append(el("rect",{x:194,y:26,width:152,height:100,fill:C.rule,opacity:.4,stroke:C.rule,"stroke-width":2}));
 text(s,270,80,"everything, somehow",{anchor:"middle",size:12,fill:C.quiet});return s;};
F.coherence=function(){const s=svg(360,140,"Coherent actions feed each other in a chain; a stray action feeds nothing and is cut");
 box(s,8,30,86,36,"Briefing",C.ok);arrow(s,98,48,126,48,C.ok);box(s,130,30,86,36,"Data note",C.ok);arrow(s,220,48,248,48,C.ok);box(s,252,30,100,36,"Member letter",C.ok);
 text(s,112,24,"questions",{anchor:"middle",size:11,fill:C.quiet});text(s,234,24,"cites",{anchor:"middle",size:11,fill:C.quiet});
 box(s,130,92,110,36,"Sponsorship",C.cut);cross(s,250,110,7);text(s,120,120,"strengthens nothing",{anchor:"end",size:12,fill:C.cut});return s;};
F.leverage=function(){const s=svg(360,140,"A pivot point: small push, large result, and the guess goes in the forecast log");
 line(s,30,100,300,60,C.ink,4);s.append(el("path",{d:"M150 84 L166 118 L134 118 Z",fill:C.brass}));
 arrow(s,40,60,40,92,C.quiet);text(s,40,50,"small push",{anchor:"middle",size:12,fill:C.quiet});
 arrow(s,290,56,290,20,C.ok);text(s,290,13,"large result",{anchor:"end",size:12,fill:C.ok});
 text(s,150,134,"pivot: a guess, so log it with a percent and a date",{anchor:"middle",size:12,fill:C.brass});return s;};
F.proximate=function(){const s=svg(360,140,"A proximate objective is close enough to see the path; a distant goal has no visible first step");
 dot(s,30,110,6);box(s,90,90,120,36,"Briefing by Jan 30",C.ok);arrow(s,38,108,86,108,C.ok);text(s,150,80,"you can see how",{anchor:"middle",size:12,fill:C.ok});
 dot(s,30,36,6);line(s,38,36,120,36,C.rule,2,"4 6");line(s,130,36,210,36,C.rule,2,"4 6");text(s,330,40,"Trusted voice",{anchor:"end",weight:700,size:13,fill:C.quiet});
 text(s,150,24,"no first step, only fog",{anchor:"middle",size:12,fill:C.quiet});return s;};
F.asymmetry=function(){const s=svg(360,140,"Advantage is a card the other side cannot easily copy, such as information, relationships, or timing");
 [0,1,2].forEach(i=>box(s,20+i*34,30,44,64,"",C.ink));box(s,122,22,44,64,"",C.brass);text(s,144,60,"data",{anchor:"middle",weight:700,size:13,fill:C.brass});
 text(s,92,116,"your hand",{anchor:"middle",size:12,fill:C.quiet});
 [0,1,2].forEach(i=>box(s,220+i*34,30,44,64,"",C.ink));text(s,282,116,"their hand",{anchor:"middle",size:12,fill:C.quiet});
 text(s,180,132,"lead with the card they do not hold",{anchor:"middle",size:12,fill:C.brass});return s;};
F.falsify=function(){const s=svg(360,140,"A falsifiable plan names the number that means working, the number that means not, and a date");
 line(s,30,100,330,100,C.ink,2);[0,1,2,3,4,5].forEach(i=>{const x=30+i*60;line(s,x,96,x,104);text(s,x,120,String(i),{anchor:"middle",size:12,fill:C.quiet});});
 text(s,180,136,"offices that request a follow-up by March 1",{anchor:"middle",size:12,fill:C.quiet});
 s.append(el("rect",{x:30,y:60,width:90,height:30,fill:C.cut,opacity:.25}));text(s,75,80,"not working",{anchor:"middle",size:12,fill:C.cut});
 s.append(el("rect",{x:210,y:60,width:120,height:30,fill:C.ok,opacity:.25}));text(s,270,80,"working",{anchor:"middle",size:12,fill:C.ok});
 text(s,165,40,"state both before you act",{anchor:"middle",size:12,fill:C.brass});return s;};
F.throughline=function(){const s=svg(360,140,"A throughline is the spine; every part of the talk connects to it and anything that does not is cut");
 line(s,30,70,300,70,C.brass,4);text(s,310,74,"claim",{weight:700,size:13,fill:C.brass});
 [70,130,190].forEach(x=>{line(s,x,70,x,30,C.ok,2);dot(s,x,26,5,C.ok);});[100,160,230].forEach(x=>{line(s,x,70,x,110,C.ok,2);dot(s,x,114,5,C.ok);});
 line(s,270,70,290,120,C.rule,2,"3 4");dot(s,292,124,5,C.cut);cross(s,310,124,5);text(s,165,14,"15 words or fewer",{anchor:"middle",size:12,fill:C.quiet});return s;};
F.claim=function(){const s=svg(360,140,"A topic is flat and nobody can disagree; a claim has an edge the room can push against");
 text(s,90,24,"Topic",{anchor:"middle",weight:700,size:14,fill:C.quiet});s.append(el("rect",{x:20,y:40,width:140,height:60,rx:30,fill:C.rule,opacity:.5}));
 text(s,90,74,"our approach to IR",{anchor:"middle",size:12,fill:C.quiet});text(s,90,124,"nothing to accept or reject",{anchor:"middle",size:11,fill:C.quiet});
 text(s,270,24,"Claim",{anchor:"middle",weight:700,size:14,fill:C.brass});s.append(el("path",{d:"M200 100 L340 100 L340 40 L250 40 Z",fill:C.page,stroke:C.brass,"stroke-width":2}));
 text(s,280,74,"adoption is a ramp",{anchor:"middle",size:12});text(s,270,124,"someone could disagree",{anchor:"middle",size:11,fill:C.brass});return s;};
F.budget=function(){const s=svg(360,130,"Attention is a fixed budget: three necessary sections fit, a fourth takes from the ask");
 s.append(el("rect",{x:20,y:30,width:320,height:36,fill:"none",stroke:C.ink,"stroke-width":2}));
 [[20,100,"what changed"],[120,100,"what it means"],[220,80,"the ask"]].forEach(b=>{s.append(el("rect",{x:b[0],y:30,width:b[1],height:36,fill:C.ok,opacity:.3}));text(s,b[0]+b[1]/2,52,b[2],{anchor:"middle",size:12});});
 s.append(el("rect",{x:300,y:30,width:40,height:36,fill:C.cut,opacity:.35}));text(s,320,52,"4th",{anchor:"middle",size:12,fill:C.cut});
 text(s,180,16,"the room's attention",{anchor:"middle",size:12,fill:C.quiet});text(s,180,96,"a fourth section is paid for by the ask",{anchor:"middle",size:12,fill:C.cut});return s;};
F.order=function(){const s=svg(360,140,"Idea, then structure, then material; the reverse order leaves the idea as whatever is left over");
 text(s,20,22,"Build",{weight:700,size:13,fill:C.ok});box(s,20,32,80,32,"Idea",C.ok);arrow(s,104,48,124,48,C.ok);box(s,128,32,90,32,"Structure",C.ok);arrow(s,222,48,242,48,C.ok);box(s,246,32,94,32,"Material",C.ok);
 text(s,20,96,"Trim",{weight:700,size:13,fill:C.cut});box(s,20,106,94,32,"Everything",C.cut);arrow(s,118,122,138,122,C.cut);box(s,142,106,90,32,"Cut down",C.cut);arrow(s,236,122,256,122,C.cut);box(s,260,106,80,32,"Leftover",C.cut);return s;};
F.doubt=function(){const s=svg(360,140,"Evidence stays only when it answers a doubt the room holds");
 text(s,70,20,"Room's doubts",{anchor:"middle",weight:700,size:13});text(s,290,20,"Your evidence",{anchor:"middle",weight:700,size:13});
 box(s,10,34,120,30,"switching cost?",C.ink);box(s,230,34,120,30,"lenders in testing",C.ok);arrow(s,134,49,226,49,C.ok);
 box(s,230,90,120,30,"accuracy by vintage",C.cut);line(s,226,105,160,105,C.rule,2,"3 4");text(s,150,109,"no doubt here",{anchor:"end",size:12,fill:C.cut});cross(s,340,78,6);return s;};
F.ask=function(){const s=svg(360,120,"The ask has three parts: the decision, the date, and what happens if the room does nothing");
 box(s,10,30,106,40,"Decision",C.brass);box(s,127,30,106,40,"Date",C.brass);box(s,244,30,106,40,"If nothing",C.brass);
 text(s,180,92,"one sentence, memorized word for word",{anchor:"middle",size:12,fill:C.quiet});text(s,350,20,"turns a request into a choice",{anchor:"end",size:11,fill:C.quiet});return s;};
F.first30=function(){const s=svg(360,130,"The first 30 seconds decide whether the room listens; spend them on the claim, not on thanks or background");
 line(s,20,70,340,70,C.ink,2);line(s,20,64,20,76);line(s,110,64,110,76);text(s,20,92,"0s",{anchor:"middle",size:12,fill:C.quiet});text(s,110,92,"30s",{anchor:"middle",size:12,fill:C.quiet});
 s.append(el("rect",{x:20,y:40,width:90,height:28,fill:C.brass,opacity:.3}));text(s,65,58,"the claim",{anchor:"middle",size:12,weight:700});
 text(s,65,24,"room decides here",{anchor:"middle",size:11,fill:C.brass});text(s,230,58,"spoken from structure, adapts to the room",{anchor:"middle",size:12,fill:C.quiet});
 text(s,20,116,"not: thanks, agenda, history",{anchor:"start",size:11,fill:C.cut});return s;};
F.rehearse=function(){const s=svg(360,140,"Record, review against the throughline in the same session, cut the drift, repeat on a second day");
 box(s,10,30,80,34,"Record",C.ink);arrow(s,94,47,112,47);box(s,116,30,100,34,"Review now",C.brass);arrow(s,220,47,238,47);box(s,242,30,96,34,"Cut drift",C.ok);
 s.append(el("path",{d:"M290 68 C290 110 60 110 50 68",fill:"none",stroke:C.quiet,"stroke-width":2,"stroke-dasharray":"4 5"}));text(s,170,116,"day two: again",{anchor:"middle",size:12,fill:C.quiet});
 text(s,166,20,"same session, or the detail is gone",{anchor:"middle",size:11,fill:C.brass});return s;};
F.interrupt=function(){const s=svg(360,140,"Cut material is not deleted; it becomes prepared answers hung off the spine for hostile questions");
 line(s,30,70,330,70,C.brass,4);text(s,180,20,"the spine",{anchor:"middle",size:12,fill:C.brass});
 [[80,"Q: downturn?"],[180,"Q: self-interest?"],[280,"Q: cost?"]].forEach(q=>{line(s,q[0],70,q[0],100,C.quiet,2);box(s,q[0]-44,100,88,28,"",C.quiet);text(s,q[0],119,q[1],{anchor:"middle",size:11});});
 text(s,180,52,"each answer ends back on the decision",{anchor:"middle",size:11,fill:C.quiet});return s;};
F.spacing=function(){const s=svg(360,140,"Spaced retrieval: each correct answer pushes the next ask further out; a miss resets to one day");
 line(s,20,100,340,100,C.ink,2);const g=[1,3,7,14,30,60],xs=[30,60,100,150,215,320];
 xs.forEach((x,i)=>{dot(s,x,100,5,C.ok);text(s,x,120,g[i]+"d",{anchor:"middle",size:11,fill:C.quiet});if(i)s.append(el("path",{d:"M"+xs[i-1]+" 96 Q"+((xs[i-1]+x)/2)+" "+(96-(x-xs[i-1])/2)+" "+x+" 96",fill:"none",stroke:C.ok,"stroke-width":2}));});
 s.append(el("path",{d:"M150 104 Q90 150 30 104",fill:"none",stroke:C.cut,"stroke-width":2,"stroke-dasharray":"4 4"}));text(s,90,138,"miss: back to 1 day",{anchor:"middle",size:11,fill:C.cut});
 text(s,180,20,"a streak of 3 counts as learned",{anchor:"middle",size:12,fill:C.quiet});return s;};
return function(key){const f=F[key];return f?f():null;};
})();
