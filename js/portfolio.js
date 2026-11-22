/* Phase 4 — Year-round TCET portfolio, event templates, event branding and academic recap.
   Existing AC-STEM scanner and registration handling remain scoped to the official event.
   Pass Studio never issues QR tokens; it uses an original QR image selected locally. */
(function () {
  'use strict';
  const { S, C, $, ic } = App;
  const esc = U.esc;
  const A = App.actions, V = App.views;
  const officialId = C.OFFICIAL_EVENT_ID;
  const asNum = n => Math.max(0, Number(n) || 0);
  const isAdmin = () => S.role === 'admin';
  const safeColor = (value, fallback) => /^#[\da-fA-F]{6}$/.test(String(value)) ? String(value) : fallback;
  const baseBrand = { accentColor: '#23885d', secondaryColor: '#182b23', tagline: 'Discover. Connect. Celebrate.' };
  const TEMPLATES = Object.freeze([
    { id: 'workshop', label: 'Hands-on workshop', description: 'Skill-building workshop with practical sessions and guided activities.', tagline: 'Learn by doing', accentColor: '#23885d', secondaryColor: '#18372b' },
    { id: 'hackathon', label: 'Hackathon', description: 'Collaborative innovation challenge with team projects and presentations.', tagline: 'Build something remarkable', accentColor: '#18a999', secondaryColor: '#113b45' },
    { id: 'seminar', label: 'Talk or seminar', description: 'Speaker-led knowledge session with interactive questions.', tagline: 'Ideas worth exploring', accentColor: '#aa8b52', secondaryColor: '#283344' },
    { id: 'festival', label: 'Technical festival', description: 'Multi-activity technical event bringing campus communities together.', tagline: 'A campus of possibilities', accentColor: '#c07363', secondaryColor: '#3b2644' },
    { id: 'outreach', label: 'School outreach', description: 'Exploration and guidance event for students and visiting schools.', tagline: 'Explore what comes next', accentColor: '#3684ac', secondaryColor: '#203f5c' },
    { id: 'competition', label: 'Competition', description: 'Timed challenge with participant registration, judging and recognition.', tagline: 'Challenge accepted', accentColor: '#b9973b', secondaryColor: '#273e2b' }
  ]);

  function eventStat(e) {
    const s = S.portfolioStats[e.id] || {};
    const registered = asNum(s.registered), attended = asNum(s.attended);
    return { registered, attended, turnout: registered ? Math.round(attended / registered * 100) : 0 };
  }
  function eventStatus(s) { return s === 'draft' ? 'Draft' : s === 'closed' ? 'Closed' : 'Active'; }
  function eventDate(e) { return e.eventDate && !Number.isNaN(Date.parse(e.eventDate)) ? U.longDate(e.eventDate) : 'Date not set'; }
  function brandFor(id) { return { ...baseBrand, ...(S.portfolioBrands[id] || {}) }; }
  const currencyDate = d => d && !Number.isNaN(Date.parse(d)) ? new Date(d).toLocaleDateString(undefined, {day:'numeric',month:'short',year:'numeric'}) : 'Date to be announced';
  const plain = s => String(s || '').replace(/[\x00-\x1F\x7F]/g, ' ').trim();

  App.loadPortfolio = async function ({ force = false, quiet = false } = {}) {
    if (S.portfolioBusy) return;
    if (quiet && S.portfolioReady && !force && Date.now() - (S.portfolioLoadedAt || 0) < 120000) return;
    S.portfolioBusy = true;
    try {
      const [events, stats, brands] = await Promise.all([
        DB.listPortfolioEvents(), DB.portfolioStats(), DB.listEventBranding()
      ]);
      S.portfolioEvents = events.filter(e => e && e.id && e.name).sort((a,b) =>
        (Date.parse(b.eventDate || '') || 0) - (Date.parse(a.eventDate || '') || 0));
      S.portfolioStats = stats || {};
      S.portfolioBrands = Object.fromEntries(brands.map(b => [b.eventId, {
        accentColor: safeColor(b.accentColor, baseBrand.accentColor),
        secondaryColor: safeColor(b.secondaryColor, baseBrand.secondaryColor),
        tagline: plain(b.tagline).slice(0, 120)
      }]));
      S.portfolioReady = true;
      S.portfolioError = '';
      S.portfolioLoadedAt = Date.now();
    } catch (e) {
      S.portfolioError = String(e.message || e);
      if (!quiet) App.toast('Portfolio data unavailable: ' + S.portfolioError, 'err');
    } finally {
      S.portfolioBusy = false;
      if (['portfolio', 'passes', 'year'].includes(S.view)) {
        const editing = document.activeElement && document.activeElement.closest &&
          document.activeElement.closest('#passBrandForm, #portfolioEventForm');
        if (!editing) App.render({ soft: true });
      }
    }
  };
  function waitForData() {
    if (!S.portfolioReady && !S.portfolioBusy && !S.portfolioError) void App.loadPortfolio();
    if (S.portfolioReady) return '';
    const msg = S.portfolioError ? `Portfolio unavailable: ${esc(S.portfolioError)}` : 'Loading your TCET event portfolio…';
    return `<section class="card"><div class="empty">${ic('calendar')}<b>${msg}</b>
      ${S.portfolioError ? `<button class="btn" data-act="portfolio-retry">Try again</button>` : '<p>Fetching authenticated aggregate event data</p>'}
    </div></section>`;
  }
  A['portfolio-retry'] = () => { S.portfolioError = ''; void App.loadPortfolio({ force: true }); };

  function portfolioRows() {
    return S.portfolioEvents.map(e => ({ e, ...eventStat(e), brand: brandFor(e.id) }));
  }
  function portfolioSummary(rows) {
    return rows.reduce((x,r) => ({
      events: x.events+1, registered: x.registered+r.registered, attended: x.attended+r.attended,
      active: x.active+(r.e.status==='active'?1:0)
    }), {events:0, registered:0, attended:0, active:0});
  }
  V.portfolio = function () {
    const v = $('#view'); if (!S.portfolioReady) { v.innerHTML = waitForData(); return; }
    const rows = portfolioRows(), summary = portfolioSummary(rows);
    v.innerHTML = `<section class="portfolio-shell">
      <div class="portfolio-hero"><div><span class="portfolio-overline">THE TCET EVENT ECOSYSTEM</span>
        <h2>One college. Every event.</h2><p>Plan upcoming events, compare results and keep your year-round event identity consistent.</p>
        <span class="portfolio-scope">${ic('info')} AC-STEM's live scanner and Google Form remain on their protected official workflow.</span></div>
        <div class="portfolio-hero-orb">${ic('calendar')}<span>EVENT<br>OPERATIONS</span></div>
      </div>
      <div class="portfolio-numbers" aria-label="Portfolio summary">
        <div><span>Events</span><strong>${summary.events}</strong><small>Created in the portfolio</small></div>
        <div><span>Active</span><strong>${summary.active}</strong><small>Currently marked active</small></div>
        <div><span>Event registrations</span><strong>${U.num(summary.registered)}</strong><small>Sum across events</small></div>
        <div><span>Verified check-ins</span><strong>${U.num(summary.attended)}</strong><small>Current active attendance</small></div>
      </div>
      <section class="card"><div class="card-head portfolio-toolbar"><div><h3>Event library</h3><p>Each event keeps its own dates, status and aggregate records.</p></div>
        <div class="portfolio-actions"><button class="btn btn-sm" data-act="portfolio-export">${ic('download')} CSV summary</button>
        ${isAdmin() ? `<button class="btn btn-primary btn-sm" data-act="portfolio-create">${ic('plus')} Create event</button>` : ''}</div></div>
        ${rows.length ? `<div class="portfolio-list">${rows.map(r=>{
          const e=r.e, locked=Boolean(e.isDefault || e.id===officialId);
          return `<article class="portfolio-item" style="--event-accent:${r.brand.accentColor};--event-ink:${r.brand.secondaryColor}">
            <div class="portfolio-event-mark">${ic('calendar')}</div>
            <div class="portfolio-event-copy"><div class="portfolio-item-title"><h4>${esc(e.name)}</h4><span class="badge ${e.status==='active'?'good':e.status==='draft'?'warn':'neutral'}">${eventStatus(e.status)}</span>${locked?'<span class="badge info">Official</span>':''}</div>
              <p>${esc(eventDate(e))}${e.venue?' · '+esc(e.venue):''}</p>
              <small>${esc(e.description||'No description yet')}</small>
            </div>
            <div class="portfolio-item-metric"><strong>${U.num(r.attended)} / ${U.num(r.registered)}</strong><span>${r.turnout}% turnout</span><div class="mini-meter"><i style="width:${Math.min(100,r.turnout)}%"></i></div></div>
            <div class="portfolio-item-actions"><button class="btn btn-sm" data-act="portfolio-studio" data-id="${esc(e.id)}">${ic('palette')} Pass style</button>
              ${isAdmin()&&!locked?`<button class="btn btn-sm btn-ghost" data-act="portfolio-edit" data-id="${esc(e.id)}">${ic('pencil')} Edit</button>`:''}
              ${e.id===officialId?`<button class="btn btn-sm" data-act="nav" data-view="overview">Open live desk</button>`:''}
            </div>
          </article>`;
        }).join('')}</div>` : '<div class="empty"><b>No events yet</b><p>Administrators can create the first event from a template.</p></div>'}
      </section>
      ${isAdmin()?`<section class="card portfolio-templates"><div class="card-head"><div><h3>Start from a template</h3><p>Prefills event type and recommended pass colours. New events start as drafts.</p></div></div>
        <div class="portfolio-template-grid">${TEMPLATES.map(t=>`<button class="template-tile" data-act="portfolio-create" data-template="${t.id}" style="--event-accent:${t.accentColor};--event-ink:${t.secondaryColor}">
          <span>${ic('plus')}</span><strong>${esc(t.label)}</strong><small>${esc(t.tagline)}</small></button>`).join('')}</div></section>`:''}
    </section>`;
  };

  function openEventForm(e, templateId) {
    if (!isAdmin()) return App.toast('Administrator access is required.', 'warn');
    if (e && (e.isDefault || e.id===officialId)) return App.toast('Official event metadata is protected.', 'warn');
    const template=TEMPLATES.find(t=>t.id===templateId)||null;
    App.openModal(`<form data-form="portfolio-event" id="portfolioEventForm" data-id="${esc(e?.id||'')}" data-template="${template?.id||''}">
      <div class="modal-head"><div><h3>${e?'Edit event':'Create event'}</h3><p>${template?'Template: '+esc(template.label):'Year-round TCET event portfolio'}</p></div></div>
      <div class="modal-body"><div class="form-grid">
        <label class="field span-2"><span>Event name</span><input name="name" type="text" maxlength="100" required value="${esc(e?.name||'')}" placeholder="e.g. Innovation Lab Workshop"></label>
        <label class="field"><span>Date and time</span><input type="datetime-local" name="eventDate" required value="${e?.eventDate?esc(U.toLocalInput(e.eventDate)):''}"></label>
        <label class="field"><span>Venue</span><input name="venue" maxlength="100" value="${esc(e?.venue??'TCET Campus')}"></label>
        <label class="field"><span>Capacity (optional)</span><input name="capacity" type="number" min="1" max="1000000" value="${esc(e?.capacity||'')}"></label>
        <label class="field"><span>Event status</span><select name="status" ${e?'':'disabled title="New events always begin in draft status"'}>${[['draft','Draft'],['active','Active'],['closed','Closed']].map(([k,v])=>`<option value="${k}" ${(e?.status||'draft')===k?'selected':''}>${v}</option>`).join('')}</select></label>
        <label class="field span-2"><span>Description</span><textarea name="description" maxlength="300">${esc(e?.description||template?.description||'')}</textarea></label>
      </div><p class="form-error" id="portfolioFormError" role="alert" hidden></p>
      <p class="portfolio-note">Creating an event does <b>not</b> connect a new Google Form, issue QR passes or change the live AC-STEM event.</p></div>
      <div class="modal-foot">${e?`<button class="btn btn-danger" type="button" data-act="portfolio-delete" data-id="${esc(e.id)}">Delete empty event</button>`:''}
        <button type="button" class="btn" data-act="close">Cancel</button><button class="btn btn-primary" type="submit">${e?'Save changes':'Create draft event'}</button></div>
      </form>`);
  }
  A['portfolio-create']=el=>openEventForm(null,el?.dataset?.template);
  A['portfolio-edit']=el=>openEventForm(S.portfolioEvents.find(e=>e.id===el.dataset.id));
  A['portfolio-studio']=el=>{S.passEventId=el.dataset.id;S.passQrFile=null;App.navigate('passes');};
  A['portfolio-delete']=async el=>{
    if(!isAdmin()) return;
    const event=S.portfolioEvents.find(e=>e.id===el.dataset.id);
    if (!event || event.id===officialId || event.isDefault) return App.toast('Protected event.', 'warn');
    const st=eventStat(event);
    if (st.registered) return App.toast('Events with registrations cannot be deleted.', 'warn');
    const yes=await App.confirm({title:'Delete empty event?',body:`Remove <b>${esc(event.name)}</b>? This is restricted to empty, non-default events.`,confirmLabel:'Delete event',danger:true});
    if(!yes)return;
    try {await DB.deleteEvent(event.id);App.closeModal();S.portfolioReady=false;await App.loadPortfolio({force:true});App.toast('Empty event deleted.');}
    catch(e){App.toast('Deletion failed: '+(e.message||e),'err');}
  };
  App.forms['portfolio-event']=async form=>{
    if(!isAdmin())return;
    const btn=form.querySelector('[type=submit]');btn.disabled=true;
    const f=new FormData(form), name=plain(f.get('name')).slice(0,100);
    const local=String(f.get('eventDate')||''), date=new Date(local);
    const capacity=f.get('capacity')?Number(f.get('capacity')):null;
    const err=$('#portfolioFormError');
    if(!name || !local || !Number.isFinite(date.getTime()) || (capacity!==null && (!Number.isSafeInteger(capacity)||capacity<=0))){
      err.textContent='Enter a valid event name, date and optional capacity.';err.hidden=false;btn.disabled=false;return;
    }
    const id=form.dataset.id, template=TEMPLATES.find(t=>t.id===form.dataset.template);
    const data={name,eventDate:date.toISOString(),venue:plain(f.get('venue'))||null,
      capacity,status:id?f.get('status'):'draft',description:plain(f.get('description'))||null};
    try{
      const saved=id?await DB.updateEvent(id,data):await DB.createEvent(data);
      if(!id&&template){
        try{await DB.saveEventBranding(saved.id,{
          accentColor:template.accentColor,secondaryColor:template.secondaryColor,tagline:template.tagline
        });}catch(ex){App.toast('Event created, but template colours could not be saved: '+(ex.message||ex),'warn');}
      }
      App.closeModal();S.portfolioReady=false;await App.loadPortfolio({force:true});
      App.toast(id?'Event updated.':'Draft event created.');
    }catch(ex){err.textContent=ex.message||'Unable to save event';err.hidden=false;btn.disabled=false;}
  };

  // Cross-event summary reports, with spreadsheet formula injection neutralised.
  const cleanCSV=s=>{
    let t=String(s==null?'':s).replace(/[\r\n\t]/g,' ');
    if(/^\s*[=+@\-]/.test(t))t="'"+t;
    return '"'+t.replace(/"/g,'""')+'"';
  };
  function downloadCSV(name,head,rows){
    const lines=[head,...rows].map(r=>r.map(cleanCSV).join(','));
    U.download(name+'.csv',new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));
  }
  A['portfolio-export']=()=>{
    if(!S.portfolioReady)return;
    downloadCSV('tcet-event-portfolio', ['Event','Date','Status','Venue','Capacity','Registered entries','Verified check-ins','Turnout percent'],
      portfolioRows().map(r=>[r.e.name,currencyDate(r.e.eventDate),r.e.status,r.e.venue||'',r.e.capacity||'',r.registered,r.attended,r.turnout]));
    App.toast('Aggregate event portfolio exported.');
  };

  // ---------- branded digital passes ----------
  function chosenPassEvent(){
    if(!S.portfolioEvents.length)return null;
    const found=S.portfolioEvents.find(e=>e.id===S.passEventId);
    if(found)return found;
    const own=S.portfolioEvents.find(e=>e.id===officialId)||S.portfolioEvents[0];
    S.passEventId=own.id;return own;
  }
  function previewHTML(ev, brand) {
    const text=esc(brand.tagline||'Welcome to TCET');
    return `<div class="brand-pass" id="brandPass" style="--pass-accent:${brand.accentColor};--pass-base:${brand.secondaryColor}">
       <div class="brand-pass-head"><span class="pass-org">TCET · EVENT PASS</span><span class="pass-preview-label">DESIGN PREVIEW</span></div>
       <div class="brand-pass-body"><div><span class="brand-pass-small">THAKUR COLLEGE OF ENGINEERING & TECHNOLOGY</span>
         <h3 id="passPreviewTitle">${esc(ev.name)}</h3><p id="passPreviewTagline">${text}</p>
         <div class="brand-pass-meta">${esc(currencyDate(ev.eventDate))}${ev.venue?' · '+esc(ev.venue):''}</div></div>
         <div class="brand-pass-qr"><div id="passQrPlaceholder">${ic('scan')}<small>Upload an existing<br>QR image below</small></div><img id="passQrPreview" alt="Locally selected original QR image" hidden></div></div>
       <div class="brand-pass-foot"><span id="passPreviewName">PARTICIPANT NAME</span><span>SCANNER VERIFIES THE ORIGINAL TOKEN</span></div>
    </div>`;
  }
  V.passes = function () {
    const v=$('#view');if(!S.portfolioReady){v.innerHTML=waitForData();return;}
    const ev=chosenPassEvent();if(!ev){v.innerHTML='<section class="card"><div class="empty"><b>No events</b><p>Create an event in the Event Portfolio first.</p></div></section>';return;}
    const brand=brandFor(ev.id);
    v.innerHTML=`<section class="pass-studio-page"><div class="pass-studio-intro"><span class="portfolio-overline">DESIGN ONCE · USE FOR EVERY EVENT</span>
      <h2>The pass is part of the experience.</h2><p>Build an event-specific visual identity, then package a participant's <b>original, already-issued QR image</b> into a designed pass.</p></div>
      <div class="pass-studio-grid"><section class="card pass-settings"><div class="card-head"><div><h3>Event identity</h3><p>Colours and tagline are saved for authorized staff.</p></div></div>
        <label class="field"><span>Choose event</span><select id="passEvent">${S.portfolioEvents.map(e=>`<option value="${esc(e.id)}" ${e.id===ev.id?'selected':''}>${esc(e.name)}</option>`).join('')}</select></label>
        <form id="passBrandForm" data-form="pass-brand"><label class="field"><span>Short tagline</span><input id="passTagline" name="tagline" maxlength="120" value="${esc(brand.tagline)}" placeholder="An invitation to explore"></label>
          <div class="pass-colour-row"><label class="field"><span>Accent colour</span><input type="color" id="passAccent" name="accent" value="${brand.accentColor}"></label>
          <label class="field"><span>Base colour</span><input type="color" id="passBase" name="secondary" value="${brand.secondaryColor}"></label></div>
          ${isAdmin()?`<button class="btn btn-primary" type="submit" id="savePassBrand">${ic('check')} Save event identity</button>`:'<p class="muted">Brand editing requires an administrator account.</p>'}
          <p class="form-error" id="passBrandError" hidden></p>
        </form><div class="portfolio-note">This customizes the Event Desk pass design. It does not change the AC-STEM Google Apps Script email or generate a new QR token.</div>
      </section><section class="card pass-preview-wrap"><div class="card-head"><div><h3>Live visual preview</h3><p>This mockup is not a valid entry pass until you supply an original QR.</p></div></div>
        ${previewHTML(ev,brand)}
        <div class="pass-personalize"><h4>Personalize on this device</h4><p class="muted">The name and QR image stay in this browser and are never uploaded to our server.</p>
          <label class="field"><span>Display name</span><input id="passName" type="text" maxlength="100" placeholder="Student / participant name"></label>
          <label class="field"><span>Original QR image (PNG, JPG, or WebP)</span><input id="passQrFile" type="file" accept="image/png,image/jpeg,image/webp"></label>
          <button class="btn btn-primary" id="download-pass" data-act="pass-download" type="button" disabled>${ic('download')} Download personalized PNG</button>
          <p id="passLocalStatus" class="muted" role="status">Upload an already-issued QR to activate the download.</p>
        </div>
      </section></div></section>`;
    if(S.passQrFile && S.passQrUrl){
      const img=$('#passQrPreview');if(img){img.src=S.passQrUrl;img.hidden=false;$('#passQrPlaceholder').hidden=true;}
    }
    updatePassPreview();
  };
  function updatePassPreview(){
    if(S.view!=='passes')return;
    const card=$('#brandPass');if(!card)return;
    const accent=$('#passAccent'), base=$('#passBase'),tag=$('#passTagline'),name=$('#passName');
    card.style.setProperty('--pass-accent',safeColor(accent?.value,baseBrand.accentColor));
    card.style.setProperty('--pass-base',safeColor(base?.value,baseBrand.secondaryColor));
    $('#passPreviewTagline').textContent=plain(tag?.value)||'Welcome to TCET';
    $('#passPreviewName').textContent=plain(name?.value)||'PARTICIPANT NAME';
    const button=$('#download-pass');if(button)button.disabled=!(S.passQrFile&&plain(name?.value));
  }
  document.addEventListener('input',e=>{
    if(['passTagline','passAccent','passBase','passName'].includes(e.target.id))updatePassPreview();
  });
  document.addEventListener('change',e=>{
    if(e.target.id==='passEvent'){
      S.passEventId=e.target.value;S.passQrFile=null;
      if(S.passQrUrl)URL.revokeObjectURL(S.passQrUrl);S.passQrUrl=null;
      App.render();
    }
    if(e.target.id==='passQrFile'){
      const file=e.target.files?.[0];
      const status=$('#passLocalStatus');
      if(S.passQrUrl)URL.revokeObjectURL(S.passQrUrl);
      S.passQrUrl=null;S.passQrFile=null;
      if(file){
        if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>5*1024*1024){
          if(status)status.textContent='Choose a PNG, JPG or WebP image smaller than 5 MB.';
          e.target.value='';
        }else{
          S.passQrFile=file;S.passQrUrl=URL.createObjectURL(file);
          const img=$('#passQrPreview');img.hidden=false;img.src=S.passQrUrl;
          $('#passQrPlaceholder').hidden=true;
          if(status)status.textContent='Original QR image selected locally. Verify it belongs to this event before printing.';
        }
      }else{
        const img=$('#passQrPreview');img.hidden=true;img.removeAttribute('src');
        $('#passQrPlaceholder').hidden=false;
        if(status)status.textContent='Upload an already-issued QR to activate the download.';
      }
      updatePassPreview();
    }
  });
  App.forms['pass-brand']=async form=>{
    if(!isAdmin())return;
    const event=chosenPassEvent();if(!event)return;
    const save=$('#savePassBrand'),err=$('#passBrandError');save.disabled=true;
    const f=new FormData(form);
    const brand={accentColor:safeColor(f.get('accent'),baseBrand.accentColor),secondaryColor:safeColor(f.get('secondary'),baseBrand.secondaryColor),tagline:plain(f.get('tagline')).slice(0,120)};
    try{await DB.saveEventBranding(event.id,brand);S.portfolioBrands[event.id]=brand;App.toast('Pass identity saved for this event.');}
    catch(e){err.textContent=e.message||'Unable to save brand';err.hidden=false;}
    finally{save.disabled=false;}
  };
  const loadLocalImage=url=>new Promise((resolve,reject)=>{
    const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('The selected QR image could not be decoded'));img.src=url;
  });
  A['pass-download']=async()=>{
    const ev=chosenPassEvent(),file=S.passQrFile,name=plain($('#passName')?.value).slice(0,100);
    if(!ev||!file||!name||!S.passQrUrl)return App.toast('Enter a name and select the original QR image.', 'warn');
    const button=$('#download-pass');button.disabled=true;
    try{
      const qr=await loadLocalImage(S.passQrUrl);
      if(qr.width<70||qr.height<70)throw new Error('Use a clear, high-resolution QR image');
      const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=710;
      const g=canvas.getContext('2d');const accent=safeColor($('#passAccent').value,baseBrand.accentColor),
        secondary=safeColor($('#passBase').value,baseBrand.secondaryColor);
      g.fillStyle=secondary;g.fillRect(0,0,1200,710);
      let gradient=g.createLinearGradient(0,0,1100,700);gradient.addColorStop(0,accent);gradient.addColorStop(1,secondary);
      g.globalAlpha=.28;g.fillStyle=gradient;g.beginPath();g.arc(1120,20,410,0,Math.PI*2);g.fill();g.globalAlpha=1;
      g.strokeStyle='rgba(255,255,255,.28)';g.lineWidth=2;g.strokeRect(30,30,1140,650);
      g.fillStyle='#fff';g.font='700 27px Arial';g.fillText('TCET  /  OFFICIAL EVENT PASS',70,99);
      g.font='700 45px Arial';
      const cut=(txt,max)=>{let v=String(txt||'');while(v.length>1&&g.measureText(v).width>max)v=v.slice(0,-1);return v.length<(txt||'').length?v.trimEnd()+'…':v;};
      const evName=cut(ev.name,690);g.fillText(evName,70,198);
      g.font='24px Arial';g.globalAlpha=.94;g.fillText(cut(plain($('#passTagline').value)||'Welcome to TCET',650),70,248);g.globalAlpha=1;
      g.strokeStyle='rgba(255,255,255,.45)';g.beginPath();g.moveTo(70,294);g.lineTo(790,294);g.stroke();
      g.font='18px Arial';g.fillText('PARTICIPANT',70,352);
      g.font='700 40px Arial';g.fillText(cut(name,690),70,405);
      g.font='22px Arial';g.fillText(cut(currencyDate(ev.eventDate),600),70,472);
      g.fillText(cut(ev.venue||'TCET',620),70,513);
      g.fillStyle='#fff';g.fillRect(824,161,313,313);
      g.imageSmoothingEnabled=false;
      const pad=18,scale=Math.min((313-2*pad)/qr.width,(313-2*pad)/qr.height);
      const w=qr.width*scale,h=qr.height*scale;
      g.drawImage(qr,824+(313-w)/2,161+(313-h)/2,w,h);
      g.imageSmoothingEnabled=true;
      g.fillStyle='#fff';g.font='700 17px Arial';g.fillText('SHOW THIS ORIGINAL QR AT ENTRY',812,515);
      g.font='16px Arial';g.fillText('Only valid if the token is issued for this event.',70,635);
      g.fillText('Ticket image created locally · not a new registration',70,662);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      if(!blob)throw new Error('PNG export unavailable');
      U.download('tcet-'+U.slug(ev.name)+'-'+U.slug(name)+'-pass.png',blob);
      App.toast('Personalized pass downloaded. The original QR remains unchanged.');
    }catch(e){App.toast('Pass export failed: '+(e.message||e),'err');}
    finally{updatePassPreview();}
  };

  // ---------- academic-year recap ----------
  const yearStart = (d) => d.getFullYear()-(d.getMonth()<6?1:0);
  const startOf = y => new Date(y,6,1,0,0,0,0).getTime();
  function yearModel(events, stats, year, now = Date.now()) {
    const from=startOf(year),to=startOf(year+1);
    const chosen=events.filter(e=>Number.isFinite(Date.parse(e.eventDate||'')) &&
      Date.parse(e.eventDate)>=from && Date.parse(e.eventDate)<to);
    const rows=chosen.map(e=>{
      const s=stats[e.id]||{};const registered=asNum(s.registered),attended=asNum(s.attended);
      return {e,registered,attended,rate:registered?Math.round(attended/registered*100):0};
    });
    const hosted=rows.filter(r=>r.e.status!=='draft'&&Date.parse(r.e.eventDate)<=now);
    const total=rows.reduce((s,r)=>s+r.registered,0),att=rows.reduce((s,r)=>s+r.attended,0);
    const top=rows.filter(r=>r.attended>0).sort((a,b)=>b.attended-a.attended)[0]||null;
    const best=rows.filter(r=>r.registered>=5).sort((a,b)=>b.rate-a.rate||b.attended-a.attended)[0]||null;
    const months=Array.from({length:12},(_,i)=>{
      const date=new Date(year,6+i,1),start=date.getTime(),end=new Date(year,7+i,1).getTime();
      const batch=rows.filter(r=>Date.parse(r.e.eventDate)>=start&&Date.parse(r.e.eventDate)<end);
      return {month:date.toLocaleDateString(undefined,{month:'short'}),events:batch.length,
        attendance:batch.reduce((s,r)=>s+r.attended,0)};
    });
    return {year,from,to,rows,hosted:hosted.length,total,att,rate:total?Math.round(att/total*100):0,
      top,best,months,schedule:rows.length};
  }
  App.portfolioModel={yearModel,yearStart};
  function yearOptions(){
    const y=yearStart(new Date()),set=new Set([y,y-1]);
    S.portfolioEvents.forEach(e=>{const t=Date.parse(e.eventDate||'');if(Number.isFinite(t))set.add(yearStart(new Date(t)));});
    return [...set].sort((a,b)=>b-a);
  }
  function academicLabel(y){return `${y}–${String(y+1).slice(-2)}`;}
  V.year=function(){
    const v=$('#view');if(!S.portfolioReady){v.innerHTML=waitForData();return;}
    const years=yearOptions();if(S.reportYear==null||!years.includes(S.reportYear))S.reportYear=years[0];
    const m=yearModel(S.portfolioEvents,S.portfolioStats,S.reportYear);
    const prev=yearModel(S.portfolioEvents,S.portfolioStats,S.reportYear-1);
    const bestMonth=m.months.slice().sort((a,b)=>b.attendance-a.attendance)[0];
    const monthMax=Math.max(1,...m.months.map(x=>x.attendance));
    v.innerHTML=`<section class="year-page"><div class="year-hero"><div><span class="portfolio-overline">THE TCET CHAPTERS</span><h2>One year. Many milestones.</h2>
        <p>Academic year <b>${academicLabel(m.year)}</b> · July to June · verified aggregate event activity.</p></div>
        <div class="year-hero-actions"><label class="sr-only" for="yearSelect">Academic year</label><select id="yearSelect">${years.map(y=>`<option value="${y}" ${y===m.year?'selected':''}>${academicLabel(y)}</option>`).join('')}</select>
          <button class="btn btn-sm" data-act="year-export">${ic('download')} Export CSV</button>
          <button class="btn btn-sm" data-act="year-print">${ic('print')} Print recap</button></div></div>
      <div class="year-kpis"><div><span>Scheduled events</span><strong>${m.schedule}</strong><small>${m.hosted} already hosted</small></div>
        <div><span>Event registrations</span><strong>${U.num(m.total)}</strong><small>Event entries, not unique people</small></div>
        <div><span>Check-ins</span><strong>${U.num(m.att)}</strong><small>Current verified attendance</small></div>
        <div><span>Turnout</span><strong>${m.rate}%</strong><small>Across event registrations</small></div></div>
      <div class="grid g-2"><section class="card"><div class="card-head"><div><h3>12 months of TCET</h3><p>Current verified check-ins by event month</p></div></div>
        <div class="year-months">${m.months.map(x=>`<div class="year-month"><div class="year-month-bar"><span style="height:${Math.round(x.attendance/monthMax*100)}%" title="${x.attendance} check-ins"></span></div><b>${esc(x.month)}</b><small>${x.attendance}</small></div>`).join('')}</div>
        <p class="portfolio-note">${prev.schedule?`${prev.schedule} events in ${academicLabel(prev.year)} · ${U.num(prev.att)} recorded check-ins`:'Prior-year comparison will appear when events exist for that year.'}</p>
      </section><section class="card"><div class="card-head"><div><h3>Highlights</h3><p>Based only on recorded event results</p></div></div>
        <div class="year-highlights"><div>${ic('spark')}<span><small>Most check-ins</small><strong>${m.top?esc(m.top.e.name):'No check-ins recorded'}</strong><em>${m.top?U.num(m.top.attended)+' check-ins':'—'}</em></span></div>
          <div>${ic('check')}<span><small>Highest turnout (5+ registrations)</small><strong>${m.best?esc(m.best.e.name):'Not enough data'}</strong><em>${m.best?m.best.rate+'% turnout':'—'}</em></span></div>
          <div>${ic('chart')}<span><small>Busiest event month</small><strong>${bestMonth?.attendance?esc(bestMonth.month):'Not recorded'}</strong><em>${bestMonth?.attendance?U.num(bestMonth.attendance)+' check-ins':'—'}</em></span></div></div>
      </section></div>
      <section class="card"><div class="card-head"><div><h3>Event-by-event recap</h3><p>Records are grouped by scheduled event date, not check-in date.</p></div></div>
        ${m.rows.length?`<div class="table-wrap"><table class="data"><thead><tr><th>Event</th><th>Date</th><th>Status</th><th>Registered</th><th>Attended</th><th>Turnout</th></tr></thead><tbody>
          ${m.rows.map(r=>`<tr><td><strong>${esc(r.e.name)}</strong></td><td>${esc(eventDate(r.e))}</td><td>${eventStatus(r.e.status)}</td>
            <td>${r.registered}</td><td>${r.attended}</td><td>${r.rate}%</td></tr>`).join('')}</tbody></table></div>`:
          '<div class="empty"><b>No events recorded for this academic year</b><p>New events appear here as they are created and dated.</p></div>'}
      </section><p class="portfolio-note">Attendance reflects current active check-ins. Undo operations can change historical totals. There is no claim of unique attendees or an immutable audit trail.</p></section>`;
  };
  document.addEventListener('change',e=>{
    if(e.target.id==='yearSelect'){S.reportYear=Number(e.target.value);App.render({soft:true});}
  });
  A['year-export']=()=>{
    if(!S.portfolioReady)return;
    const m=yearModel(S.portfolioEvents,S.portfolioStats,S.reportYear);
    downloadCSV(`tcet-academic-year-${m.year}-${m.year+1}`,
      ['Event','Event date','Status','Registrations','Check-ins','Turnout percent'],
      m.rows.map(r=>[r.e.name,currencyDate(r.e.eventDate),r.e.status,r.registered,r.attended,r.rate]));
    App.toast('Academic-year aggregate report exported.');
  };
  A['year-print']=()=>{
    if(!S.portfolioReady)return;
    const m=yearModel(S.portfolioEvents,S.portfolioStats,S.reportYear);
    $('#printReport').innerHTML=`<h1>TCET Academic Year ${academicLabel(m.year)}</h1><p>Event entries: ${m.total} · Verified check-ins: ${m.att} · Turnout: ${m.rate}%</p>
      <p>Summed event entries; not unique students. Based on current active attendance records.</p>
      <table><thead><tr><th>Event</th><th>Date</th><th>Registered</th><th>Attended</th><th>Turnout</th></tr></thead><tbody>
      ${m.rows.map(r=>`<tr><td>${esc(r.e.name)}</td><td>${esc(eventDate(r.e))}</td><td>${r.registered}</td><td>${r.attended}</td><td>${r.rate}%</td></tr>`).join('')}</tbody></table>`;
    const done=()=>{$('#printReport').innerHTML='';window.removeEventListener('afterprint',done);};
    window.addEventListener('afterprint',done);
    setTimeout(()=>window.print(),100);
  };
})();
