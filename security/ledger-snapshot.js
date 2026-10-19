import { backup, DatabaseSync } from "node:sqlite";
import { chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function verify_ledger(path) {
  const db = new DatabaseSync(path,{readOnly:true});
  try {
    if (db.prepare("PRAGMA integrity_check").get().integrity_check!=="ok") throw new Error("Ledger integrity check failed.");
    for (const table of ["ai_usage","ai_reports","account_deletions"])
      if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))throw new Error("Snapshot is missing a required ledger table.");
    return true;
  } finally {db.close();}
}
/** SQLite's online backup API takes a consistent snapshot, including pending WAL transactions. */
export async function snapshot_ledger(source,destination) {
  const from=resolve(source),to=resolve(destination);
  if (!existsSync(from) || from===to || existsSync(to)) throw new Error("Use an existing ledger and a new snapshot destination.");
  verify_ledger(from);
  mkdirSync(dirname(to),{recursive:true,mode:0o700});
  const db=new DatabaseSync(from,{readOnly:true});
  let created=false;
  try {
    // Reserve the destination privately before SQLite opens it; never expose a default-mode file.
    const {openSync,closeSync}=await import("node:fs");const fd=openSync(to,"wx",0o600);created=true;closeSync(fd);
    await backup(db,to);chmodSync(to,0o600);verify_ledger(to);
  } catch(error){if(created && existsSync(to))unlinkSync(to);throw error;}
  finally {db.close();}
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [command,source,destination,flag]=process.argv.slice(2);
  if(command==="verify" && source) {verify_ledger(source);console.log("Ledger snapshot integrity verified.");}
  else if((command==="backup" || (command==="restore" && flag==="--backend-stopped")) && source && destination) {
    await snapshot_ledger(source,destination);console.log("Verified private ledger snapshot created.");
  } else throw new Error("Usage: ledger-snapshot.js verify SOURCE | backup SOURCE NEW_DESTINATION | restore SOURCE NEW_DESTINATION --backend-stopped");
}
