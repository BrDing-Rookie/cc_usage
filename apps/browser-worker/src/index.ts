import process from 'node:process';

let raw = '';
process.stdin.setEncoding('utf8');

for await (const chunk of process.stdin) {
  raw += chunk;
}

const job = raw.trim() ? JSON.parse(raw) : {};

console.log(
  JSON.stringify({
    ok: false,
    error: 'unsupported_source',
    job
  })
);
