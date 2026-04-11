import { initDB } from './src/db.js';
import { getAccountBalancesAsOf } from './src/db.js';

const dbPath = './splitboardqc.gnucash'; // The default path used by gnucash-web? Wait, looking at src/db.js or app.js... 

// Let's check how initDB is called.
import fs from 'fs';
const files = fs.readdirSync('.');
const dbFile = files.find(f => f.endsWith('.gnucash') || f.endsWith('.sqlite'));
console.log('Using DB:', dbFile);

initDB(dbFile);

const balances = getAccountBalancesAsOf('2025-12-31');

let htmlLiab = '';
let htmlEq = '';

let totalLiab = 0;
let totalEq = 0;

balances.forEach(a => {
  let type = a.account_type;
  let bal = a.balance;
  if(Math.abs(bal) < 0.01) return;

  if (['LIABILITY', 'CREDIT', 'PAYABLE'].includes(type)) {
    let dispBal = -bal; 
    totalLiab += dispBal;
    htmlLiab += `${a.name}: ${dispBal}\n`;
  }
  else if (['EQUITY'].includes(type)) {
    let dispBal = -bal; 
    totalEq += dispBal;
    htmlEq += `${a.name}: ${dispBal}\n`;
  }
});

console.log('LIAB:\n', htmlLiab);
console.log('EQ:\n', htmlEq);
console.log('TOTAL LIAB:', totalLiab);
console.log('TOTAL EQ:', totalEq);

const retainedEarnings = -balances.reduce((s, a) => ['INCOME', 'EXPENSE'].includes(a.account_type) ? s + a.balance : s, 0);
console.log('RETAINED EARNINGS:', retainedEarnings);

console.log('FINAL EQUITY:', totalEq + retainedEarnings);
