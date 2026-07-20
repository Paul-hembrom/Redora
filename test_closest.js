const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const dom = new JSDOM(`<!DOCTYPE html><div class="group/bubble"><button id="btn"></button></div>`);
const btn = dom.window.document.getElementById("btn");
const bubble = btn.closest('.group\\/bubble');
console.log("Found:", !!bubble);
