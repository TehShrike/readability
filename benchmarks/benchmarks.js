const getTestPages = require("../test/utils").getTestPages;

const readability = require("../index.js");
const readabilityCheck = require("../Readability-readerable.js");
const JSDOM = require("jsdom").JSDOM;
const Readability = readability.Readability;
const JSDOMParser = readability.JSDOMParser;

const referenceTestPages = [
  "002",
  "herald-sun-1",
  "lifehacker-working",
  "lifehacker-post-comment-load",
  "medium-1",
  "medium-2",
  "salon-1",
  "tmz-1",
  "wapo-1",
  "wapo-2",
  "webmd-1",
];

let testPages = getTestPages();

if (process.env.READABILITY_PERF_REFERENCE === "1") {
  testPages = testPages.filter(testPage => referenceTestPages.indexOf(testPage.dir) !== -1);
}

suite("JSDOMParser test page perf", () => {
  set("iterations", 1);
  set("type", "static");

  testPages.forEach(testPage => {
    bench(testPage.dir + " document parse perf", () => {
      new JSDOMParser().parse(testPage.source);
    });
  });
});


suite("Readability test page perf", () => {
  set("iterations", 1);
  set("type", "static");

  testPages.forEach(testPage => {
    const doc = new JSDOMParser().parse(testPage.source);
    bench(testPage.dir + " readability perf", () => {
      new Readability(doc).parse();
    });
  });
});

suite("isProbablyReaderable perf", () => {
  set("iterations", 1);
  set("type", "static");

  testPages.forEach(testPage => {
    const uri = "http://fakehost/test/page.html";
    const doc = new JSDOM(testPage.source, {
      url: uri,
    }).window.document;
    bench(testPage.dir + " readability perf", () => {
      readabilityCheck.isProbablyReaderable(doc);
    });
  });
});
