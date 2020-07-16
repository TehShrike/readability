const JSDOM = require("jsdom").JSDOM;
const chai = require("chai");
chai.config.includeStack = true;
const expect = chai.expect;

const testPages = require("./utils").getTestPages();
const readabilityCheck = require("../Readability-readerable.js");

describe("isProbablyReaderable - test pages", () => {
  testPages.forEach(testPage => {
    const uri = "http://fakehost/test/page.html";
    describe(testPage.dir, () => {
      const doc = new JSDOM(testPage.source, {
        url: uri,
      }).window.document;
      const expected = testPage.expectedMetadata.readerable;
      it("The result should " + (expected ? "" : "not ") + "be readerable", () => {
        expect(readabilityCheck.isProbablyReaderable(doc)).eql(expected);
      });
    });
  });
});

