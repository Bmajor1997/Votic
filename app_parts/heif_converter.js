import { Worker } from "node:worker_threads";

export function convert_heif_isolated(bytes,{signal,timeoutMs=10000,workerUrl=new URL("./heif_worker.js",import.meta.url)}={}) {
  if (signal?.aborted) return Promise.reject(new Error("Photo conversion canceled."));
  return new Promise((resolve,reject)=>{
    const worker = new Worker(workerUrl,{workerData:{bytes},execArgv:[],resourceLimits:{maxOldGenerationSizeMb:256,maxYoungGenerationSizeMb:32,stackSizeMb:4}});
    let settled=false;
    const finish=(error,value)=>{
      if (settled) return; settled=true; clearTimeout(timer); signal?.removeEventListener("abort",abort);
      void worker.terminate().then(()=>error ? reject(error) : resolve(Buffer.from(value)),reject);
    };
    const abort=()=>finish(new Error("Photo conversion canceled."));
    const timer=setTimeout(()=>finish(new Error("Photo conversion took too long. Resize it and try again.")),timeoutMs);
    signal?.addEventListener("abort",abort,{once:true});
    worker.once("message",m=>m.error ? finish(new Error(m.error)) : m.bytes ? finish(null,m.bytes) : finish(new Error("Photo conversion failed.")));
    worker.once("error",error=>finish(error));
    worker.once("exit",()=>{if(!settled)finish(new Error("Photo conversion stopped unexpectedly."));});
    if(signal?.aborted)abort();
  });
}
