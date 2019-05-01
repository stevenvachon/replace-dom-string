"use strict";
const {after, before, beforeEach, describe, it} = require("mocha");
const puppeteer = require("puppeteer");
const puppeteerCoverage = require("puppeteer-to-istanbul");

const runInBrowser = func => () => page.evaluate(func);

let browser, page;



// @todo also use npmjs.com/puppeteer-firefox
before(async () =>
{
	browser = await puppeteer.launch({ args: ["--no-sandbox"] });
	page = await browser.newPage();

	page.on("console", msg => msg.args().forEach(async arg => console.log(await arg.jsonValue())));

	await Promise.all(
	[
		page.addScriptTag({ path: "node_modules/chai/chai.js" }),
		page.addScriptTag({ path: "temp.js" }),

		// @todo https://github.com/istanbuljs/puppeteer-to-istanbul/issues/18
		// @todo https://github.com/GoogleChrome/puppeteer/issues/3570
		page.coverage.startJSCoverage({ reportAnonymousScripts: true })
	]);

	await page.evaluate(() =>
	{
		window.expect = chai.expect;
		delete window.chai; // cleanup
	});
});



beforeEach(runInBrowser(() =>
{
	window.target = document.createElement("div");
}));



after(async () =>
{
	let coverage = await page.coverage.stopJSCoverage();

	// Exclude tools
	coverage = coverage.filter(({url}) => !url.includes("chai"));

	puppeteerCoverage.write(coverage);

	browser.close();
});



it("is a (bundled) function", runInBrowser(() =>
{
	expect(window.replaceDOMString).to.be.a("function");
}));



describe("Arguments", () =>
{
	it("accepts a string needle", runInBrowser(() =>
	{
		expect(() => replaceDOMString("n", "r", target)).not.to.throw();
	}));



	it("accepts a RegExp needle", runInBrowser(() =>
	{
		expect(() => replaceDOMString(/n/, "r", target)).not.to.throw();
	}));



	it("accepts an array of needles and replacements", runInBrowser(() =>
	{
		const calls =
		[
			() => replaceDOMString(["n"], ["r"], target),
			() => replaceDOMString([/n/], ["r"], target),
			() => replaceDOMString(["n1","n2"], ["r1","r2"], target),
			() => replaceDOMString([/n1/,"n2"], ["r1","r2"], target)
		];

		calls.forEach(call => expect(call).not.to.throw());
	}));



	it("rejects mismatching needle/replacement lengths", runInBrowser(() =>
	{
		const calls =
		[
			() => replaceDOMString(["n1","n2"], "r", target),
			() => replaceDOMString([/n1/,"n2"], "r", target),
			() => replaceDOMString("n", ["r1","r2"], target)
		];

		calls.forEach(call => expect(call).to.throw(TypeError));
	}));



	it("accepts mismatching (but singular) needle/replacement", runInBrowser(() =>
	{
		const calls =
		[
			() => replaceDOMString(["n"], "r", target),
			() => replaceDOMString([/n/], "r", target),
			() => replaceDOMString("n", ["r"], target),
			() => replaceDOMString(/n/, ["r"], target)
		];

		calls.forEach(call => expect(call).not.to.throw());
	}));



	it("rejects target if it's not a node", runInBrowser(() =>
	{
		const invalidTargets =
		[
			Symbol(1),
			Symbol('1'),
			{},
			[],
			/regex/,
			true,
			1,
			'1',
			null,
			undefined
		];

		invalidTargets.forEach(target =>
		{
			expect(() => replaceDOMString("n", "r", target)).to.throw(TypeError);
		});
	}));



	it("rejects options if it's not an object", runInBrowser(() =>
	{
		const invalidOptions =
		[
			Symbol(1),
			Symbol('1'),
			true,
			1,
			'1',
			null
		];

		const target = document.createElement("div");

		invalidOptions.forEach(options =>
		{
			expect(() => replaceDOMString("n", "r", target, options)).to.throw(TypeError);
		});
	}));



	it("rejects options if minimum properties are not true", runInBrowser(() =>
	{
		const options = { attributes:false, characterData:false };

		expect(() => replaceDOMString("n", "r", target, options)).to.throw(TypeError);
	}));
});



