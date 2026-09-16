import { loadEnvFile } from "node:process";
import { getPrisma } from "../src/prisma.js";
import { provisionAuthAccount } from "../src/auth-provision.js";

try{loadEnvFile();}catch{ /* CI may supply environment directly */ }
const args=process.argv.slice(2);
const option=(key:string)=>{const i=args.indexOf(key);return i>=0?args[i+1]:undefined;};
const email=option("--email"),displayName=option("--name"),role=option("--role");
async function main(){
  if(process.env.NODE_ENV==="production")throw new Error("Local-lab provisioning is disabled in production.");
  if(!email || !displayName || !role)throw new Error('Usage: npm run auth:provision -- --email person@example.test --name "Local Person" --role REQUESTER');
  const result=await provisionAuthAccount(getPrisma(),{email,displayName,role});
  if(result.created)console.log(`Local-only initial credential (shown once): ${result.email} ${result.password}`);
  else console.log("Account already exists. No credential, role or activation state was changed.");
}
void main().catch(()=>{
  console.error("Unable to provision account. Check arguments, use a new local fixture email, and verify migrations/database configuration. Existing Requester migration belongs to Issue #31.");
  process.exitCode=1;
}).finally(()=>getPrisma().$disconnect());
