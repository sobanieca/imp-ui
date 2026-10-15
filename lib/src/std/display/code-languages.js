import { impLogger } from '../../logger.js'

const C_LIKE = {
  lineComments: ['//'],
  blockComments: [['/*', '*/']],
  strings: ['"', "'"],
  literals: 'true false null',
  capitalTypes: true,
  decorators: true,
}

const HASH_COMMENTS = {
  lineComments: ['#'],
  blockComments: [],
  strings: ['"', "'"],
}

const JAVASCRIPT_KEYWORDS =
  'as async await break case catch class const continue debugger default delete do else enum '
  + 'export extends finally for from function get if implements import in instanceof interface let '
  + 'new of package private protected public return set static super switch this throw try typeof '
  + 'var void while with yield'

const TYPESCRIPT_KEYWORDS =
  `${JAVASCRIPT_KEYWORDS} abstract asserts declare infer is keyof `
  + 'module namespace override readonly satisfies type'

const SHELL_KEYWORDS =
  'if then else elif fi for while until do done case esac in function select time coproc return '
  + 'break continue local export readonly declare typeset unset shift exit'

const SHELL_COMMANDS =
  'echo printf cd pwd ls cat grep sed awk read test source alias eval exec set trap wait kill '
  + 'sleep mkdir rm cp mv chmod chown touch curl wget tar git npm npx deno node python pip docker '
  + 'make sudo apt brew ssh scp find xargs sort uniq head tail tee tr cut wc which env dirname '
  + 'basename'

const SQL_KEYWORDS =
  'add all alter and any as asc backup begin between by case cascade check column commit '
  + 'constraint create cross database default delete desc distinct drop else end exec exists '
  + 'explain fetch foreign from full grant group having if in index inner insert into is join key '
  + 'left like limit merge not null offset on or order outer over partition primary procedure '
  + 'recursive references replace returning returns revoke right rollback row rows schema select '
  + 'set table then top transaction trigger truncate union unique update using values view when '
  + 'where window with int integer varchar text boolean timestamp date time numeric decimal float '
  + 'double bigint smallint char varying array json jsonb uuid interval serial'

