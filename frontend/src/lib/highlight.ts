import {
  createCssVariablesTheme,
  createHighlighterCore,
  type HighlighterCore,
  type ThemedToken,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

/** Colours come from --shiki-* variables in globals.css, so syntax colour is part of the token system. */
const theme = createCssVariablesTheme({
  name: "margin",
  variablePrefix: "--shiki-",
  fontStyle: true,
});
export const KEYWORD_COLOR = "var(--shiki-token-keyword)";

/** Each grammar is its own chunk, fetched the first time a file of that type is opened. */
const LANGS = {
  typescript: () => import("shiki/langs/typescript.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  jsx: () => import("shiki/langs/jsx.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  python: () => import("shiki/langs/python.mjs"),
  go: () => import("shiki/langs/go.mjs"),
  java: () => import("shiki/langs/java.mjs"),
  kotlin: () => import("shiki/langs/kotlin.mjs"),
  rust: () => import("shiki/langs/rust.mjs"),
  ruby: () => import("shiki/langs/ruby.mjs"),
  php: () => import("shiki/langs/php.mjs"),
  csharp: () => import("shiki/langs/csharp.mjs"),
  c: () => import("shiki/langs/c.mjs"),
  cpp: () => import("shiki/langs/cpp.mjs"),
  swift: () => import("shiki/langs/swift.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  scss: () => import("shiki/langs/scss.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  vue: () => import("shiki/langs/vue.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
  toml: () => import("shiki/langs/toml.mjs"),
  sql: () => import("shiki/langs/sql.mjs"),
  shellscript: () => import("shiki/langs/shellscript.mjs"),
  dockerfile: () => import("shiki/langs/dockerfile.mjs"),
  prisma: () => import("shiki/langs/prisma.mjs"),
  xml: () => import("shiki/langs/xml.mjs"),
} as const;

type Lang = keyof typeof LANGS;

const BY_EXTENSION: Record<string, Lang> = {
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  json: "json",
  py: "python",
  go: "go",
  java: "java",
  kt: "kotlin",
  rs: "rust",
  rb: "ruby",
  php: "php",
  cs: "csharp",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  hpp: "cpp",
  swift: "swift",
  css: "css",
  scss: "scss",
  html: "html",
  htm: "html",
  vue: "vue",
  md: "markdown",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  sql: "sql",
  sh: "shellscript",
  bash: "shellscript",
  zsh: "shellscript",
  prisma: "prisma",
  xml: "xml",
};

export function languageFor(fileName: string): Lang | null {
  if (/^dockerfile$/i.test(fileName)) return "dockerfile";
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? (BY_EXTENSION[fileName.slice(dot + 1).toLowerCase()] ?? null) : null;
}

/** Above this, tokenising blocks the main thread noticeably; show plain text instead. */
export const MAX_HIGHLIGHT_CHARS = 200_000;

let highlighter: Promise<HighlighterCore> | null = null;

export async function tokenize(code: string, fileName: string): Promise<ThemedToken[][] | null> {
  const lang = languageFor(fileName);
  if (!lang || code.length > MAX_HIGHLIGHT_CHARS) return null;
  highlighter ??= createHighlighterCore({
    themes: [theme],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  });
  const h = await highlighter;
  if (!h.getLoadedLanguages().includes(lang)) await h.loadLanguage(LANGS[lang]);
  return h.codeToTokensBase(code, { lang, theme: "margin" });
}
