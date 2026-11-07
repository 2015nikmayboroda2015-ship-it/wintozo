/**
 * Сборка legacy-бандла для ивента «Память о Wintozo».
 * Берёт старый интерфейс из old/ (React 18 + react-router-dom 6), прогоняет
 * через esbuild в один самодостаточный JS+CSS файл и пишет результат в
 * src/legacy/legacy-bundle.js. Основной WinChat грузит его внутри iframe.
 *
 * Запуск: node scripts/build-legacy.mjs
 * (нужны dev-зависимости: esbuild, @babel/standalone — ставятся npm i --no-save)
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import * as esbuild from "esbuild";

const require = createRequire(import.meta.url);
const babel = require("@babel/standalone");

/** Node-модули, которые appwrite/SDK тянут внутри браузера — глушим пустяком. */
const NODE_BUILTINS = new Set([
  "assert", "buffer", "child_process", "crypto", "dns", "events", "fs", "http",
  "https", "net", "os", "path", "process", "querystring", "stream", "string_decoder",
  "tls", "tty", "url", "util", "zlib",
  "node:assert", "node:buffer", "node:child_process", "node:crypto", "node:dns",
  "node:events", "node:fs", "node:http", "node:https", "node:net", "node:os",
  "node:path", "node:process", "node:querystring", "node:stream", "node:string_decoder",
  "node:tls", "node:tty", "node:url", "node:util", "node:zlib",
]);

const ROOT = process.cwd();
const OLD_DIR = path.join(ROOT, "old");
const OUT_DIR = path.join(ROOT, "src", "legacy");
const ENTRY_ABS = path.join(OLD_DIR, "src", "main.jsx");

