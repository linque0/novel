// Minimal JS beautifier: string/template/regex-aware, newline after ; { } and indent.
import fs from 'node:fs';
import path from 'node:path';

function beautify(src) {
  let out = '';
  let indent = 0;
  let i = 0;
  let prevSignificant = ''; // last non-space emitted char
  const n = src.length;
  const pad = () => '  '.repeat(Math.max(0, Math.min(indent, 60)));

  // crude heuristic for regex-start: previous significant char cannot end an expression
  const regexAllowed = () => !/[A-Za-z0-9_$)\]}"'`]/.test(prevSignificant);

  while (i < n) {
    const c = src[i];

    // strings
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === quote) { j++; break; }
        if (quote === '`' && src[j] === '$' && src[j + 1] === '{') {
          // keep template expressions inline (rare in minified output)
          j += 2;
          let depth = 1;
          while (j < n && depth > 0) {
            if (src[j] === '\\') { j += 2; continue; }
            if (src[j] === '{') depth++;
            else if (src[j] === '}') depth--;
            j++;
          }
          continue;
        }
        j++;
      }
      out += src.slice(i, j);
      prevSignificant = quote;
      i = j;
      continue;
    }

    // line comment
    if (c === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      i = end === -1 ? n : end;
      continue;
    }
    // block comment
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    // regex literal
    if (c === '/' && regexAllowed()) {
      let j = i + 1;
      let cls = false;
      let ok = false;
      while (j < n) {
        const d = src[j];
        if (d === '\\') { j += 2; continue; }
        if (d === '\n') break;
        if (d === '[') cls = true;
        else if (d === ']') cls = false;
        else if (d === '/' && !cls) { j++; ok = true; break; }
        j++;
      }
      if (ok) {
        while (j < n && /[a-z]/i.test(src[j])) j++;
        out += src.slice(i, j);
        prevSignificant = 'a';
        i = j;
        continue;
      }
    }

    if (c === '{') {
      // object literal vs block: add space before opening brace of object
      out += (prevSignificant && /[A-Za-z0-9_$)\]}.'"`]/.test(prevSignificant) && prevSignificant !== '{' && prevSignificant !== ',' && prevSignificant !== ';') ? ' {' : '{';
      indent++;
      out += '\n' + pad();
      prevSignificant = '{';
      i++;
      continue;
    }
    if (c === '}') {
      indent = Math.max(0, indent - 1);
      out = out.replace(/[ \t]+$/, '');
      out += '\n' + pad() + '}';
      prevSignificant = '}';
      i++;
      // trailing comma / semicolon right after
      continue;
    }
    if (c === ';') {
      out += ';\n' + pad();
      prevSignificant = ';';
      i++;
      continue;
    }
    if (c === ',') {
      out += ', ';
      prevSignificant = ',';
      i++;
      continue;
    }
    out += c;
    if (!/\s/.test(c)) prevSignificant = c;
    i++;
  }

  // collapse excessive blank lines
  return out.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n');
}

const dir = process.argv[2] || 'chunks';
const outDir = process.argv[3] || 'pretty';
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.js')) continue;
  if (f.startsWith('polyfills')) continue;
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const pretty = beautify(src);
  const target = path.join(outDir, f.replace(/\.js$/, '.pretty.js'));
  fs.writeFileSync(target, pretty);
  console.log(`${f} -> ${(pretty.length / 1024).toFixed(0)}KB`);
}
