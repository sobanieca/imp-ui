// `imp build` — production bundle via esbuild (through Deno's npm interop).
// Reads index.html, bundles its module entry (code-split chunks for dynamic
// import()), hashes filenames, rewrites the HTML, and copies other assets.

import { dirname, extname, join, relative } from "jsr:@std/path@^1";

const SKIP = new Set([".git", "node_modules", "dist"]);

async function* walk(dir, base = dir) {
  for await (const entry of Deno.readDir(dir)) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory) yield* walk(path, base);
    else yield relative(base, path);
  }
}

export async function build({ root = Deno.cwd(), outdir = "dist" } = {}) {
  const esbuild = await import("npm:esbuild@^0.25");
  const htmlPath = join(root, "index.html");
  let htmlText;
  try {
    htmlText = await Deno.readTextFile(htmlPath);
  } catch {
    console.error("imp build: no index.html in " + root);
    Deno.exit(1);
  }
  const entryMatch = htmlText.match(
    /<script[^>]*type="module"[^>]*src="([^"]+)"/,
  );
  if (!entryMatch) {
    console.error(
      'imp build: index.html has no <script type="module" src="…"> entry',
    );
    Deno.exit(1);
  }
  const entrySrc = entryMatch[1];
  const out = join(root, outdir);

  const result = await esbuild.build({
    entryPoints: [join(root, entrySrc)],
    bundle: true,
    minify: true,
    format: "esm",
    splitting: true,
    sourcemap: true,
    outdir: out,
    entryNames: "[name]-[hash]",
    chunkNames: "chunk-[hash]",
    metafile: true,
  });
  await esbuild.stop();

  const entryOut = Object.entries(result.metafile.outputs)
    .find(([, meta]) => meta.entryPoint)?.[0];
  const entryName = relative(out, join(root, entryOut));

  // copy non-JS assets (css, images, fonts, extra html) as-is
  let copied = 0;
  for await (const rel of walk(root)) {
    const ext = extname(rel).toLowerCase();
    if (rel === "index.html" || ext === ".js" || ext === ".mjs") continue;
    const target = join(out, rel);
    await Deno.mkdir(dirname(target), { recursive: true });
    await Deno.copyFile(join(root, rel), target);
    copied++;
  }

  await Deno.writeTextFile(
    join(out, "index.html"),
    htmlText.replace(
      entryMatch[0],
      entryMatch[0].replace(entrySrc, "./" + entryName),
    ),
  );

  const bundled = Object.keys(result.metafile.outputs).filter((f) =>
    f.endsWith(".js")
  );
  console.log(`imp build → ${outdir}/`);
  for (const f of bundled) {
    const size = (result.metafile.outputs[f].bytes / 1024).toFixed(1);
    console.log(`  ${relative(out, join(root, f))}  ${size} kB`);
  }
  console.log(`  index.html (entry → ${entryName}) + ${copied} asset(s)`);
}