describe("HTML Attribute Values (default options)", () =>
{
	it("replaces instances of a single (string) needle", runInBrowser(() =>
	{
		target.setAttribute("attr", "{{var1}},{{var1}} {{var2}},{{var2}} {{var3}},{{var3}}");

		replaceDOMString("{{var1}}", "val1", target);
		expect(target.getAttribute("attr")).to.equal("val1,val1 {{var2}},{{var2}} {{var3}},{{var3}}");

		replaceDOMString("{{var2}}", "val2", target);
		expect(target.getAttribute("attr")).to.equal("val1,val1 val2,val2 {{var3}},{{var3}}");

		replaceDOMString("{{var3}}", "val3", target);
		expect(target.getAttribute("attr")).to.equal("val1,val1 val2,val2 val3,val3");
	}));



	it("replaces instances of a single (RegExp) needle", runInBrowser(() =>
	{
		target.setAttribute("attr", "{{var1}},{{var1}} {{var2}},{{var2}} {{var3}},{{var3}}");

		replaceDOMString(/\{\{var(\d)\}\}/g, "val$1", target);
		expect(target.getAttribute("attr")).to.equal("val1,val1 val2,val2 val3,val3");
	}));



	it("replaces instances of multiple (string) needles", runInBrowser(() =>
	{
		target.setAttribute("attr", "{{var1}},{{var1}} {{var2}},{{var2}} {{var3}},{{var3}}");

		const needles = ["{{var1}}", "{{var2}}", "{{var3}}"];
		const replacements = ["val1", "val2", "val3"];

		replaceDOMString(needles, replacements, target);
		expect(target.getAttribute("attr")).to.equal("val1,val1 val2,val2 val3,val3");
	}));



	it("replaces instances of multiple (RegExp) needles", runInBrowser(() =>
	{
		target.setAttribute("attr", "{{var1}},{{var2}} {{variable1}},{{variable2}}");

		const needles = [/\{\{var(\d)\}\}/g, /\{\{variable(\d)\}\}/g];
		const replacements = ["val$1", "value$1"];

		replaceDOMString(needles, replacements, target);
		expect(target.getAttribute("attr")).to.equal("val1,val2 value1,value2");
	}));



	it("supports nested elements", runInBrowser(() =>
	{
		const initialValue = "{{var1}},{{var1}} {{var2}},{{var2}} {{var3}},{{var3}}";
		target.setAttribute("attr", initialValue);
		target.innerHTML = `<nested attr="${initialValue}"></nested>`;

		const changedValue = "val1,val1 {{var2}},{{var2}} {{var3}},{{var3}}";
		replaceDOMString("{{var1}}", "val1", target);
		expect(target.getAttribute("attr")).to.equal(changedValue);
		expect(target.querySelector("nested").getAttribute("attr")).to.equal(changedValue);
	}));
});



describe("HTML Text Nodes (default options)", () =>
{
	it("replaces instances of a single (string) needle", runInBrowser(() =>
	{
		target.innerText = "{{var1}},{{var1}} {{var2}},{{var2}} {{var3}},{{var3}}";

		replaceDOMString("{{var1}}", "val1", target);
		expect(target.innerText).to.equal("val1,val1 {{var2}},{{var2}} {{var3}},{{var3}}");

		replaceDOMString("{{var2}}", "val2", target);
		expect(target.innerText).to.equal("val1,val1 val2,val2 {{var3}},{{var3}}");

		replaceDOMString("{{var3}}", "val3", target);
		expect(target.innerText).to.equal("val1,val1 val2,val2 val3,val3");
	}));



	it("replaces instances of a single (RegExp) needle", runInBrowser(() =>
	{
		target.innerText = "{{var1}},{{var1}} {{var2}},{{var2}} {{var3}},{{var3}}";

		replaceDOMString(/\{\{var(\d)\}\}/g, "val$1", target);
		expect(target.innerText).to.equal("val1,val1 val2,val2 val3,val3");
	}));



	it("replaces instances of multiple (string) needles", runInBrowser(() =>
	{
		target.innerText = "{{var1}},{{var1}} {{var2}},{{var2}} {{var3}},{{var3}}";

		const needles = ["{{var1}}", "{{var2}}", "{{var3}}"];
		const replacements = ["val1", "val2", "val3"];

		replaceDOMString(needles, replacements, target);
		expect(target.innerText).to.equal("val1,val1 val2,val2 val3,val3");
	}));



	it("replaces instances of multiple (RegExp) needles", runInBrowser(() =>
	{
		target.innerText = "{{var1}},{{var2}} {{variable1}},{{variable2}}";

		const needles = [/\{\{var(\d)\}\}/g, /\{\{variable(\d)\}\}/g];
		const replacements = ["val$1", "value$1"];

		replaceDOMString(needles, replacements, target);
		expect(target.innerText).to.equal("val1,val2 value1,value2");
	}));



	it("supports nested elements", runInBrowser(() =>
	{
		const initialValue = "{{var1}} {{var2}}";
		target.innerHTML = `${initialValue}<nested>${initialValue}</nested>`;

		const changedValue = "val1 {{var2}}";
		const changedHTML = `<div>${changedValue}<nested>${changedValue}</nested></div>`;
		replaceDOMString("{{var1}}", "val1", target);
		expect(target.outerHTML).to.equal(changedHTML);
	}));
});