const LANGUAGES = {
  text: { scanner: 'text' },
  javascript: {
    ...C_LIKE,
    strings: ['"', "'", '`'],
    multilineStrings: ['`'],
    keywords: JAVASCRIPT_KEYWORDS,
    literals: 'true false null undefined NaN Infinity',
    regex: true,
    keyValue: ':',
  },
  typescript: {
    ...C_LIKE,
    strings: ['"', "'", '`'],
    multilineStrings: ['`'],
    keywords: TYPESCRIPT_KEYWORDS,
    literals: 'true false null undefined NaN Infinity',
    types: 'string number boolean object symbol bigint any unknown never void',
    regex: true,
    keyValue: ':',
  },
  json: {
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    strings: ['"'],
    literals: 'true false null',
    stringKeys: true,
  },
  html: { scanner: 'html' },
  css: { scanner: 'css' },
  scss: { scanner: 'css', scss: true },
  markdown: { scanner: 'markdown' },
  diff: { scanner: 'diff' },
  bash: {
    ...HASH_COMMENTS,
    keywords: SHELL_KEYWORDS,
    builtins: SHELL_COMMANDS,
    literals: 'true false',
    variables: /^\$(?:\{[^}\n]*\}|\([^)\n]*\)|\w+|[@*#?$!-])/,
    flags: true,
  },
  python: {
    ...HASH_COMMENTS,
    tripleStrings: true,
    stringPrefix: /^[rRbBfFuU]{1,2}(?=['"])/,
    keywords:
      'and as assert async await break case class continue def del elif else except '
      + 'finally for from global if import in is lambda match nonlocal not or pass raise return '
      + 'try while with yield',
    literals: 'True False None',
    builtins:
      'print len range str int float list dict set tuple bool type isinstance open '
      + 'enumerate zip map filter sorted sum min max abs any all input super repr hasattr getattr',
    capitalTypes: true,
    decorators: true,
  },
  ruby: {
    ...HASH_COMMENTS,
    blockComments: [['=begin', '=end']],
    keywords:
      'alias and begin break case class def do else elsif end ensure for if in module '
      + 'next not or redo rescue retry return self super then undef unless until when while yield '
      + 'require require_relative include extend attr_accessor attr_reader attr_writer private '
      + 'public protected raise puts lambda proc',
    literals: 'true false nil',
    variables: /^[@$]{1,2}\w+/,
    extraTokens: [[/^:[A-Za-z_]\w*[?!]?/, 'literal']],
    capitalTypes: true,
  },
  php: {
    ...C_LIKE,
    lineComments: ['//', '#'],
    keywords:
      'abstract and array as break callable case catch class clone const continue '
      + 'declare default do echo else elseif empty enum extends final finally fn for foreach '
      + 'function global goto if implements include include_once instanceof insteadof interface '
      + 'isset list match namespace new or print private protected public readonly require '
      + 'require_once return static switch throw trait try unset use var while xor yield',
    literals: 'true false null TRUE FALSE NULL',
    variables: /^\$\w+/,
    extraTokens: [[/^<\?php|^\?>/, 'keyword']],
  },
  go: {
    ...C_LIKE,
    strings: ['"', "'", '`'],
    multilineStrings: ['`'],
    keywords:
      'break case chan const continue default defer else fallthrough for func go goto '
      + 'if import interface map package range return select struct switch type var',
    literals: 'true false nil iota',
    types:
      'bool byte complex64 complex128 error float32 float64 int int8 int16 int32 int64 '
      + 'rune string uint uint8 uint16 uint32 uint64 uintptr any',
    builtins: 'append cap close copy delete len make new panic print println recover',
    keyValue: ':',
  },
  rust: {
    ...C_LIKE,
    strings: ['"'],
    keywords:
      'as async await break const continue crate dyn else enum extern fn for if impl in '
      + 'let loop match mod move mut pub ref return self Self static struct super trait type '
      + 'unsafe use where while',
    literals: 'true false None Some Ok Err',
    types: 'bool char f32 f64 i8 i16 i32 i64 i128 isize str u8 u16 u32 u64 u128 usize',
    extraTokens: [
      [/^'(?:\\.|[^'\\\n])'/, 'string'],
      [/^'[A-Za-z_]\w*/, 'type'],
    ],
    macros: true,
    keyValue: ':',
  },
  java: {
    ...C_LIKE,
    keywords:
      'abstract assert break case catch class const continue default do else enum '
      + 'extends final finally for goto if implements import instanceof interface native new '
      + 'package permits private protected public record return sealed static strictfp super '
      + 'switch synchronized this throw throws transient try var volatile while yield',
    types: 'boolean byte char double float int long short void',
  },
  kotlin: {
    ...C_LIKE,
    strings: ['"', "'"],
    tripleStrings: true,
    keywords:
      'abstract actual annotation as break by catch class companion const constructor '
      + 'continue crossinline data do dynamic else enum expect external final finally for fun get '
      + 'if import in infix init inline inner interface internal is lateinit noinline object open '
      + 'operator out override package private protected public reified return sealed set super '
      + 'suspend tailrec this throw try typealias typeof val var vararg when where while',
    keyValue: ':',
  },
  swift: {
    ...C_LIKE,
    keywords:
      'actor any as associatedtype async await break case catch class continue default '
      + 'defer deinit do else enum extension fallthrough fileprivate for func guard if import in '
      + 'init inout internal is let open operator private protocol public repeat rethrows return '
      + 'self Self some static struct subscript super switch throw throws try typealias var where '
      + 'while',
    literals: 'true false nil',
  },
  dart: {
    ...C_LIKE,
    keywords:
      'abstract as assert async await break case catch class const continue covariant '
      + 'default deferred do dynamic else enum export extends extension external factory final '
      + 'finally for get hide if implements import in interface is late library mixin new on '
      + 'operator part required rethrow return sealed set show static super switch sync this '
      + 'throw try typedef var void when while with yield',
    types: 'int double num bool void dynamic',
    keyValue: ':',
  },
  scala: {
    ...C_LIKE,
    tripleStrings: true,
    keywords:
      'abstract case catch class def derives do else end enum export extends extension '
      + 'final finally for given if implicit import lazy match new object override package '
      + 'private protected return sealed super then this throw trait try type using val var '
      + 'while with yield',
  },
  c: {
    ...C_LIKE,
    keywords:
      'auto break case const continue default do else enum extern for goto if inline '
      + 'register restrict return sizeof static struct switch typedef union volatile while',
    literals: 'true false NULL',
    types:
      'bool char double float int long short signed unsigned void size_t int8_t int16_t '
      + 'int32_t int64_t uint8_t uint16_t uint32_t uint64_t FILE',
    directive: '#',
    capitalTypes: false,
  },
  cpp: {
    ...C_LIKE,
    keywords:
      'alignas alignof and asm auto break case catch class compl concept const '
      + 'consteval constexpr constinit const_cast continue co_await co_return co_yield decltype '
      + 'default delete do dynamic_cast else enum explicit export extern final for friend goto if '
      + 'inline mutable namespace new noexcept not operator or override private protected public '
      + 'register reinterpret_cast requires return sizeof static static_assert static_cast struct '
      + 'switch template this throw try typedef typeid typename union using virtual volatile '
      + 'while xor',
    literals: 'true false nullptr NULL',
    types:
      'bool char char8_t char16_t char32_t double float int long short signed unsigned '
      + 'void wchar_t size_t string vector map set unordered_map shared_ptr unique_ptr auto',
    directive: '#',
  },
  csharp: {
    ...C_LIKE,
    stringPrefix: /^[@$]{1,2}(?=")/,
    keywords:
      'abstract as async await base break case catch checked class const continue '
      + 'default delegate do else enum event explicit extern file finally fixed for foreach get '
      + 'goto if implicit in init interface internal is lock namespace new operator out override '
      + 'params private protected public readonly record ref required return sealed set sizeof '
      + 'stackalloc static struct switch this throw try typeof unchecked unsafe using value '
      + 'virtual volatile when where while with yield',
    types:
      'bool byte char decimal double dynamic float int long object sbyte short string uint '
      + 'ulong ushort var void',
  },
  sql: {
    lineComments: ['--'],
    blockComments: [['/*', '*/']],
    strings: ["'", '"', '`'],
    keywords: SQL_KEYWORDS,
    literals: 'true false null',
    caseInsensitive: true,
  },
  yaml: {
    ...HASH_COMMENTS,
    identifier: /^[\p{L}_][\p{L}\p{N}_.-]*/u,
    literals: 'true false null yes no on off True False Null Yes No On Off TRUE FALSE NULL ~',
    keyValue: ':',
    stringKeys: true,
    extraTokens: [
      [/^(?:---|\.\.\.)(?=\s|$)/, 'punctuation'],
      [/^[&*][\w-]+/, 'variable'],
      [/^!![\w-]+/, 'keyword'],
    ],
  },
  toml: {
    ...HASH_COMMENTS,
    tripleStrings: true,
    identifier: /^[\p{L}_][\p{L}\p{N}_.-]*/u,
    literals: 'true false inf nan',
    keyValue: '=',
    extraTokens: [[/^\[\[?[^\]\n]*\]\]?/, 'type']],
  },
  ini: {
    ...HASH_COMMENTS,
    lineComments: ['#', ';'],
    identifier: /^[\p{L}_][\p{L}\p{N}_.-]*/u,
    literals: 'true false yes no on off',
    keyValue: '=',
    extraTokens: [[/^\[[^\]\n]*\]/, 'type']],
  },
  dockerfile: {
    ...HASH_COMMENTS,
    keywords:
      'FROM RUN CMD LABEL MAINTAINER EXPOSE ENV ADD COPY ENTRYPOINT VOLUME USER WORKDIR '
      + 'ARG ONBUILD STOPSIGNAL HEALTHCHECK SHELL AS',
    caseInsensitive: true,
    variables: /^\$(?:\{[^}\n]*\}|\w+)/,
    flags: true,
  },
  makefile: {
    ...HASH_COMMENTS,
    identifier: /^[\p{L}_.][\p{L}\p{N}_.%/-]*/u,
    keywords:
      'ifeq ifneq ifdef ifndef else endif include define endef export unexport override ' + 'vpath',
    variables: /^\$(?:\([^)\n]*\)|\{[^}\n]*\}|.)/,
    keyValue: ':',
    extraTokens: [[/^\.[A-Z_]+(?=:)/, 'keyword']],
  },
  powershell: {
    lineComments: ['#'],
    blockComments: [['<#', '#>']],
    strings: ['"', "'"],
    identifier: /^[\p{L}_][\p{L}\p{N}_-]*/u,
    keywords:
      'begin break catch class continue data define do dynamicparam else elseif end enum '
      + 'exit filter finally for foreach from function hidden if in param process return static '
      + 'switch throw trap try until using var while workflow',
    caseInsensitive: true,
    variables: /^\$(?:\{[^}\n]*\}|\w+|[$?^_])/,
    flags: true,
  },
  perl: {
    ...HASH_COMMENTS,
    keywords:
      'my our local sub use no package require if elsif else unless while until for '
      + 'foreach do last next redo return print printf die warn eq ne lt gt le ge and or not '
      + 'shift push pop splice keys values each defined undef ref bless',
    variables: /^[$@%&]\{?\w+\}?/,
  },
  lua: {
    lineComments: ['--'],
    blockComments: [['--[[', ']]']],
    strings: ['"', "'"],
    keywords:
      'and break do else elseif end for function goto if in local not or repeat return '
      + 'then until while',
    literals: 'true false nil',
    builtins:
      'print require pairs ipairs type tostring tonumber setmetatable getmetatable '
      + 'error pcall assert select unpack',
  },
  r: {
    ...HASH_COMMENTS,
    keywords: 'if else repeat while function for in next break library require return',
    literals: 'TRUE FALSE NULL Inf NaN NA',
  },
  elixir: {
    ...HASH_COMMENTS,
    tripleStrings: true,
    keywords:
      'after alias and case catch cond def defcallback defdelegate defexception defguard '
      + 'defimpl defmacro defmacrop defmodule defoverridable defp defprotocol defstruct do else '
      + 'end fn for if import in not or quote raise receive require rescue reraise send super '
      + 'then throw try unless unquote unquote_splicing use when with',
    literals: 'true false nil',
    extraTokens: [[/^:[A-Za-z_]\w*[?!]?/, 'literal']],
    capitalTypes: true,
    decorators: true,
  },
  haskell: {
    lineComments: ['--'],
    blockComments: [['{-', '-}']],
    strings: ['"'],
    keywords:
      'as case class data default deriving do else forall foreign hiding if import in '
      + 'infix infixl infixr instance let module newtype of qualified then type where',
    literals: 'True False Nothing Just',
    capitalTypes: true,
  },
  clojure: {
    lineComments: [';'],
    blockComments: [],
    strings: ['"'],
    identifier: /^[\p{L}_*+!?<>=-][\p{L}\p{N}_*+!?<>=.-]*/u,
    keywords:
      'def defn defn- defmacro defmulti defmethod defprotocol defrecord deftype defonce '
      + 'let letfn fn if if-not if-let when when-not when-let cond condp case do loop recur throw '
      + 'try catch finally ns require import use in-ns quote var new set! and or not',
    literals: 'true false nil',
    extraTokens: [[/^:[\w.-]+/, 'literal']],
  },
  graphql: {
    ...HASH_COMMENTS,
    strings: ['"'],
    tripleStrings: true,
    keywords:
      'query mutation subscription fragment on type input enum interface union scalar '
      + 'schema extend directive implements repeatable',
    literals: 'true false null',
    variables: /^\$\w+/,
    capitalTypes: true,
    decorators: true,
  },
  hcl: {
    lineComments: ['#', '//'],
    blockComments: [['/*', '*/']],
    strings: ['"'],
    keywords:
      'resource variable output module provider data locals terraform for_each count '
      + 'depends_on in if for each dynamic',
    literals: 'true false null',
    keyValue: '=',
  },
}

