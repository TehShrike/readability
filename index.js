const path = require("path");
const fs = require("fs");
const url = require("url");

// We want to load Readability and JSDOMParser, which aren't set up as commonjs libraries,
// and so we need to do some hocus-pocus with 'vm' to import them on a separate scope
// (identical) scope context.
const vm = require("vm");
const readabilityPath = path.join(__dirname, "Readability.js");
const jsdomPath = path.join(__dirname, "JSDOMParser.js");


const scopeContext = {};
// We generally expect dump() and console.{whatever} to work, so make these available
// in the scope we're using:
scopeContext.dump = console.log;
scopeContext.console = console;
scopeContext.URL = url.URL;

// Actually load files. NB: if either of the files has parse errors,
// node is dumb and shows you a syntax error *at this callsite* . Don't try to find
// a syntax error on this line, there isn't one. Go look in the file it's loading instead.
vm.runInNewContext(fs.readFileSync(jsdomPath), scopeContext, jsdomPath);
vm.runInNewContext(fs.readFileSync(readabilityPath), scopeContext, readabilityPath);

module.exports = {
  Readability: scopeContext.Readability,
  JSDOMParser: scopeContext.JSDOMParser,
};
