import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { createThrottledSaver } from "./throttledSaver";

beforeEach(()=>{vi.useFakeTimers();});
afterEach(()=>{vi.useRealTimers();});

describe("throttled saver",()=>{
 it("collapses a burst of changes into one save of the latest value",async()=>{
  const save=vi.fn();const saver=createThrottledSaver<number>(save,1000);
  for(let word=1;word<=50;word+=1)saver.schedule(word);
  expect(save).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1000);
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith(50);
 });
 it("keeps saving on schedule while changes never stop",async()=>{
  const save=vi.fn();const saver=createThrottledSaver<number>(save,1000);
  // A word every 300ms for 5 seconds would starve a debounce forever.
  for(let tick=1;tick<=17;tick+=1){saver.schedule(tick);await vi.advanceTimersByTimeAsync(300);}
  expect(save.mock.calls.length).toBeGreaterThanOrEqual(4);
  expect(save.mock.calls.length).toBeLessThanOrEqual(6);
 });
 it("saves immediately on flush and skips the pending timer",async()=>{
  const save=vi.fn();const saver=createThrottledSaver<string>(save,1000);
  saver.schedule("closing");
  await saver.flush();
  expect(save).toHaveBeenCalledWith("closing");
  await vi.advanceTimersByTimeAsync(2000);
  expect(save).toHaveBeenCalledTimes(1);
 });
 it("does nothing on flush when nothing changed",async()=>{
  const save=vi.fn();const saver=createThrottledSaver<string>(save,1000);
  await saver.flush();
  expect(save).not.toHaveBeenCalled();
 });
 it("runs saves one at a time and in order",async()=>{
  const order:string[]=[];let release=()=>{};
  const save=vi.fn((value:string)=>value==="first"?new Promise<void>(resolve=>{release=()=>{order.push(value);resolve();};}):void order.push(value));
  const saver=createThrottledSaver<string>(save,1000);
  saver.schedule("first");void saver.flush();
  saver.schedule("second");const done=saver.flush();
  await Promise.resolve();
  expect(order).toEqual([]);
  release();await done;
  expect(order).toEqual(["first","second"]);
 });
 it("reports a failed save and keeps saving later changes",async()=>{
  const onError=vi.fn();const save=vi.fn().mockRejectedValueOnce(new Error("disk full")).mockResolvedValue(undefined);
  const saver=createThrottledSaver<number>(save,1000,onError);
  saver.schedule(1);await saver.flush();
  saver.schedule(2);await saver.flush();
  expect(onError).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenLastCalledWith(2);
 });
});
