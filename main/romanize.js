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
    try {
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
    } catch (e) {
      console.error("[romanize] kuroshiro init failed:", e);
    }
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
  if (isRomanText(text)) return normalizeSegment(text);

  if (hasJapaneseRE.test(text)) {
    if (!kuroshiroReady) await initKuroshiro();
    if (kuroshiroReady) {
      try {
        return normalizeSegment(
          await kuroshiroInstance.convert(text, { to: "romaji", mode: "spaced" })
        );
      } catch (e) {
        return text;
      }
    }
    return text;
  }

  if (hasChineseRE.test(text)) {
    try {
      return normalizeSegment(
        pinyin(text, { segment: false, group: true })
          .map((g) => (Array.isArray(g) ? g.join("") : g))
          .join(" ")
      );
    } catch (e) {
      return text;
    }
  }

  try {
    return normalizeSegment(transliterate(text));
  } catch (e) {
    return text;
  }
}

async function romanizeLines(texts) {
  return Promise.all((texts || []).map((t) => romanizeLine(t)));
}

module.exports = { romanizeLine, romanizeLines, initKuroshiro, isRomanText };
