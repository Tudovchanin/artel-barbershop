/**
 * MICHDEV BUILD SYSTEM 2025
 * Gulp 5 + Esbuild + TypeScript + Nunjucks + Sass + WebP + PHP
 * Production-ready сборка
 */

import gulp from "gulp";
const { src, dest, watch, series, parallel } = gulp;

import rename from "gulp-rename";
import fs from "fs";
import path from "path";
import * as dartSass from "sass";
import gulpSass from "gulp-sass";
const sass = gulpSass(dartSass);
import autoprefixer from "gulp-autoprefixer";
import cleanCSS from "gulp-clean-css";
import through from "through2";
import nunjucks from "nunjucks";
import imagemin from "gulp-imagemin";
import webp from "gulp-webp";
import { deleteAsync as del } from "del";
import browserSync from "browser-sync";
const bs = browserSync.create();
import notify from "gulp-notify";
import plumber from "gulp-plumber";
import { build as esbuild } from "esbuild";

// ============================================
// Пути
// ============================================
const srcPath = "src/";
const distPath = "docs/";

const paths = {
  html: `${srcPath}html/*.{html,njk}`,
  scss: `${srcPath}assets/scss/main.scss`,
  ts: `${srcPath}assets/ts/main.ts`,
  dataGlobal: `${srcPath}data/global.json`,
  dataPages: `${srcPath}data/pages/`,
  dataComponents: `${srcPath}data/components/`,
  img: `${srcPath}assets/img/**/*.{jpeg,jpg,png,svg,gif,ico,webp}`,
  fonts: `${srcPath}assets/fonts/**/*`,
  media: `${srcPath}assets/media/**/*`,
  php: `${srcPath}php/**/*.php`,
};

// ============================================
// Очистка сборки
// ============================================
export const clean = () => del([distPath]);

// ============================================
// HTML (Nunjucks + JSON)
// ============================================
export const html = () => {
  // Настройка Nunjucks
  const env = nunjucks.configure(
    [`${srcPath}layouts/`, `${srcPath}components/`, `${srcPath}html/`],
    {
      watch: false,
      noCache: true,
      autoescape: false,
    }
  );

  return src(paths.html)
    .pipe(
      plumber({ errorHandler: notify.onError("HTML: <%= error.message %>") })
    )
    .pipe(
      through.obj((file, enc, cb) => {
        if (file.isNull()) {
          return cb(null, file);
        }

        // для страниц json так же как страница
        const pageName = file.stem;
        console.log(`📄 Processing: ${pageName}.html`);

        // Глобальные данные
        let globalData = {};
        if (fs.existsSync(paths.dataGlobal)) {
          try {
            globalData = JSON.parse(fs.readFileSync(paths.dataGlobal, "utf8"));
            console.log("🌐 Global data loaded");
          } catch (err) {
            console.error("❌ Global JSON error:", err.message);
          }
        }

        // Данные страницы
        let pageData = {};
        const pageDataPath = path.join(paths.dataPages, `${pageName}.json`);
        console.log(`📁 Looking for: ${pageDataPath}`);

        if (fs.existsSync(pageDataPath)) {
          try {
            pageData = JSON.parse(fs.readFileSync(pageDataPath, "utf8"));
            console.log("📄 Page data:", pageData);
            console.log("🔍 heroText:", pageData.heroText || "NOT FOUND");
          } catch (err) {
            console.error("❌ Page JSON error:", err.message);
          }
        } else {
          console.warn("⚠️ No page data found for:", pageName);
        }

        // Данные компонентов
        let componentData = {};
        if (fs.existsSync(paths.dataComponents)) {
          try {
            const files = fs.readdirSync(paths.dataComponents);
            files.forEach((fileName) => {
              if (fileName.endsWith(".json")) {
                const name = path.parse(fileName).name;
                const data = JSON.parse(
                  fs.readFileSync(
                    path.join(paths.dataComponents, fileName),
                    "utf8"
                  )
                );
                componentData[name] = data;
              }
            });
            console.log("🧩 Components loaded:", Object.keys(componentData));
          } catch (err) {
            console.error("❌ Components JSON error:", err.message);
          }
        }

        // Объединяем данные
        const data = {
          ...globalData,
          ...pageData,
          components: componentData,
        };

        console.log("🎯 Final data keys:", Object.keys(data));
        console.log("🎯 Data preview:", {
          title: data.title,
          heroText: data.heroText,
          page: data.page,
        });

        // 5️⃣ Рендерим шаблон
        const template = file.contents.toString("utf8");
        console.log("🔧 Template first 100 chars:", template.substring(0, 100));

        try {
          const html = env.renderString(template, data);
          console.log("✅ Successfully rendered");
          console.log("📝 Output first 200 chars:", html.substring(0, 200));

          file.contents = Buffer.from(html, "utf8");
          cb(null, file);
        } catch (err) {
          console.error(`❌ Nunjucks render error:`, err.message);
          console.error("Template:", template);
          console.error("Data:", data);
          cb(new Error(`Nunjucks error in ${file.basename}: ${err.message}`));
        }
      })
    )
    .pipe(dest(distPath))
    .on("end", bs.reload);
};