const ALIASES = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  jsonc: 'json',
  json5: 'json',
  htm: 'html',
  xml: 'html',
  svg: 'html',
  vue: 'html',
  svelte: 'html',
  sass: 'scss',
  less: 'scss',
  md: 'markdown',
  mdx: 'markdown',
  patch: 'diff',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  shellsession: 'bash',
  py: 'python',
  rb: 'ruby',
  golang: 'go',
  rs: 'rust',
  kt: 'kotlin',
  kts: 'kotlin',
  cs: 'csharp',
  'c#': 'csharp',
  'c++': 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  h: 'c',
  'objective-c': 'c',
  objc: 'c',
  mysql: 'sql',
  postgresql: 'sql',
  pgsql: 'sql',
  sqlite: 'sql',
  plsql: 'sql',
  yml: 'yaml',
  cfg: 'ini',
  conf: 'ini',
  env: 'ini',
  dotenv: 'ini',
  properties: 'ini',
  docker: 'dockerfile',
  containerfile: 'dockerfile',
  make: 'makefile',
  mk: 'makefile',
  ps1: 'powershell',
  pwsh: 'powershell',
  pl: 'perl',
  ex: 'elixir',
  exs: 'elixir',
  hs: 'haskell',
  clj: 'clojure',
  cljs: 'clojure',
  gql: 'graphql',
  terraform: 'hcl',
  tf: 'hcl',
  plaintext: 'text',
  plain: 'text',
  txt: 'text',
}

