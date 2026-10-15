const fs=require('fs'),vm=require('vm');
module.exports=function harness(){let nodes=new Map(),data={},tasks=new Map(),counter=0;let seed=42;let math=Object.create(Math);math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
const document={body:{style:{}},getElementById(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',open:false,scrollTop:0,close(){this.open=false;this.onclose?.()},showModal(){this.open=true},addEventListener(){},querySelector(){return null}});return nodes.get(id)}};
const ctx=vm.createContext({console,crypto:require('crypto').webcrypto,Math:math,Date,localStorage:{setItem(k,v){data[k]=v},getItem(k){return data[k]||null},removeItem(k){delete data[k]}},document,setTimeout(fn){let id=++counter;tasks.set(id,fn);return id},clearTimeout(id){tasks.delete(id)},alert(){},confirm(){return true}});
vm.runInContext(fs.readFileSync('dist/index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1],ctx);vm.runInContext(fs.readFileSync('dist/expansion.js','utf8'),ctx);
const run=x=>vm.runInContext(x,ctx);run(`defs=${fs.readFileSync('dist/units.json','utf8')};prepareDefs();start(0)`);
return {run,nodes,data,tasks,drain(max=100){for(let i=0;i<max&&tasks.size;i++){let [id,fn]=tasks.entries().next().value;tasks.delete(id);fn();}},setRandom(x){math.random=()=>x;}};
};
