const IGNORE_NODE = 'imp-fmt-ignore'
const IGNORE_FILE = 'imp-fmt-ignore-file'

export const wasmUrl = (file) => new URL(`./vendor/${file}`, import.meta.url)

export const FMT_PLUGINS = [
  {
    file: 'typescript-0.96.1.wasm',
    url: 'https://plugins.dprint.dev/typescript-0.96.1.wasm',
    sha256: '9c52244de2c25a33addc7ddacff4443234a2dc4b5d3f34131262d1e0df35007c',
    extensions: ['js', 'mjs', 'cjs'],
    config: (fmt) => ({
      deno: true,
      quoteStyle: (fmt.singleQuote ?? true) ? 'preferSingle' : 'preferDouble',
      semiColons: (fmt.semiColons ?? false) ? 'always' : 'asi',
      ignoreNodeCommentText: IGNORE_NODE,
      ignoreFileCommentText: IGNORE_FILE,
    }),
  },
  {
    file: 'json-0.22.0.wasm',
    url: 'https://plugins.dprint.dev/json-0.22.0.wasm',
    sha256: 'eea81b9ca7d4a9c6d85c87c55a41d69e667dd06360d250094be854bf1a9bb972',
    extensions: ['json', 'jsonc'],
    config: () => ({ ignoreNodeCommentText: IGNORE_NODE }),
  },
  {
    file: 'markdown-0.22.1.wasm',
    url: 'https://plugins.dprint.dev/markdown-0.22.1.wasm',
    sha256: '4906fbb038977732aae0e216e4b0b957e2722f8d79282660ccb36d27dd051f17',
    extensions: ['md', 'markdown'],
    config: () => ({
      ignoreDirective: IGNORE_NODE,
      ignoreFileDirective: IGNORE_FILE,
      ignoreStartDirective: 'imp-fmt-ignore-start',
      ignoreEndDirective: 'imp-fmt-ignore-end',
    }),
  },
  {
    file: 'malva-v0.16.0.wasm',
    url: 'https://plugins.dprint.dev/g-plane/malva-v0.16.0.wasm',
    sha256: '1c1b31f972ef5aae052f97b6723aaf962e0175c5bbe4ba877e092512af354113',
    extensions: ['css', 'scss', 'sass', 'less'],
    config: () => ({
      ignoreCommentDirective: IGNORE_NODE,
      ignoreFileCommentDirective: IGNORE_FILE,
    }),
  },
  {
    file: 'markup_fmt-v0.27.3.wasm',
    url: 'https://plugins.dprint.dev/g-plane/markup_fmt-v0.27.3.wasm',
    sha256: '07cebe7cebf3660d15a92ad94888f2b04903ee0c1aabbb6a5b8a018720d04568',
    extensions: ['html', 'svg'],
    config: () => ({
      ignoreCommentDirective: IGNORE_NODE,
      ignoreFileCommentDirective: IGNORE_FILE,
    }),
  },
  {
    file: 'pretty_yaml-v0.6.0.wasm',
    url: 'https://plugins.dprint.dev/g-plane/pretty_yaml-v0.6.0.wasm',
    sha256: '40a2fdda7040317eb1b23520f3a00769a5571eedb049c4ca9175c1b9eeba01ae',
    extensions: ['yaml', 'yml'],
    config: () => ({ ignoreCommentDirective: IGNORE_NODE }),
  },
]

export const FMT_EXTENSIONS = new Set(FMT_PLUGINS.flatMap((plugin) => plugin.extensions))
