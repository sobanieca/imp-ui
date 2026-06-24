// Layer 1 — reusable styles. css`` returns a content-hashed class name;
// the rule lives in one shared constructable stylesheet (see notes §1.7).
// Dynamic per-instance values belong in inline `style`, not here.

let sheet = null;

function getSheet() {
  if (!sheet) {
    sheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }
  return sheet;
}

const classByText = new Map();
const usedNames = new Set();

// FNV-1a, 32-bit. Math.imul keeps the multiply in integer range;
// >>> 0 reinterprets as unsigned before base36 encoding.
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function css(strings, ...values) {
  for (const v of values) {
    if (typeof v === "function") {
      throw new Error(
        "css``: function interpolation is not allowed — " +
          "reactive/per-instance values go in inline `style`, not shared rules",
      );
    }
  }
  const text = String.raw({ raw: strings }, ...values);

  let name = classByText.get(text);
  if (name) return name;

  name = "imp-" + fnv1a(text);
  while (usedNames.has(name)) name += "_";
  usedNames.add(name);

  getSheet().insertRule(`.${name} { ${text} }`);
  classByText.set(text, name);
  return name;
}
