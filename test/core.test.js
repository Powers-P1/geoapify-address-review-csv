import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseCsv, writeCsv } from '../src/csv.js';
import { reviewCandidates } from '../src/review.js';
import { makeGeocoder } from '../src/provider.js';
import { processRecords } from '../src/run.js';

const good = () => ({ formatted:'12 Example Road', lat:0, lon:0, country_code:'zz', postcode:'001', city:'Sampletown', housenumber:'12', result_type:'building', rank:{confidence:0.99, match_type:'full_match'} });
test('CSV round trip: BOM, Unicode, commas, quotes, embedded newlines, CRLF, empty fields', () => {
  const source = '\uFEFFid,address,note\r\n001,"Łódź, 12 ""Test"" Street","line1\nline2"\r\n002,,\r\n';
  const parsed = parseCsv(source);
  assert.equal(parsed.records[0].address, 'Łódź, 12 "Test" Street');
  assert.equal(parsed.records[1].address, '');
  assert.deepEqual(parseCsv(writeCsv(parsed.headers, parsed.records)), parsed);
});
test('malformed CSV is rejected before any geocoding', () => {
  for (const s of ['a,a\n1,2','a,b\n1','a\n"unfinished','a\n"x"junk','a\na"b','a,\n1,2']) assert.throws(() => parseCsv(s));
});
test('spreadsheet formula injection is escaped, including whitespace and tabs', () => {
  for (const value of ['=1+1',' +cmd','@SUM(1)','-10','\t=1','\n=1']) assert.equal(parseCsv(writeCsv(['value'],[{value}])).records[0].value, "'" + value);
});
test('all candidates require human confirmation, even full matches', () => {
  const [r] = reviewCandidates({}, [good()]);
  assert.equal(r.review_status,'ready_for_review');
  assert.equal(r.review_reasons,'human_confirmation_required');
});
test('independent input checks apply to every candidate and preserve leading zero postcode', () => {
  const [r] = reviewCandidates({country_code:'xx', postcode:'999',city:'Other',housenumber:'14'},[good()]);
  for (const field of ['country_code','postcode','city','housenumber']) assert.ok(r.review_reasons.includes(field+'_mismatch'));
  assert.equal(reviewCandidates({postcode:'001'},[good()])[0].review_status,'ready_for_review');
});
test('house-number ranges, separators and internal whitespace cannot collapse to a different number', () => {
  for (const housenumber of ['12-14','12/14','12.14','12 14']) {
    const result=reviewCandidates({housenumber},[{...good(),housenumber:'1214'}])[0];
    assert.ok(result.review_reasons.includes('housenumber_mismatch'),housenumber);
  }
  assert.equal(reviewCandidates({housenumber:' 12A '},[{...good(),housenumber:'12a'}])[0].review_status,'ready_for_review');
});
test('low, absent, invalid confidence, coarse precision, missing coordinates, close alternatives', () => {
  const c = good(); c.rank.confidence=0.89; c.rank.match_type='match_by_street'; c.result_type='street'; delete c.lat;
  const [r] = reviewCandidates({},[c,{...good(),rank:{confidence:0.87,match_type:'full_match'}}]);
  for (const reason of ['low_confidence','not_full_match','coarse_result','coordinates_missing_or_invalid','similar_confidence_candidates']) assert.ok(r.review_reasons.includes(reason));
  for (const confidence of [undefined,'0.99',NaN,1.1]) assert.ok(reviewCandidates({},[{...good(),rank:{confidence,match_type:'full_match'}}])[0].review_reasons.includes('confidence_missing_or_invalid'));
});
test('duplicate addresses make one request but keep distinct row expectations', async () => {
  let calls=0;
  const {results,summary} = await processRecords([{address:' A ',postcode:'001'},{address:'A',postcode:'002'},{address:''}],{geocode:async()=>{calls++;return [good()];},sleep:async()=>{}});
  assert.equal(calls,1); assert.equal(summary.input_records,3); assert.equal(summary.automatically_accepted,0);
  assert.equal(results[0].review_status,'ready_for_review'); assert.ok(results[1].review_reasons.includes('postcode_mismatch')); assert.equal(results[2].review_reasons,'empty_address');
});
test('request cap fails before provider call', async () => {
  let calls=0;
  await assert.rejects(processRecords([{address:'A'},{address:'B'}],{maxRequests:1,geocode:async()=>{calls++;return [];}}));
  assert.equal(calls,0);
});
test('provider failure stops further unique requests, never retries, outputs review rows', async () => {
  let calls=0;
  const {results,summary}=await processRecords([{address:'A'},{address:'B'}],{geocode:async()=>{calls++;throw Object.assign(new Error('SECRET'),{code:'http_429'});},sleep:async()=>{}});
  assert.equal(calls,1); assert.equal(summary.provider_error_stopped_run,true); assert.equal(results[0].review_reasons,'http_429'); assert.equal(results[1].review_reasons,'not_requested_after_provider_error');
  assert.ok(!JSON.stringify(results).includes('SECRET'));
});
test('empty provider result remains a visible review row', async () => {
  const {results}=await processRecords([{address:'A'}],{geocode:async()=>[]});
  assert.equal(results[0].review_reasons,'no_candidates');
});
test('provider requests expected endpoint and parameters without following redirects', async () => {
  const geocode=makeGeocoder({apiKey:'unit-test-only',limit:3,fetchImpl:async(url,options)=>{
    assert.equal(url.origin,'https://api.geoapify.com'); assert.equal(url.pathname,'/v1/geocode/search');
    assert.equal(url.searchParams.get('text'),'A & B'); assert.equal(url.searchParams.get('format'),'json');
    assert.equal(url.searchParams.get('limit'),'3'); assert.equal(options.redirect,'error');
    return {ok:true,json:async()=>({results:[good()]})};
  }});
  assert.equal((await geocode('A & B')).length,1);
});
test('network, auth, quota, malformed JSON/schema failures are sanitized', async () => {
  const cases=[
    [async()=>{throw new Error('https://example.invalid/?apiKey=LEAK');},'network_or_timeout'],
    [async()=>({ok:false,status:401}),'http_401'],
    [async()=>({ok:false,status:429}),'http_429'],
    [async()=>({ok:true,json:async()=>{throw new Error('LEAK');}}),'invalid_provider_json'],
    [async()=>({ok:true,json:async()=>({results:[null]})}),'invalid_provider_response']
  ];
  for (const [fetchImpl,code] of cases) await assert.rejects(makeGeocoder({apiKey:'LEAK',fetchImpl})('A'),e=>e.message===code&&!e.stack.includes('LEAK'));
});
test('nested malformed provider fields become visible schema errors, without coercion or payload leakage', async () => {
  for (const patch of [{housenumber:{toString:null}},{formatted:{toString:null}},{city:['SECRET']},{lat:{value:0}},{rank:{match_type:{toString:null}}},{datasource:{license:{toString:null}}}]) {
    let calls=0;
    const geocode=makeGeocoder({apiKey:'SECRET',fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({results:[calls===1 ? good() : {...good(),...patch}]})};}});
    const {results,summary}=await processRecords([{address:'A',housenumber:'12'},{address:'B',housenumber:'12'},{address:'C'}],{geocode,sleep:async()=>{}});
    assert.equal(calls,2); assert.equal(summary.provider_error_stopped_run,true);
    assert.equal(results[0].review_status,'ready_for_review');
    assert.equal(results[1].review_reasons,'invalid_provider_response');
    assert.equal(results[2].review_reasons,'not_requested_after_provider_error');
    assert.ok(!JSON.stringify(results).includes('SECRET'));
  }
});
test('CLI preflights unusable destinations before fetch and exports nested schema failures with exit 2', async () => {
  const root=fileURLToPath(new URL('..',import.meta.url)), dir=await mkdtemp(join(root,'.test-tmp-'));
  const cli=join(root,'src/cli.js'), input=join(dir,'input.csv'), preload=join(dir,'preload.mjs'), counter=join(dir,'requests.txt');
  try {
    await writeFile(input,'address,housenumber\nA,12\nB,12\n');
    await writeFile(preload,`import {appendFileSync} from 'node:fs'; globalThis.fetch=async()=>{appendFileSync(process.env.STUB_COUNTER,'1');return {ok:true,json:async()=>({results:[{housenumber:{toString:null},formatted:'SECRET_PAYLOAD'}]})};};`);
    const run=output=>spawnSync(process.execPath,['--import',pathToFileURL(preload).href,cli,'--input',input,'--output',output],{encoding:'utf8',env:{...process.env,GEOAPIFY_API_KEY:'SECRET_KEY',STUB_COUNTER:counter}});
    for (const output of [join(dir,'missing','review.csv'),join(input,'review.csv')]) {
      const result=run(output); assert.equal(result.status,1);
      await assert.rejects(access(counter));
    }
    const output=join(dir,'review.csv'), result=run(output);
    assert.equal(result.status,2); assert.equal(await readFile(counter,'utf8'),'1');
    const text=await readFile(output,'utf8'), parsed=parseCsv(text);
    assert.equal(parsed.records[0].review_reasons,'invalid_provider_response');
    assert.equal(parsed.records[1].review_reasons,'not_requested_after_provider_error');
    assert.ok(![text,result.stdout,result.stderr].join('').includes('SECRET'));
    assert.equal(run(output).status,1); assert.equal(await readFile(counter,'utf8'),'1');
  } finally { await rm(dir,{recursive:true,force:true}); }
});
test('CLI offline runs with no key, preserves input, refuses overwrite, malformed input and cap', async () => {
  const root=fileURLToPath(new URL('..',import.meta.url));
  const dir=await mkdtemp(join(root,'.test-tmp-'));
  const cli=join(root,'src/cli.js'), input=join(root,'examples/addresses.csv'), fixture=join(root,'examples/synthetic-responses.json'), output=join(dir,'review.csv');
  const run = extra=>spawnSync(process.execPath,[cli,'--input',input,'--output',output,'--offline',fixture,...extra],{encoding:'utf8',env:{...process.env,GEOAPIFY_API_KEY:''}});
  try {
    assert.equal(run([]).status,0); const before=await readFile(output,'utf8'); const parsed=parseCsv(before);
    assert.equal(parsed.records.length,8); assert.equal(parsed.records[0]['input.id'],'demo-1');
    assert.ok(parsed.records.every(r => r.provider_attribution.includes('Geoapify')));
    assert.ok(parsed.records.every(r => r.osm_license.includes('https://opendatacommons.org/licenses/odbl/1-0/')));
    assert.equal(run([]).status,1); assert.equal(await readFile(output,'utf8'),before);
    const capped=join(dir,'cap.csv');
    assert.equal(spawnSync(process.execPath,[cli,'--input',input,'--output',capped,'--offline',fixture,'--max-requests','1']).status,1);
    const broken=join(dir,'broken.csv'); await writeFile(broken,'address\n"oops');
    assert.equal(spawnSync(process.execPath,[cli,'--input',broken,'--output',join(dir,'bad.csv'),'--offline',fixture]).status,1);
    assert.equal(run(['--limit','0']).status,1);
    const invalidUtf8=join(dir,'encoding.csv'); await writeFile(invalidUtf8,Buffer.from([0x61,0x0a,0xff]));
    assert.equal(spawnSync(process.execPath,[cli,'--input',invalidUtf8,'--output',join(dir,'invalid.csv'),'--offline',fixture]).status,1);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