/** Разрешение относительных импортов внутри old/ с tsx/jsx/ts. */
function resolveOld(spec, importer) {
  const base = path.resolve(path.dirname(importer), spec);
  for (const ext of ["", ".js", ".jsx", ".ts", ".tsx", ".mjs"]) {
    const c = base + ext;
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  for (const idx of ["/index.tsx", "/index.jsx", "/index.js", "/index.ts"]) {
    const c = base + idx;
    if (fs.existsSync(c)) return c;
  }
  throw new Error(`Cannot resolve "${spec}" from ${importer}`);
}

/** Плагин: JSX/TSX → JS через Babel, CSS → пустый модуль (соберём отдельно). */
const transformPlugin = {
  name: "legacy-transform",
  setup(build) {
    build.onResolve({ filter: /\.css$/ }, () => ({
      namespace: "empty-css",
      path: "empty",
    }));
    build.onLoad({ filter: /.*/, namespace: "empty-css" }, () => ({
      contents: "",
      loader: "js",
    }));
    // jpg/png: подменяем пустым модулем (логотип Spidi не нужен legacy-мосту)
    build.onResolve({ filter: /\.(jpg|jpeg|png|gif|svg|webp)$/ }, () => ({
      namespace: "empty-css",
      path: "empty-img",
    }));
    // Appwrite SDK не работает в IIFE-бандле — глушим весь пакет заглушкой.
    // ПИШЕМ ПЕРЕД общим resolver-ом — он первый сработает.
    build.onResolve({ filter: /^appwrite\/.*$/ }, (args) => ({
      namespace: "appwrite-stub",
      path: "appwrite-stub",
    }));
    build.onResolve({ filter: /^appwrite$/ }, () => ({
      namespace: "appwrite-stub",
      path: "appwrite-stub",
    }));
    build.onLoad({ filter: /.*/, namespace: "appwrite-stub" }, () => ({
      contents: `
        var stub = {};
        var noop = function() { return stub; };
        function C() { this.setEndpoint = noop; this.setProject = noop; this.setDevKey = noop; this.setSelfSigned = noop; }
        C.prototype.setEndpoint = noop; C.prototype.setProject = noop; C.prototype.setDevKey = noop; C.prototype.setSelfSigned = noop;
        function DS() {} DS.prototype.listDocuments = function(){return Promise.resolve({documents:[]})};
        function ST() {} ST.prototype.getFileList = function(){return Promise.resolve({files:[]})};
        function AV() {} AV.prototype.getInitials = function(){return Promise.resolve('data:image/svg+xml,')};
        var ID = { unique: function(){return 'legacy-stub'} };
        var Query = { select: function(){return arguments}, limit: function(){return arguments}, offset: function(){return arguments}, search: function(){return arguments}, order: function(){return arguments}, cursorAfter: function(){return arguments}, cursorBefore: function(){return arguments}, equalTo: function(){return arguments}, notEqualTo: function(){return arguments}, isNull: function(){return arguments}, isNotNull: function(){return arguments}, lessThan: function(){return arguments}, lessThanOrEqual: function(){return arguments}, greaterThan: function(){return arguments}, greaterThanOrEqual: function(){return arguments}, start: function(){return arguments}, end: function(){return arguments}, contains: function(){return arguments}, beginsWith: function(){return arguments}, endsWith: function(){return arguments}, between: function(){return arguments}, and: function(){return arguments}, or: function(){return arguments}, not: function(){return arguments}, isEmpty: function(){return arguments}, isNotEmpty: function(){return arguments}, in: function(){return arguments}, notIn: function(){return arguments} };
        var Permission = { read: function(){}, write: function(){} };
        var Role = { any: function(){}, user: function(){}, team: function(){}, guests: function(){}, members: function(){} };
        exports.Client = C; exports.Account = C; exports.Databases = DS; exports.Storage = ST; exports.Avatars = AV;
        exports.ID = ID; exports.Query = Query; exports.Permission = Permission; exports.Role = Role;
        var _default = stub; exports.default = _default;
      `,
      loader: "js",
    }));
    build.onLoad({ filter: /\.(jsx|tsx|ts)$/ }, (args) => {
      const source = fs.readFileSync(args.path, "utf8");
      const presets = [["react", { runtime: "automatic" }]];
      if (args.path.endsWith(".ts") || args.path.endsWith(".tsx")) {
        presets.push([
          "typescript",
          { isTSX: args.path.endsWith(".tsx"), allExtensions: true },
        ]);
      }
      const out = babel.transform(source, {
        filename: args.path,
        presets,
        compact: false,
      });
      return { contents: out.code, loader: "js" };
    });
    build.onResolve({ filter: /^\.\.?\// }, (args) => ({
      path: resolveOld(args.path, args.importer),
    }));
    // Пакетные импорты old/ решаем из node_modules корня проекта
    // (у old/ нет своих зависимостей, esbuild по умолчанию их там ищет).
    // Appwrite и Node-встроенные модули пропускаем — их уже обработали выше.
    build.onResolve({ filter: /^[^./]/ }, (args) => {
      if (NODE_BUILTINS.has(args.path)) return null;
      if (args.path === "appwrite" || args.path.startsWith("appwrite/")) return null;
      try {
        return { path: require.resolve(args.path, { paths: [ROOT] }) };
      } catch {
        return null;
      }
    });
  },
};

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const result = await esbuild.build({
    entryPoints: [ENTRY_ABS],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["chrome100", "firefox100", "safari15"],
    jsx: "automatic",
    minify: true,
    define: {
      "process.env.NODE_ENV": '"production"',
      "process.env": "{}",
      global: "window",
      "import.meta.env": "{}",
      "import.meta.env.VITE_APPWRITE_ENDPOINT": JSON.stringify('https://fra.cloud.appwrite.io/v1'),
      "import.meta.env.VITE_APPWRITE_PROJECT": JSON.stringify('6a79d21c002f60c4b62c'),
      "import.meta.env.VITE_APPWRITE_API_KEY": JSON.stringify(''),
      "import.meta.env.VITE_SUPABASE_MEDIA_URL": JSON.stringify('https://liprykmtennsmjtfpbuw.supabase.co'),
      "import.meta.env.VITE_SUPABASE_MEDIA_KEY": JSON.stringify('sb_publishable_ZYjFzVYy0VkaUTGDW9uHow_-u9HnbFn'),
      "import.meta.env.VITE_SUPABASE_CORE_URL": JSON.stringify('https://iksgubxxxspkjwsazrwq.supabase.co'),
      "import.meta.env.VITE_SUPABASE_CORE_KEY": JSON.stringify('sb_publishable_uEwTj3pmRCCbVg4HaQFeOg_GFmVoaHl'),
    },
    plugins: [transformPlugin],
    nodePaths: [path.join(ROOT, "node_modules")],
    write: false,
    logLevel: "warning",
    absWorkingDir: ROOT,
  });

  const js = result.outputFiles[0].text;

  // Старый index.css подмешиваем как <style> внутрь бандла. Относительные
  // url() на ассеты old/ вырезаем (внутри iframe base не задан).
  let css = "";
  const cssPath = path.join(OLD_DIR, "src", "index.css");
  if (fs.existsSync(cssPath)) {
    css = fs
      .readFileSync(cssPath, "utf8")
      .replace(/url\((['"]?)([^'")]+)\1\)/g, (m, q, u) =>
        /^[./]/.test(u) ? "none" : m
      );
  }

  const inject = `try{var s=document.createElement('style');s.textContent=${JSON.stringify(
    css
  )};document.head.appendChild(s);}catch(e){}\n`;
  const bundle = inject + js;
  const outFile = path.join(OUT_DIR, "legacy-bundle.js");
  fs.writeFileSync(outFile, bundle, "utf8");
  console.log(
    "legacy-bundle written:",
    path.relative(ROOT, outFile),
    (bundle.length / 1024).toFixed(1) + " KB"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
