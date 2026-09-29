/**
 * Saves the latest value at most once per interval. Unlike a debounce, a steady stream of changes
 * (such as word-by-word reading progress) still saves on schedule. Saves run one at a time, in order.
 */
export function createThrottledSaver<T>(save:(value:T)=>Promise<void>|void,intervalMs:number,onError:(error:unknown)=>void=()=>{}){
  let pending:{value:T}|null=null;
  let timer:ReturnType<typeof setTimeout>|null=null;
  let running:Promise<void>=Promise.resolve();
  function flush(){
    if(timer){clearTimeout(timer);timer=null;}
    const next=pending;pending=null;
    if(next)running=running.then(()=>save(next.value)).catch(onError);
    return running;
  }
  function schedule(value:T){
    pending={value};
    if(!timer)timer=setTimeout(()=>{timer=null;void flush();},intervalMs);
  }
  return {schedule,flush};
}