const compiled = new Map()

const wordSet = (words, caseInsensitive) =>
  new Set(
    (words ?? '')
      .split(' ')
      .filter(Boolean)
      .map((word) => (caseInsensitive ? word.toLowerCase() : word)),
  )

const compile = (name) => {
  const spec = LANGUAGES[name]
  const { caseInsensitive = false } = spec
  return {
    name,
    scanner: spec.scanner ?? 'generic',
    lineComments: spec.lineComments ?? [],
    blockComments: spec.blockComments ?? [],
    strings: spec.strings ?? [],
    multilineStrings: spec.multilineStrings ?? [],
    tripleStrings: spec.tripleStrings ?? false,
    stringPrefix: spec.stringPrefix ?? null,
    keywords: wordSet(spec.keywords, caseInsensitive),
    literals: wordSet(spec.literals, caseInsensitive),
    types: wordSet(spec.types, caseInsensitive),
    builtins: wordSet(spec.builtins, caseInsensitive),
    caseInsensitive,
    capitalTypes: spec.capitalTypes ?? false,
    decorators: spec.decorators ?? false,
    regex: spec.regex ?? false,
    macros: spec.macros ?? false,
    directive: spec.directive ?? null,
    variables: spec.variables ?? null,
    scss: spec.scss ?? false,
    flags: spec.flags ?? false,
    keyValue: spec.keyValue ?? null,
    stringKeys: spec.stringKeys ?? false,
    identifier: spec.identifier ?? /^[\p{L}_$][\p{L}\p{N}_$]*/u,
    extraTokens: spec.extraTokens ?? [],
  }
}

export const languageNameOf = (value) => {
  const name = String(value).trim().toLowerCase()
  if (Object.hasOwn(LANGUAGES, name)) return name
  if (Object.hasOwn(ALIASES, name)) return ALIASES[name]
  return null
}

export const languageSpec = (name) => {
  if (!compiled.has(name)) compiled.set(name, compile(name))
  return compiled.get(name)
}

const languageNames = () => Object.keys(LANGUAGES)

export const resolveLanguage = (componentName, value) => {
  if (value === undefined || value === null) return 'text'
  const name = languageNameOf(value)
  if (name !== null) return name
  impLogger.warn(
    `${componentName}: unknown language '${value}' - showing plain text. Known languages are ${languageNames().join(
      ', ',
    )}`,
  )
  return 'text'
}
