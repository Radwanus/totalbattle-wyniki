(() => {
  'use strict';

  const config = window.TB_WHEEL_CONFIG || {};
  const API_BASE = String(config.API_BASE || '').replace(/\/$/, '');

  // Public display names only. Probability weights intentionally do NOT exist in this file.
  const PRIZES = Object.freeze([
    {id:'golden_pass', name:'GOLDEN PASS'},
    {id:'silver_1b', name:'SILVER - 1 BILLION'},
    {id:'olympus_10', name:'OLYMPUS TORCH FRAGMENT - 10 PCS'},
    {id:'dragon_1m', name:'DRAGON COINS - 1 MILLION'},
    {id:'chronoglyph_20', name:'CHRONOGLYPH FRAGMENT - 20 PCS'},
    {id:'silver_5b', name:'SILVER - 5 BILLION'},
    {id:'dragon_3m', name:'DRAGON COINS - 3 MILLION'},
    {id:'olympus_20', name:'OLYMPUS TORCH FRAGMENT - 20 PCS'},
    {id:'silver_3b', name:'SILVER - 3 BILLION'},
    {id:'dragon_5m', name:'DRAGON COINS - 5 MILLION'},
    {id:'chronoglyph_10', name:'CHRONOGLYPH FRAGMENT - 10 PCS'}
  ]);

  const COLORS = ['#be1d22','#ef6d0f','#e9bd16','#168c27','#1898b9','#155399','#4c237f','#b42454','#995211','#2d4152','#189caf'];
  const SEGMENT_ANGLE = 360 / PRIZES.length;
  const NS = 'http://www.w3.org/2000/svg';

  function apiReady(){ return API_BASE && !API_BASE.includes('YOUR-WORKER'); }
  function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function polar(cx,cy,r,angle){const a=(angle-90)*Math.PI/180;return {x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)}}
  function wedgePath(cx,cy,r,start,end){const p1=polar(cx,cy,r,end),p2=polar(cx,cy,r,start);const large=end-start<=180?0:1;return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 0 ${p2.x} ${p2.y} Z`;}

  function wrapName(name){
  const labels = {
    'GOLDEN PASS': ['GOLDEN', 'PASS'],
    'SILVER - 1 BILLION': ['SILVER', '1 BILLION'],
    'OLYMPUS TORCH FRAGMENT - 10 PCS': ['OLYMPUS', 'TORCH', 'FRAGMENT', '10 PCS'],
    'DRAGON COINS - 1 MILLION': ['DRAGON', 'COINS', '1 MILLION'],
    'CHRONOGLYPH FRAGMENT - 20 PCS': ['CHRONOGLYPH', 'FRAGMENT', '20 PCS'],
    'SILVER - 5 BILLION': ['SILVER', '5 BILLION'],
    'DRAGON COINS - 3 MILLION': ['DRAGON', 'COINS', '3 MILLION'],
    'OLYMPUS TORCH FRAGMENT - 20 PCS': ['OLYMPUS', 'TORCH', 'FRAGMENT', '20 PCS'],
    'SILVER - 3 BILLION': ['SILVER', '3 BILLION'],
    'DRAGON COINS - 5 MILLION': ['DRAGON', 'COINS', '5 MILLION'],
    'CHRONOGLYPH FRAGMENT - 10 PCS': ['CHRONOGLYPH', 'FRAGMENT', '10 PCS']
  };

  return labels[name] || [name];
}
function buildDisc(svg){
    svg.setAttribute('viewBox','0 0 400 400');
    svg.setAttribute('aria-label','Wheel of Fortune');
    PRIZES.forEach((p,i)=>{
      const start=i*SEGMENT_ANGLE, end=(i+1)*SEGMENT_ANGLE, mid=start+SEGMENT_ANGLE/2;
      const path=document.createElementNS(NS,'path');
      path.setAttribute('d',wedgePath(200,200,198,start,end));
      path.setAttribute('fill',COLORS[i%COLORS.length]);
      path.setAttribute('stroke','#151515'); path.setAttribute('stroke-width','2');
      svg.appendChild(path);

      const pos=polar(200,200,143,mid);
      const text=document.createElementNS(NS,'text');
      text.setAttribute('x',pos.x);text.setAttribute('y',pos.y);
      text.setAttribute('fill','#fff');text.setAttribute('font-size','7');text.setAttribute('font-weight','800');text.setAttribute('text-anchor','middle');text.setAttribute('dominant-baseline','middle');
      text.setAttribute('transform',`rotate(${mid} ${pos.x} ${pos.y})`);
      const lines=wrapName(p.name);
      lines.forEach((line,n)=>{const t=document.createElementNS(NS,'tspan');t.setAttribute('x',pos.x);t.setAttribute('dy',n===0?String(-(lines.length-1)*5):'11');t.textContent=line;text.appendChild(t)});
      svg.appendChild(text);
    });
  }

  function wheelMarkup(kind,title){
    return {
      wheel:`<div class="wtitle">WHEEL OF FORTUNE<br>${escapeHtml(title)}</div><div class="stage"><div class="pointer"></div><div class="rim"><div class="dw"><svg class="disc" id="${kind}-disc"></svg></div></div><div class="hub">⚔</div><div class="base"></div><div class="play disabled" id="${kind}-play">PLAY</div></div>`,
      side:`<div class="card side"><h3>LATEST RESULTS</h3><div class="last" id="${kind}-last">-</div><div id="${kind}-history"></div></div><div class="card side" style="margin-top:14px"><h3>ENTER YOUR CODE</h3><input id="${kind}-code" autocomplete="off" spellcheck="false" placeholder="YOUR PRIVATE CODE"><button id="${kind}-activate">ACTIVATE</button><div class="ok" id="${kind}-ok"></div><div class="counter">Spins remaining: <strong id="${kind}-left">0</strong></div><button class="next" id="${kind}-next">CONTINUE</button><div class="status">Codes and prize probabilities are verified on the secure server.</div></div>`
    }
  }

  async function post(path,body){
    if(!apiReady()) throw new Error('Wheel service is not configured yet.');
    const r=await fetch(API_BASE+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }

  function controller(kind,title){
    const w=wheelMarkup(kind,title);
    document.getElementById(kind+'-wheel').innerHTML=w.wheel;
    document.getElementById(kind+'-side').innerHTML=w.side;
    const d=id=>document.getElementById(kind+'-'+id), disc=d('disc'),play=d('play'),left=d('left'),ok=d('ok'),next=d('next'),last=d('last'),hist=d('history');
    buildDisc(disc);
    let remaining=0,busy=false,active=false,player='',currentAngle=0;

    function showMessage(text,good){ok.style.display='block';ok.style.color=good?'#62ff70':'#ff6a5b';ok.style.borderColor=good?'#257b31':'#8f2b22';ok.textContent=text}
    function ready(){play.className='play '+(active&&remaining>0&&!busy?'ready':'disabled')}

    d('activate').onclick=async()=>{
      const code=d('code').value.trim().toUpperCase();
      if(!code){showMessage('✕ Enter your private code.',false);return}
      d('activate').disabled=true;
      try{
        const data=await post('/api/activate',{code,wheel:kind});
        active=true;remaining=data.spins_remaining;player=data.player;left.textContent=remaining;
        showMessage(`✓ Valid code. Player: ${player}`,true);ready();
      }catch(e){active=false;remaining=0;left.textContent='0';showMessage('✕ '+e.message,false);ready();d('activate').disabled=false}
    };

    play.onclick=async()=>{
      if(!active||remaining<=0||busy)return;
      busy=true;play.className='play down';next.style.display='none';
      let result;
      try{result=await post('/api/spin',{code:d('code').value.trim().toUpperCase(),wheel:kind});}
      catch(e){busy=false;showMessage('✕ '+e.message,false);ready();return}

      const idx=PRIZES.findIndex(p=>p.id===result.prize_id);
      if(idx<0){busy=false;showMessage('✕ Unknown prize returned by server.',false);ready();return}

      const segmentTarget=360-idx*SEGMENT_ANGLE-SEGMENT_ANGLE/2;
      const omegaDegPerSec=720,constantTime=2.8,brakeTime=2.6;
      currentAngle += omegaDegPerSec*constantTime;
      disc.style.transition=`transform ${constantTime}s linear`;
      disc.style.transform=`rotate(${currentAngle}deg)`;
      await new Promise(r=>setTimeout(r,constantTime*1000));

      const naturalBrakeDelta=0.5*omegaDegPerSec*brakeTime;
      const projectedEnd=currentAngle+naturalBrakeDelta;
      const projectedNorm=((projectedEnd%360)+360)%360;
      const correction=(segmentTarget-projectedNorm+360)%360;
      let brakeDelta=naturalBrakeDelta+correction;
      while(brakeDelta<900) brakeDelta+=360;
      currentAngle += brakeDelta;
      disc.style.transition=`transform ${brakeTime}s cubic-bezier(0.333,0.667,0.667,1)`;
      disc.style.transform=`rotate(${currentAngle}deg)`;
      await new Promise(r=>setTimeout(r,brakeTime*1000));

      remaining=result.spins_remaining;left.textContent=remaining;
      const prize=PRIZES[idx].name;
      last.textContent=`${player} - ${prize}`;
      const now=new Date(result.spun_at || Date.now()),date=now.toLocaleDateString('en-GB'),time=now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
      const row=document.createElement('div');row.className='hist';row.innerHTML=`<span>${escapeHtml(date)}</span><span>${escapeHtml(time)}</span><span>${escapeHtml(player)}</span><b>${escapeHtml(prize)}</b>`;hist.prepend(row);
      busy=false;
      if(remaining>0){play.className='play disabled';next.style.display='block';next.textContent='CONTINUE - remaining '+remaining}else{active=false;ready();showMessage('✓ All available spins have been used.',true)}
    };
    next.onclick=()=>{next.style.display='none';ready()};
  }

  async function loadWinners(){
    const body=document.getElementById('winners-body');
    if(!apiReady()){body.innerHTML='<tr><td colspan="5" class="empty">Secure backend is not configured yet.</td></tr>';return}
    try{
      const r=await fetch(API_BASE+'/api/winners?limit=100');
      const data=await r.json();if(!r.ok)throw new Error(data.error||'Request failed.');
      if(!data.winners?.length){body.innerHTML='<tr><td colspan="5" class="empty">No completed spins yet.</td></tr>';return}
      body.innerHTML=data.winners.map(w=>{const dt=new Date(w.spun_at);return `<tr><td>${escapeHtml(dt.toLocaleString('en-GB'))}</td><td><b>${escapeHtml(w.player)}</b></td><td>${escapeHtml(w.wheel==='crypt'?'Crypts / Citadels':'Epic Bosses')}</td><td>${escapeHtml(w.rank)}</td><td><b>${escapeHtml(w.prize_name)}</b></td></tr>`}).join('');
    }catch(e){body.innerHTML=`<tr><td colspan="5" class="empty">${escapeHtml(e.message)}</td></tr>`}
  }

  controller('crypt','CRYPTS / CITADELS');
  controller('epic','EPIC BOSSES');
  document.querySelectorAll('.nav[data-tab]').forEach(tab=>tab.addEventListener('click',()=>{
    document.querySelectorAll('.nav[data-tab]').forEach(x=>x.classList.remove('active'));tab.classList.add('active');
    document.querySelectorAll('.tabpage').forEach(p=>p.classList.remove('active-tab'));document.getElementById(tab.dataset.tab).classList.add('active-tab');
    if(tab.dataset.tab==='winners-tab')loadWinners();
  }));
  document.getElementById('refresh-winners').onclick=loadWinners;
})();
