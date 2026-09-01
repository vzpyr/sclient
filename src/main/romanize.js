const path = require("path");
const kuromoji = require("kuromoji");
const Kuroshiro = require("kuroshiro").default;
const { pinyin } = require("pinyin");
const { transliterate } = require("transliteration");

const hasJapaneseRE = /[\u3040-\u309f\u30a0-\u30ff]/;
const hasChineseRE = /[\u4e00-\u9fff]/;
const romanOnlyRE = /^[\u0020-\u024f\u1e00-\u1eff\u2c60-\u2c7f\ua720-\ua7ff]*$/;

let kuroshiroReady = false;
let kuroshiroInstance = null;
let kuroshiroInitPromise = null;

function initKuroshiro() {
  if (kuroshiroInitPromise) return kuroshiroInitPromise;
  kuroshiroInitPromise = (async () => {
    const dictPath = path.join(path.dirname(require.resolve("kuromoji")), "..", "dict");
    const tokenizer = await new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath: dictPath }).build((err, t) => {
        if (err) reject(err);
        else resolve(t);
      });
    });
    kuroshiroInstance = new Kuroshiro();
    await kuroshiroInstance.init({
      init: () => Promise.resolve(),
      parse: (str) => Promise.resolve(tokenizer.tokenize(str)),
    });
    kuroshiroReady = true;
  })();
  return kuroshiroInitPromise;
}

initKuroshiro();

function isRomanText(text) {
  return romanOnlyRE.test(text);
}

function normalizeSegment(out) {
  if (out == null) return out;
  if (out.trim() === "") return " ";
  return out.trim().replace(/\s+/g, " ");
}

async function romanizeLine(text) {
  if (!text) return text;

  const match = text.match(/^(\s*)(.*?)(\s*)$/);
  const leading = match[1] || "";
  const innerText = match[2] || "";
  const trailing = match[3] || "";

  if (!innerText) return text;
  if (isRomanText(innerText)) return text;

  let result = innerText;

  if (hasJapaneseRE.test(innerText)) {
    if (!kuroshiroReady) await initKuroshiro();
    if (kuroshiroReady) {
      try {
        result = normalizeSegment(
          await kuroshiroInstance.convert(innerText, { to: "romaji", mode: "spaced" })
        );
      } catch (e) {
        result = innerText;
      }
    }
  } else if (hasChineseRE.test(innerText)) {
    try {
      result = normalizeSegment(
        pinyin(innerText, { segment: false, group: true })
          .map((g) => (Array.isArray(g) ? g.join("") : g))
          .join(" ")
      );
    } catch (e) {
      result = innerText;
    }
  } else {
    try {
      result = normalizeSegment(transliterate(innerText));
    } catch (e) {
      result = innerText;
    }
  }

  return leading + result + trailing;
}

async function romanizeLines(texts) {
  return Promise.all((texts || []).map((t) => romanizeLine(t)));
}

module.exports = { romanizeLine, romanizeLines, initKuroshiro, isRomanText };