describe("Custom Options", () =>
{
	beforeEach(runInBrowser(() =>
	{
		window.changedValue = "val1 {{var2}}";
		window.initialValue = "{{var1}} {{var2}}";

		target.setAttribute("attr", initialValue);
		target.innerHTML = `${initialValue}<nested attr="${initialValue}">${initialValue}</nested>`;
	}));



	after(runInBrowser(() =>
	{
		delete window.changedValue;
		delete window.initialValue;
	}));



	it("attributes = false", runInBrowser(() =>
	{
		const changedHTML = `<div attr="${initialValue}">${changedValue}<nested attr="${initialValue}">${changedValue}</nested></div>`;
		replaceDOMString("{{var1}}", "val1", target, { attributes:false });
		expect(target.outerHTML).to.equal(changedHTML);
	}));



	it("characterData = false", runInBrowser(() =>
	{
		const changedHTML = `<div attr="${changedValue}">${initialValue}<nested attr="${changedValue}">${initialValue}</nested></div>`;
		replaceDOMString("{{var1}}", "val1", target, { characterData:false });
		expect(target.outerHTML).to.equal(changedHTML);
	}));



	it("acceptAttribute = () => {…}", runInBrowser(() =>
	{
		target.innerHTML = `${initialValue}<nested1 attr1="${initialValue}" attr2="${initialValue}">${initialValue}<nested2 attr1="${initialValue}" attr2="${initialValue}">${initialValue}</nested2></nested1>`;

		const changedHTML = `<div attr="${changedValue}">${changedValue}<nested1 attr1="${changedValue}" attr2="${initialValue}">${changedValue}<nested2 attr1="${initialValue}" attr2="${changedValue}">${changedValue}</nested2></nested1></div>`;
		const acceptAttributeCalls = [];

		const acceptAttribute = ({name, ownerElement}) =>
		{
			acceptAttributeCalls.push(name);

			if (name === "attr")
			{
				return true;
			}
			else if (name==="attr1" && ownerElement.nodeName==="NESTED1")
			{
				return true;
			}
			else if (name==="attr2" && ownerElement.nodeName==="NESTED2")
			{
				return true;
			}
			else
			{
				return false;
			}
		};

		replaceDOMString("{{var1}}", "val1", target, {acceptAttribute});

		expect(target.outerHTML).to.equal(changedHTML);

		expect(acceptAttributeCalls).to.deep.equal(["attr", "attr1", "attr2", "attr1", "attr2"]);
	}));



	it("acceptNode = () => {…}", runInBrowser(() =>
	{
		target.innerHTML = `${initialValue}<nested1 attr="${initialValue}">${initialValue}<nested2 attr="${initialValue}">${initialValue}</nested2></nested1>`;

		const changedHTML = `<div attr="${changedValue}">${changedValue}<nested1 attr="${initialValue}">${changedValue}<nested2 attr="${initialValue}">${initialValue}</nested2></nested1></div>`;
		const acceptNodeCalls = [];

		const acceptNode = ({nodeName}) =>
		{
			acceptNodeCalls.push(nodeName);

			if (nodeName === "NESTED1")
			{
				return NodeFilter.FILTER_SKIP;
			}
			else if (nodeName === "NESTED2")
			{
				return NodeFilter.FILTER_REJECT;
			}
			else
			{
				return NodeFilter.FILTER_ACCEPT;
			}
		};

		replaceDOMString("{{var1}}", "val1", target, {acceptNode});

		expect(target.outerHTML).to.equal(changedHTML);

		expect(acceptNodeCalls).to.deep.equal(["DIV", "#text", "NESTED1", "#text", "NESTED2"]);
	}));



	it("subtree = false", runInBrowser(() =>
	{
		const changedHTML = `<div attr="${changedValue}">${changedValue}<nested attr="${initialValue}">${initialValue}</nested></div>`;
		replaceDOMString("{{var1}}", "val1", target, { subtree:false });
		expect(target.outerHTML).to.equal(changedHTML);
	}));
});



