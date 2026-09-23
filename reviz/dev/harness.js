// Charge les fichiers .gs dans Node avec des services Google simulés.
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.join(__dirname, '..', 'src');

module.exports = function load(mocks) {
  const ctx = vm.createContext(Object.assign({
    console,
    HtmlService: { createHtmlOutputFromFile: (n) => ({ getContent: () => fs.readFileSync(path.join(SRC, n + '.html'), 'utf8') }) }
  }, mocks || {}));
  for (const f of fs.readdirSync(SRC).filter((f) => f.endsWith('.gs'))) {
    vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
};
