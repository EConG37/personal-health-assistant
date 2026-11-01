const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Inspect the actual Chromium typefaces, not just the declared CSS font stack.
module.exports = function fontAudit({wc, js, root}) {
  const stages = [];
  return async function check(stage) {
    const state = await js(`(async()=>{
      await document.fonts.ready;
      const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility==='visible'&&e.closest('svg')===null;
      const elements=[...document.querySelectorAll('body *')].filter(e=>visible(e)&&([...(e.childNodes)].some(n=>n.nodeType===3&&n.textContent.trim())||e.matches('input,textarea,select')));
      const mismatches=elements.filter(e=>getComputedStyle(e).fontFamily.split(',')[0].replace(/['\"]/g,'').trim()!=='PuHui').map(e=>({tag:e.tagName,id:e.id,family:getComputedStyle(e).fontFamily}));
      const faces=[...document.fonts].filter(f=>f.family==='PuHui').map(f=>({family:f.family,weight:f.weight,status:f.status}));
      const groups=new Map();
      for(const e of elements){const key=e.tagName+'|'+getComputedStyle(e).fontWeight;if(!groups.has(key))groups.set(key,e);}
      const samples=[...groups.values()].slice(0,24).map(e=>{e.dataset.fontAudit='sample-'+Math.random().toString(36).slice(2);return '[data-font-audit="'+e.dataset.fontAudit+'"]';});
      return {elements:elements.length,mismatches,faces,samples};
    })()`);
    assert.deepEqual(state.mismatches, [], 'Unexpected CSS font on ' + stage);
    assert(state.faces.length === 2 && state.faces.every(f => f.status === 'loaded'), 'Both bundled PuHui weights must load');
    const {root: doc} = await wc.debugger.sendCommand('DOM.getDocument');
    const used = [];
    for (const selector of state.samples) {
      const {nodeId} = await wc.debugger.sendCommand('DOM.querySelector', {nodeId: doc.nodeId, selector});
      const {fonts} = await wc.debugger.sendCommand('CSS.getPlatformFontsForNode', {nodeId});
      for (const font of fonts.filter(f => f.glyphCount > 0)) used.push({selector, family: font.familyName, custom: font.isCustomFont, glyphs: font.glyphCount});
    }
    const unexpected = used.filter(f => !f.custom || !/Alibaba.*PuHuiTi/i.test(f.family));
    for (const font of unexpected) font.text = await js('document.querySelector(' + JSON.stringify(font.selector) + ').textContent');
    assert.deepEqual(unexpected, [], 'Unexpected actual typeface on ' + stage);
    const result = {stage, elements: state.elements, samples: state.samples.length, actualFamilies: [...new Set(used.map(f => f.family))], ok: true};
    stages.push(result);
    const output = path.join(root, 'dist');
    fs.mkdirSync(output, {recursive: true});
    fs.writeFileSync(path.join(output, 'font-verification.json'), JSON.stringify({ok: true, stages}, null, 2) + '\n');
  };
};