// ============================================
// Стили
// ============================================
export const styles = () => {
  return src(paths.scss, { sourcemaps: true })
    .pipe(
      plumber({ errorHandler: notify.onError("SCSS: <%= error.message %>") })
    )
    .pipe(sass())
    .pipe(autoprefixer())
    .pipe(cleanCSS())
    .pipe(rename({ suffix: ".min" }))
    .pipe(dest(`${distPath}assets/css`, { sourcemaps: "." }))
    .pipe(bs.stream());
};

// ============================================
// Скрипты
// ============================================
export const scripts = async () => {
  await esbuild({
    entryPoints: [paths.ts],
    bundle: true,
    minify: true,
    sourcemap: true,
    target: "es2022",
    outfile: `${distPath}assets/js/main.min.js`,
  });
  bs.reload();
};

// ============================================
// Изображения
// ============================================
// 1. WebP конвертация (параллельно)
export const imagesWebp = () =>
  src([paths.img, "!src/assets/img/**/*.svg"], { encoding: false })
    .pipe(webp())
    .pipe(dest(`${distPath}assets/img`));

// 2. Оптимизация оригиналов (параллельно)
export const imagesOptimize = () =>
  src([paths.img, "!src/assets/img/**/*.svg"], { encoding: false })
    .pipe(
      imagemin([
        imagemin.mozjpeg({ quality: 75 }),
        imagemin.optipng({ optimizationLevel: 5 }),
      ])
    )
    .pipe(dest(`${distPath}assets/img`));

export const copySvg = () =>
  src("src/assets/img/**/*.svg", { encoding: false }).pipe(
    dest(`${distPath}assets/img`)
  );

export const copyFavicon = () =>
  src("src/assets/img/**/*.ico", { encoding: false }).pipe(dest(distPath));

// 3. Объединяем в одну задачу
export const images = parallel(imagesWebp, imagesOptimize, copySvg, copyFavicon);

// ============================================
// Шрифты и медиа
// ============================================
export const fonts = () =>
  src(paths.fonts, { encoding: false }).pipe(dest(`${distPath}assets/fonts`));
export const media = () =>
  src(paths.media, { encoding: false }).pipe(dest(`${distPath}assets/media`));

// ============================================
// PHP файлы
// ============================================
export const php = () =>
  src(paths.php)
    .pipe(dest(`${distPath}php`))
    .on("end", bs.reload);

// ============================================
// Локальный сервер
// ============================================
export const server = () => {
  bs.init({
    server: { baseDir: distPath },
    port: 3000,
    notify: false,
  });
};

// ============================================
// Watch
// ============================================
export const watchFiles = () => {
  watch(`${srcPath}**/*.{html,njk}`, html);
  watch(`${srcPath}components/**/*.{html,njk}`, html);
  watch(`${paths.dataPages}**/*.json`, html);
  watch(paths.dataGlobal, html);
  watch(`${paths.dataComponents}**/*.json`, html);
  watch(`${srcPath}assets/scss/**/*.scss`, styles);
  watch(`${srcPath}assets/ts/**/*.ts`, scripts);
  watch(paths.img, images);
  watch(paths.fonts, fonts);
  watch(paths.media, media);
  watch(paths.php, php);
};

// ============================================
// Сборка
// ============================================
export const build = series(
  clean,
  parallel(html, styles, scripts, images, fonts, media, php)
);

export default series(build, parallel(server, watchFiles));
