import {test} from 'node:test';import assert from 'node:assert/strict';
import {appClock,setTestClock} from '../src/clock';
import {localDay,round} from '../src/model';
test('test clock drives local midnight and production override is rejected',()=>{
 const previous=process.env.NODE_ENV;process.env.NODE_ENV='test';let time=Date.parse('2026-11-01T03:59:00Z');const restore=setTestClock({now:()=>time});
 try{assert.equal(localDay('America/New_York'),'2026-10-31');time+=120000;assert.equal(localDay('America/New_York'),'2026-11-01');assert.equal(appClock.now(),time);process.env.NODE_ENV='production';assert.throws(()=>setTestClock({now:()=>0}));}finally{restore();process.env.NODE_ENV=previous;}
});
test('portion preview rounds the tofu bowl decimal tie half-up',()=>{assert.equal(round(34+4.05+2.4),40.5);});