describe("Edge Cases", () =>
{
	it("supports a DocumentFragment", runInBrowser(() =>
	{
		const div = document.createElement("div");
		const target = document.createDocumentFragment();
		target.appendChild(div);
		div.setAttribute("attr", "{{var}}");
		div.innerText = "{{var}}";

		replaceDOMString("{{var}}", "val", target);
		expect(div.getAttribute("attr")).to.equal("val");
		expect(div.innerText).to.equal("val");
	}));



	it("supports an HTML Document", runInBrowser(() =>
	{
		const div = document.createElement("div");
		const target = document.implementation.createHTMLDocument();
		target.body.appendChild(div);
		div.setAttribute("attr", "{{var}}");
		div.innerText = "{{var}}";

		replaceDOMString("{{var}}", "val", target);
		expect(div.getAttribute("attr")).to.equal("val");
		expect(div.innerText).to.equal("val");
	}));



	it("supports an XML Document", runInBrowser(() =>
	{
		const tag = document.createElement("tag");
		const target = new Document(); // `contentType` === "application/xml"
		target.appendChild(tag);
		tag.setAttribute("attr", "{{var}}");
		tag.innerText = "{{var}}";

		replaceDOMString("{{var}}", "val", target);
		expect(tag.getAttribute("attr")).to.equal("val");
		expect(tag.innerText).to.equal("val");
	}));



	it("ignores the contents of an HTMLTemplateElement", runInBrowser(() =>
	{
		const div = document.createElement("div");
		const target = document.createElement("template");
		target.content.appendChild(div);
		div.setAttribute("attr", "{{var}}");
		div.innerText = "{{var}}";

		replaceDOMString("{{var}}", "val", target);
		expect(div.getAttribute("attr")).to.equal("{{var}}");
		expect(div.innerText).to.equal("{{var}}");
	}));



	it("ignores the contents of a nested HTMLTemplateElement", runInBrowser(() =>
	{
		const div = document.createElement("div");
		const target = document.createElement("div");
		const template = document.createElement("template");
		target.appendChild(template);
		template.content.appendChild(div);
		div.setAttribute("attr", "{{var}}");
		div.innerText = "{{var}}";

		replaceDOMString("{{var}}", "val", target);
		expect(div.getAttribute("attr")).to.equal("{{var}}");
		expect(div.innerText).to.equal("{{var}}");
	}));



	it("doesn't mutate unnecessary elements", runInBrowser(async () =>
	{
		const addedRemoved = [];

		const asyncMutation = () => new Promise(resolve => setTimeout(() => resolve(), 10));

		const handler = mutations =>
		{
			addedRemoved.push(...mutations.filter(({addedNodes, removedNodes}) =>
			{
				return addedNodes.length>0 || removedNodes.length>0;
			}));
		};

		const nested = document.createElement("nested");
		nested.innerText = "{{var}}";

		target.setAttribute("attr", "{{var}}");
		target.innerText = "{{var}}";

		new MutationObserver(handler).observe(target, { childList:true });

		target.appendChild(nested);

		// Ensure that observer is reliable
		await asyncMutation();
		expect(addedRemoved).to.have.length(1);

		// Reset
		addedRemoved.length = 0;
		expect(addedRemoved).to.be.empty;

		replaceDOMString("{{var}}", "val", target);
		expect(target.outerHTML).to.equal(`<div attr="val">val<nested>val</nested></div>`);
		expect(addedRemoved).to.be.empty;
	}));



	it("preserves expressions within needle when it is a string", runInBrowser(() =>
	{
		target.setAttribute("attr", "{{var001}}");
		target.innerText = "{{var001}}";

		replaceDOMString(String.raw`\{\{var(\d+)\}\}`, "val$1", target);
		expect(target.getAttribute("attr")).to.equal("{{var001}}");
		expect(target.innerText).to.equal("{{var001}}");
	}));



	it("preserves submatches within replacement when needle is a string", runInBrowser(() =>
	{
		target.setAttribute("attr", "{{var1}}");
		target.innerText = "{{var1}}";

		replaceDOMString("{{var1}}", "val$1", target);
		expect(target.getAttribute("attr")).to.equal("val$1");
		expect(target.innerText).to.equal("val$1");
	}));
});
