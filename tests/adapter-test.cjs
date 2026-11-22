'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const EID = '33238a0f-4e1d-446a-92e7-ff1b8d265e95';
const OLD = '364273fb-47e0-429e-93cf-8d0b65e14e6f';
const id = 'EVT-ABCDEF123456';
const mockCalls=[];
const sess={};
const official={id:EID,name:'AC-STEM 9.0',status:'active'};
const legacy={id:OLD,name:'TCET Event',status:'active'};
const data={
 login: {session:'mock-signed-session',staff:{name:'Test Operator',role:'scanner'}},
 whoami:{name:'Test Operator',role:'scanner'},
 listEvents:[legacy,official],
 eventStats:{[OLD]:{registered:18,attended:4},[EID]:{registered:1,attended:0}},
 listRegistrations:[{id,eventId:EID,fullName:'Meeth Example',phone:'9876543210',attended:false},
                    {id:'EVT-BBBBBBBBBBBB',eventId:OLD,fullName:'Old Person',attended:false}],
 checkIn:{status:'ok',registration:{id,eventId:EID,attended:true}},
 manualCheckIn:{status:'duplicate',registration:{id,eventId:EID,attended:true}},
 undoCheckIn:{id,eventId:EID,attended:false}
};
const sandbox = {
 window: {supabase:{createClient(url,key,opts){
   assert.equal(url,'https://mrwrqcezfvhclymceyut.supabase.co');
   assert.match(key,/^sb_publishable_/);
   assert.equal(opts.auth.persistSession,false);
   return { functions:{ async invoke(slug,{body,headers}){
     assert.equal(slug,'event-desk');
     mockCalls.push({action:body.action,params:body.params,headers});
     return {data:{ok:true,data:data[body.action]},error:null};
   } } };
 }}},
 sessionStorage:{getItem(k){return sess[k]??null;},setItem(k,v){sess[k]=v;},removeItem(k){delete sess[k];}}
};
vm.createContext(sandbox);
const base=path.resolve(__dirname,'..');
vm.runInContext(fs.readFileSync(path.join(base,'js/config.js'),'utf8'),sandbox);
vm.runInContext(fs.readFileSync(path.join(base,'js/db.js'),'utf8'),sandbox);
const db=sandbox.window.DB;
(async()=>{
 assert.equal(db.mode,'supabase');
 await assert.rejects(db.listEvents(),/Please sign in/);
 const staff=await db.authenticate('Test Operator','opaque-passcode');
 assert.equal(staff.role,'scanner');
 assert.equal(mockCalls[0].action,'login');
 assert.equal(mockCalls[0].headers['x-desk-session'],undefined);
 const es=await db.listEvents();
 assert.equal(es.length,1);assert.equal(es[0].id,EID);
 assert.equal((await db.eventStats())[EID].registered,1);
 assert.equal((await db.eventStats())[OLD],undefined);
 const regs=await db.listRegistrations(EID);
 assert.equal(regs.length,1);assert.equal(regs[0].id,id);
 await assert.rejects(db.listRegistrations(OLD),/Only AC-STEM/);
 await assert.rejects(db.checkIn(id,{eventId:OLD,method:'manual',reason:'No phone'}),/Only AC-STEM/);
 await assert.rejects(db.checkIn('M3210',{eventId:EID,method:'manual',reason:'No phone'}),/Choose one registration/);
 const manual=await db.checkIn(id,{eventId:EID,method:'manual',reason:'Phone battery dead'});
 assert.equal(manual.status,'duplicate');
 const last=mockCalls.at(-1);
 assert.equal(last.action,'manualCheckIn');assert.equal(last.params.registrationId,id);
 assert.equal(last.headers['x-desk-session'],'mock-signed-session');
 await assert.rejects(db.bulkCheckIn([id,id],{eventId:EID,method:'manual',reason:'No phone'}),/ONE student/);
 const tok='a'.repeat(64);
 const scan=await db.checkIn(tok,{eventId:EID,method:'qr'});
 assert.equal(scan.status,'ok');
 assert.equal(mockCalls.at(-1).action,'checkIn');
 assert.equal(mockCalls.at(-1).params.token,tok);
 assert.equal(mockCalls.at(-1).params.eventId,EID);
 assert.throws(()=>db.addRegistration(),/Disabled/);
 assert.throws(()=>db.deleteRegistration(),/Disabled/);
 await db.signOut();
 await assert.rejects(db.listEvents(),/sign in/);
 console.log('PASS: auth/session, official event isolation, QR/manual dispatch, uniqueness-preserving manual ID, disabling bulk/walk-ins, signout');
})().catch(e=>{console.error(e);process.exitCode=1;});
