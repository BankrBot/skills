#!/usr/bin/env node
import { mkdirSync, lstatSync, existsSync, readFileSync, openSync, writeSync, fsyncSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BdfxError, validateEvm, validateBitcoin, units, SKILL_REVISION } from './bdfx.mjs';
import { requestReview, normalizeFee } from './review.mjs';

const ENDPOINT = 'https://bdfx.io/bankr';
const need = (ok, code) => { if (!ok) throw new BdfxError(code, code); };
const requestId = id => typeof id === 'string' && /^bankr-request-[a-f0-9]{32}$/.test(id);
const uid = () => process.getuid();
function directory(path) {
  const stat = lstatSync(path); need(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === uid() && (stat.mode & 0o077) === 0, 'PRIVATE_STORAGE_REQUIRED');
}
function tokenPath(id, supplied) {
  if (supplied !== undefined) { need(isAbsolute(supplied), 'PRIVATE_TOKEN_FILE_REQUIRED'); directory(dirname(supplied)); return supplied; }
  const folder = resolve(tmpdir(), `bdfx-bankr-${uid()}`);
  if (!existsSync(folder)) mkdirSync(folder, { mode: 0o700 }); directory(folder);
  return resolve(folder, id + '.token');
}
function readToken(path) {
  need(typeof path === 'string' && isAbsolute(path), 'PRIVATE_TOKEN_FILE_REQUIRED');
  const stat = lstatSync(path);
  need(stat.isFile() && !stat.isSymbolicLink() && stat.uid === uid() && [0o400,0o600].includes(stat.mode & 0o777) && stat.size <= 128, 'PRIVATE_TOKEN_FILE_REQUIRED');
  const token = readFileSync(path,'utf8').trim(); need(/^[a-f0-9]{64}$/.test(token),'INVALID_TOKEN_FILE'); return token;
}
function intent(data) {
  need(data && typeof data.amount === 'string' && units(data.amount,18) > 0n && data.from?.symbol === 'eth' && data.from.network === 'base'
    && data.to?.symbol === 'btc' && data.to.network === 'mainnet' && data.additional_fee_percent === '0' && data.rate === 'floating', 'INVALID_ENROLLMENT_RESPONSE');
  validateBitcoin(data.btc_address); normalizeFee(data.fee_percent); return data;
}
export async function publicRequest(route, body, { fetcher = fetch, token } = {}) {
  const response = await fetcher(ENDPOINT+'?route='+route, { method:'POST', redirect:'error', signal:AbortSignal.timeout(45000),
    headers:{'Content-Type':'application/json',...(token ? {Authorization:'Bearer '+token} : {})},body:JSON.stringify(body) });
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.byteLength; need(size <= 1048576,'INVALID_ENROLLMENT_RESPONSE'); chunks.push(Buffer.from(chunk)); }
  need(response.headers.get('content-type')?.includes('application/json'),'INVALID_ENROLLMENT_RESPONSE');
  let result; try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new BdfxError('INVALID_ENROLLMENT_RESPONSE','INVALID_ENROLLMENT_RESPONSE'); }
  if (!response.ok || result.ok !== true) throw new BdfxError(/^[A-Z_]{3,64}$/.test(result.error) ? result.error : 'ENROLLMENT_FAILED','ENROLLMENT_FAILED');
  need(result.can_fund_live === false,'INVALID_ENROLLMENT_RESPONSE'); return result.data;
}
export async function connect(command, options, runtime = {}) {
  const fetcher = runtime.fetcher ?? fetch;
  if (command === 'fee-options') {
    const response = await fetcher(ENDPOINT+'?route=browser-info',{redirect:'error',signal:AbortSignal.timeout(15000)});
    const text = await response.text(); need(text.length < 8192,'INVALID_ENROLLMENT_RESPONSE');
    const result = JSON.parse(text), fees = result.fee_options;
    need(response.ok && result.ok === true && result.can_fund_live === false && fees?.enabled === true && Array.isArray(fees.percents)
      && fees.percents.every(p=>normalizeFee(p)===p) && fees.percents.includes(fees.default_percent) && fees.additional_fee_percent === '0','INVALID_ENROLLMENT_RESPONSE');
    return {ok:true,skill_revision:SKILL_REVISION,mode:'public_fee_discovery',fee_options:fees,can_fund_live:false};
  }
  if (command === 'start') {
    units(options.amount,18); validateBitcoin(options['btc-address']); const fee = normalizeFee(options['fee-percent']);
    const result = await publicRequest('start-agent',{amount:options.amount,btc_address:options['btc-address'],fee_percent:fee},{fetcher});
    need(requestId(result.request_id) && result.order_created === false && intent(result.intent).fee_percent === fee,'INVALID_ENROLLMENT_RESPONSE');
    return {ok:true,request_id:result.request_id,intent:result.intent,can_fund_live:false};
  }
  const id = options['request-id']; need(requestId(id),'INVALID_BANKR_REQUEST');
  if (command === 'begin') {
    const wallet = validateEvm(options['wallet-address']).toLowerCase();
    const result = await publicRequest('begin',{request_id:id,wallet_address:wallet},{fetcher});
    need(result.request_id === id && /^bankr-challenge-[a-f0-9]{32}$/.test(result.challenge_id) && result.wallet_address === wallet
      && Number.isSafeInteger(result.expires_at) && result.expires_at > Date.now()/1000 && typeof result.message === 'string'
      && result.message.startsWith('bdfx.io wants you to sign in with your Ethereum account:\n')
      && ['https://bdfx.io/bankr','https://bdfx.io/bankr.php'].some(uri =>
        result.message.includes('URI: '+uri+'\nVersion: 1\nChain ID: 8453\n')
        && result.message.includes(uri+'?request='+id)),'INVALID_ENROLLMENT_RESPONSE');
    intent(result.intent);
    let path=tokenPath(id,options['token-file']);
    if(options['token-file']===undefined && existsSync(path)) path=resolve(dirname(path),id+'.'+result.challenge_id+'.token');
    return {ok:true,...result,token_file:path};
  }
  if (command === 'verify') {
    const wallet = validateEvm(options['wallet-address']).toLowerCase(), path = tokenPath(id,options['token-file']);
    need(!existsSync(path),'REFUSE_TOKEN_OVERWRITE');
    need(/^bankr-challenge-[a-f0-9]{32}$/.test(options['challenge-id']),'INVALID_WALLET_CHALLENGE_ID');
    const raw = runtime.signatureInput ?? readFileSync(0,'utf8'); need(Buffer.byteLength(raw)<=8192,'INVALID_WALLET_SIGNATURE');
    const input = JSON.parse(raw); need(input && Object.keys(input).join(',')==='signature' && /^0x[a-fA-F0-9]{130}$/.test(input.signature),'INVALID_WALLET_SIGNATURE');
    const result = await publicRequest('verify',{request_id:id,challenge_id:options['challenge-id'],signature:input.signature},{fetcher});
    need(result.request_id === id && result.wallet_address === wallet && /^[a-f0-9]{64}$/.test(result.token)
      && Number.isSafeInteger(result.expires_at) && result.expires_at > Date.now()/1000 && result.expires_at <= Date.now()/1000+86500,'INVALID_ENROLLMENT_RESPONSE');
    intent(result.intent);
    const fd = openSync(path,'wx',0o600);
    try { const data=Buffer.from(result.token+'\n'); need(writeSync(fd,data)===data.length,'TOKEN_WRITE_FAILED'); fsyncSync(fd); } finally {closeSync(fd);}
    // Do not spread the credential-bearing response or print its token.
    return {ok:true,request_id:id,wallet_address:wallet,expires_at:result.expires_at,token_file:path,
      intent:result.intent,review_id:result.review_id,review_digest:result.review_digest,can_fund_live:false};
  }
  const path=tokenPath(id,options['token-file']), token=readToken(path), request=await publicRequest('agent-request',{request_id:id},{fetcher,token});
  need(request.id===id && typeof request.wallet_address==='string' && /^0x[a-f0-9]{40}$/.test(request.wallet_address),'INVALID_ENROLLMENT_RESPONSE');
  intent(request.intent);
  if(command==='inspect-request') return {ok:true,request_id:id,intent:request.intent,wallet_address:request.wallet_address,
    review_id:request.review_id,review_digest:request.review_digest,can_fund_live:false};
  if(command==='status-link') {
    const result=await publicRequest('view-link',{request_id:id},{fetcher,token}), url=new URL(result.status_url);
    need(result.read_only===true && url.origin==='https://bdfx.io' && ['/bankr','/bankr.php'].includes(url.pathname) && url.searchParams.get('request')===id,'INVALID_ENROLLMENT_RESPONSE');
    return {ok:true,...result,can_fund_live:false};
  }
  need(command==='review-request','COMMAND_DISABLED');
  const review=await requestReview('review',{'token-file':path,amount:request.intent.amount,'btc-address':request.intent.btc_address,
    'refund-address':request.wallet_address,'fee-percent':request.intent.fee_percent,key:id},{fetchImpl:fetcher,environment:{}});
  const linked=await publicRequest('attach',{request_id:id,review_id:review.data.review_id},{fetcher,token});
  need(linked.linked===true && linked.review_id===review.data.review_id,'INVALID_ENROLLMENT_RESPONSE'); return review;
}
const HELP = `BDFX public Bankr connection (Node 18+)
node connect.mjs fee-options
node connect.mjs start --amount AMOUNT --btc-address ADDRESS --fee-percent PERCENT
node connect.mjs begin --request-id ID --wallet-address ADDRESS [--token-file PRIVATE_PATH]
node connect.mjs verify --request-id ID --challenge-id ID --wallet-address ADDRESS [--token-file PRIVATE_PATH]
  verify reads {"signature":"0x..."} from stdin and saves the credential privately; never prints it.
node connect.mjs review-request --request-id ID [--token-file PRIVATE_PATH]
node connect.mjs inspect-request --request-id ID [--token-file PRIVATE_PATH]
node connect.mjs status-link --request-id ID [--token-file PRIVATE_PATH]
Defaults use a private temporary directory. Expired/missing credentials require a fresh off-chain connection.
None of these commands creates an order, claims a payment, signs or sends funds.`;
export async function main(argv,runtime={}) {
  const [command='help',...args]=argv;
  if(command==='help'&&!args.length){(runtime.stdout??process.stdout).write(JSON.stringify({ok:true,skill_revision:SKILL_REVISION,help:HELP})+'\n');return;}
  const required={ 'fee-options':[], start:['amount','btc-address','fee-percent'],begin:['request-id','wallet-address'],verify:['request-id','challenge-id','wallet-address'],
    'review-request':['request-id'],'inspect-request':['request-id'],'status-link':['request-id']};
  need(Object.hasOwn(required,command),'COMMAND_DISABLED'); const options={};
  for(let i=0;i<args.length;i+=2){const key=args[i]?.slice(2);need(args[i]?.startsWith('--')&&args[i+1]!==undefined&&!args[i+1].startsWith('--')
    &&[...required[command],'token-file'].includes(key)&&!Object.hasOwn(options,key),'INVALID_ARGUMENTS');options[key]=args[i+1];}
  need(required[command].every(k=>options[k]!==undefined),'INVALID_ARGUMENTS');
  (runtime.stdout??process.stdout).write(JSON.stringify(await connect(command,options,runtime),null,2)+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main(process.argv.slice(2)).catch(error=>{
  process.stderr.write((/^[A-Z_]{3,64}$/.test(error.code)?error.code:'PUBLIC_CONNECTION_FAILED')+'\n');process.exitCode=1;
});
