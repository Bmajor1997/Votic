import { parentPort, workerData } from "node:worker_threads";
import { convert_heif } from "./heif_image.js";
try { parentPort.postMessage({bytes:await convert_heif(Buffer.from(workerData.bytes))}); }
catch (error) {parentPort.postMessage({error:String(error?.message || "This HEIC/HEIF photo could not be read.")});}
