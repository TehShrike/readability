const JSDOM = require("jsdom").JSDOM;
const chai = require("chai");
const sinon = require("sinon");
chai.config.includeStack = true;
const expect = chai.expect;

const readability = require("../index");
const Readability = readability.Readability;
const JSDOMParser = readability.JSDOMParser;

const testPages = require("./utils").getTestPages();

function reformatError(err) {
  const formattedError = new Error(err.message);
  formattedError.stack = err.stack;
  return formattedError;
}

function inOrderTraverse(fromNode) {
  if (fromNode.firstChild) {
    return fromNode.firstChild;
  }
  while (fromNode && !fromNode.nextSibling) {
    fromNode = fromNode.parentNode;
  }
  return fromNode ? fromNode.nextSibling : null;
}

function inOrderIgnoreEmptyTextNodes(fromNode) {
  do {
    fromNode = inOrderTraverse(fromNode);
  } while (fromNode && fromNode.nodeType == 3 && !fromNode.textContent.trim());
  return fromNode;
}

function traverseDOM(callback, expectedDOM, actualDOM) {
  let actualNode = actualDOM.documentElement || actualDOM.childNodes[0];
  let expectedNode = expectedDOM.documentElement || expectedDOM.childNodes[0];
  while (actualNode || expectedNode) {
    // We'll stop if we don't have both actualNode and expectedNode
    if (!callback(actualNode, expectedNode)) {
      break;
    }
    actualNode = inOrderIgnoreEmptyTextNodes(actualNode);
    expectedNode = inOrderIgnoreEmptyTextNodes(expectedNode);
  }
}

// Collapse subsequent whitespace like HTML:
function htmlTransform(str) {
  return str.replace(/\s+/g, " ");
}

function runTestsWithItems(label, domGenerationFn, source, expectedContent, expectedMetadata) {
  describe(label, function() {
    this.timeout(10000);

    let result;

    before(() => {
      try {
        const doc = domGenerationFn(source);
        // Provide one class name to preserve, which we know appears in a few
        // of the test documents.
        const myReader = new Readability(doc, { classesToPreserve: [ "caption" ] });
        result = myReader.parse();
      } catch (err) {
        throw reformatError(err);
      }
    });

    it("should return a result object", () => {
      expect(result).to.include.keys("content", "title", "excerpt", "byline");
    });

    it("should extract expected content", () => {
      function nodeStr(n) {
        if (!n) {
          return "(no node)";
        }
        if (n.nodeType == 3) {
          return "#text(" + htmlTransform(n.textContent) + ")";
        }
        if (n.nodeType != 1) {
          return "some other node type: " + n.nodeType + " with data " + n.data;
        }
        let rv = n.localName;
        if (n.id) {
          rv += "#" + n.id;
        }
        if (n.className) {
          rv += ".(" + n.className + ")";
        }
        return rv;
      }

      function genPath(node) {
        if (node.id) {
          return "#" + node.id;
        }
        if (node.tagName == "BODY") {
          return "body";
        }
        const parent = node.parentNode;
        const parentPath = genPath(parent);
        const index = Array.prototype.indexOf.call(parent.childNodes, node) + 1;
        return parentPath + " > " + nodeStr(node) + ":nth-child(" + index + ")";
      }

      function findableNodeDesc(node) {
        return genPath(node) + "(in: ``" + node.parentNode.innerHTML + "``)";
      }

      function attributesForNode(node) {
        return Array.from(node.attributes).map(attr => attr.name + "=" + attr.value).join(",");
      }


      const actualDOM = domGenerationFn(result.content);
      const expectedDOM = domGenerationFn(expectedContent);
      traverseDOM((actualNode, expectedNode) => {
        if (actualNode && expectedNode) {
          const actualDesc = nodeStr(actualNode);
          const expectedDesc = nodeStr(expectedNode);
          if (actualDesc != expectedDesc) {
            expect(actualDesc, findableNodeDesc(actualNode)).eql(expectedDesc);
            return false;
          }
          // Compare text for text nodes:
          if (actualNode.nodeType == 3) {
            const actualText = htmlTransform(actualNode.textContent);
            const expectedText = htmlTransform(expectedNode.textContent);
            expect(actualText, findableNodeDesc(actualNode)).eql(expectedText);
            if (actualText != expectedText) {
              return false;
            }
          // Compare attributes for element nodes:
          } else if (actualNode.nodeType == 1) {
            const actualNodeDesc = attributesForNode(actualNode);
            const expectedNodeDesc = attributesForNode(expectedNode);
            const desc = "node " + nodeStr(actualNode) + " attributes (" + actualNodeDesc + ") should match (" + expectedNodeDesc + ") ";
            expect(actualNode.attributes.length, desc).eql(expectedNode.attributes.length);
            for (let i = 0; i < actualNode.attributes.length; i++) {
              const attr = actualNode.attributes[i].name;
              const actualValue = actualNode.getAttribute(attr);
              const expectedValue = expectedNode.getAttribute(attr);
              expect(expectedValue, "node (" + findableNodeDesc(actualNode) + ") attribute " + attr + " should match").eql(actualValue);
            }
          }
        } else {
          expect(nodeStr(actualNode), "Should have a node from both DOMs").eql(nodeStr(expectedNode));
          return false;
        }
        return true;
      }, actualDOM, expectedDOM);
    });

    it("should extract expected title", () => {
      expect(expectedMetadata.title).eql(result.title);
    });

    it("should extract expected byline", () => {
      expect(expectedMetadata.byline).eql(result.byline);
    });

    it("should extract expected excerpt", () => {
      expect(expectedMetadata.excerpt).eql(result.excerpt);
    });

    it("should extract expected site name", () => {
      expect(expectedMetadata.siteName).eql(result.siteName);
    });

    expectedMetadata.dir && it("should extract expected direction", () => {
      expect(expectedMetadata.dir).eql(result.dir);
    });
  });
}

