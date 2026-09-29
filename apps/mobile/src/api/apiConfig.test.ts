import { describe,expect,it } from "vitest";
import { clientHeaders,INSECURE_API_URL_MESSAGE,MISSING_API_URL_MESSAGE,resolveApiUrl } from "./apiConfig";

describe("Votic API address",()=>{
 it("uses the configured HTTPS server in release builds",()=>{
  expect(resolveApiUrl({isDevelopment:false,configuredUrl:"https://api.votic.app/",developmentHostUri:"192.168.1.5:8081"})).toBe("https://api.votic.app");
 });
 it("never falls back to a development host in release builds",()=>{
  expect(()=>resolveApiUrl({isDevelopment:false,developmentHostUri:"192.168.1.5:8081"})).toThrow(MISSING_API_URL_MESSAGE);
  expect(()=>resolveApiUrl({isDevelopment:false,configuredUrl:"  "})).toThrow(MISSING_API_URL_MESSAGE);
 });
 it("refuses plain HTTP in release builds",()=>{
  expect(()=>resolveApiUrl({isDevelopment:false,configuredUrl:"http://api.votic.app"})).toThrow(INSECURE_API_URL_MESSAGE);
 });
 it("allows a configured HTTP server during development",()=>{
  expect(resolveApiUrl({isDevelopment:true,configuredUrl:"http://10.0.0.4:4173"})).toBe("http://10.0.0.4:4173");
 });
 it("reaches the computer running Expo during development",()=>{
  expect(resolveApiUrl({isDevelopment:true,developmentHostUri:"192.168.1.5:8081"})).toBe("http://192.168.1.5:4173");
  expect(resolveApiUrl({isDevelopment:true})).toBe("http://localhost:4173");
 });
});

describe("Votic client key",()=>{
 it("sends the key only when configured",()=>{
  expect(clientHeaders("  abc-key  ")).toEqual({"X-Votic-Client-Key":"abc-key"});
  expect(clientHeaders(undefined)).toEqual({});
  expect(clientHeaders(" ")).toEqual({});
 });
});
