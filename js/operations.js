/* Phase 3: read-only aggregate operational intelligence. Never stores private student data.
   This is a snapshot of CURRENT active check-ins; undone historical actions are NOT an audit trail. */
(function () {
  'use strict';
  const App = window.App;
  const cleanTime = (v) => { const n=Date.parse(v||'');return Number.isFinite(n)&&n>0?n:null; };
  const group = (rows, fn) => { const m=new Map(); rows.forEach(r => { const k=String(fn(r)||'Not given').trim()||'Not given';m.set(k,(m.get(k)||0)+1); });return [...m].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])); };
  function analyze(regs, event, now=Date.now()) {
    const list=Array.isArray(regs)?regs:[];
    const present=list.filter(r=>r.attended);
    const valid=present.filter(r=>cleanTime(r.attendedAt)!==null);
    const times=valid.map(r=>cleanTime(r.attendedAt)).sort((a,b)=>a-b);
    const total=list.length, attended=present.length, rate=total?Math.round(attended/total*100):0;
    const last=(mins)=>times.filter(t=>t<=now&&t>now-mins*60000).length;
    const perMinute=new Map(), perFifteen=new Map();
    times.forEach(t=>{
      let key=Math.floor(t/60000)*60000;perMinute.set(key,(perMinute.get(key)||0)+1);
      key=Math.floor(t/900000)*900000;perFifteen.set(key,(perFifteen.get(key)||0)+1);
    });
    const peak=[...perMinute].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0]||null;
    const start=Number.isFinite(cleanTime(event?.eventDate))?cleanTime(event.eventDate):null;
    const before=start===null?null:times.filter(t=>t<start).length;
    const late=start===null?null:times.filter(t=>t>=start).length;
    const operators=group(valid,r=>r.checkedInBy).map(([name,count])=>({name,count,share:attended?Math.round(count/attended*100):0}));
    const parents=group(valid,r=>r.eventDayParentAttendance || 'Not recorded').map(([name,count])=>({name,count}));
    const schools=group(list,r=>r.collegeSchoolName).slice(0,20).map(([name,count])=>({name,count}));
    const issues=[
      {name:'Attended without a valid timestamp',count:present.length-valid.length},
      {name:'Missing class / year',count:list.filter(r=>!String(r.year||'').trim()).length},
      {name:'Missing school / college',count:list.filter(r=>!String(r.collegeSchoolName||'').trim()).length},
      {name:'Checked in without a named operator',count:valid.filter(r=>!String(r.checkedInBy||'').trim()).length}
    ];
    const timeline=[...perFifteen].sort((a,b)=>a[0]-b[0]).map(([start,count])=>({start,count}));
    const kpis={total,attended,notYet:total-attended,rate,minute:last(1),five:last(5),fifteen:last(15),hour:last(60),peak,first:times[0]||null,last:times[times.length-1]||null,before,late};
    const report=[
      ['METRIC','VALUE'], ['Registered',total],['Checked in',attended],['Yet to arrive',total-attended],['Turnout (%)',rate],
      ['Check-ins last minute',kpis.minute],['Check-ins last 15 minutes',kpis.fifteen],['Check-ins last 60 minutes',kpis.hour],
      ['Peak recorded minute (count)',peak?.[1]??0],['First recorded check-in',kpis.first?new Date(kpis.first).toISOString():''],
      ['Last recorded check-in',kpis.last?new Date(kpis.last).toISOString():''],
      [],['OPERATOR','ACTIVE CHECK-INS'],...operators.map(x=>[x.name,x.count]),
      [],['PARENT CONFIRMATION','ACTIVE CHECK-INS'],...parents.map(x=>[x.name,x.count]),
      [],['15-MINUTE SLOT (ISO)','CHECK-INS'],...timeline.map(x=>[new Date(x.start).toISOString(),x.count]),
      [],['DATA QUALITY','COUNT'],...issues.map(x=>[x.name,x.count])
    ];
    return {kpis,operators,parents,schools,issues,timeline,report,generatedAt:new Date(now).toISOString(),
      caveat:'Derived from currently active registrations and check-ins. This is not an immutable audit log.'};
  }
  App.ops={analyze,group};
})();