function removeCommentNodesRecursively(node) {
  for (let i = node.childNodes.length - 1; i >= 0; i--) {
    const child = node.childNodes[i];
    if (child.nodeType === child.COMMENT_NODE) {
      node.removeChild(child);
    } else if (child.nodeType === child.ELEMENT_NODE) {
      removeCommentNodesRecursively(child);
    }
  }
}

describe("Readability API", () => {
  describe("#constructor", () => {
    const doc = new JSDOMParser().parse("<html><div>yo</div></html>");
    it("should accept a debug option", () => {
      expect(new Readability(doc)._debug).eql(false);
      expect(new Readability(doc, { debug: true })._debug).eql(true);
    });

    it("should accept a nbTopCandidates option", () => {
      expect(new Readability(doc)._nbTopCandidates).eql(5);
      expect(new Readability(doc, { nbTopCandidates: 42 })._nbTopCandidates).eql(42);
    });

    it("should accept a maxElemsToParse option", () => {
      expect(new Readability(doc)._maxElemsToParse).eql(0);
      expect(new Readability(doc, { maxElemsToParse: 42 })._maxElemsToParse).eql(42);
    });

    it("should accept a keepClasses option", () => {
      expect(new Readability(doc)._keepClasses).eql(false);
      expect(new Readability(doc, { keepClasses: true })._keepClasses).eql(true);
      expect(new Readability(doc, { keepClasses: false })._keepClasses).eql(false);
    });
  });

  describe("#parse", () => {
    const exampleSource = testPages[0].source;

    it("shouldn't parse oversized documents as per configuration", () => {
      const doc = new JSDOMParser().parse("<html><div>yo</div></html>");
      expect(() => {
        new Readability(doc, { maxElemsToParse: 1 }).parse();
      }).to.Throw("Aborting parsing document; 2 elements found");
    });

    it("should run _cleanClasses with default configuration", () => {
      const doc = new JSDOMParser().parse(exampleSource);
      const parser = new Readability(doc);

      parser._cleanClasses = sinon.fake();

      parser.parse();

      expect(parser._cleanClasses.called).eql(true);
    });

    it("should run _cleanClasses when option keepClasses = false", () => {
      const doc = new JSDOMParser().parse(exampleSource);
      const parser = new Readability(doc, { keepClasses: false });

      parser._cleanClasses = sinon.fake();

      parser.parse();

      expect(parser._cleanClasses.called).eql(true);
    });

    it("shouldn't run _cleanClasses when option keepClasses = true", () => {
      const doc = new JSDOMParser().parse(exampleSource);
      const parser = new Readability(doc, { keepClasses: true });

      parser._cleanClasses = sinon.fake();

      parser.parse();

      expect(parser._cleanClasses.called).eql(false);
    });
  });
});

describe("Test pages", () => {
  testPages.forEach(testPage => {
    describe(testPage.dir, () => {
      const uri = "http://fakehost/test/page.html";

      runTestsWithItems("jsdom", source => {
        const doc = new JSDOM(source, {
          url: uri,
        }).window.document;
        removeCommentNodesRecursively(doc);
        return doc;
      }, testPage.source, testPage.expectedContent, testPage.expectedMetadata);

      runTestsWithItems("JSDOMParser", source => {
        const parser = new JSDOMParser();
        const doc = parser.parse(source, uri);
        if (parser.errorState) {
          console.error("Parsing this DOM caused errors:", parser.errorState);
          return null;
        }
        return doc;
      }, testPage.source, testPage.expectedContent, testPage.expectedMetadata);
    });
  });
});
