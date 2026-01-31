const gulp = require('gulp');
const ts = require('gulp-typescript');
const del = require('del');
const sourcemaps = require('gulp-sourcemaps');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const tsProject = ts.createProject('tsconfig.json');

function clean() {
  return del(['dist']);
}

async function typeCheck() {
  try {
    const { stdout, stderr } = await execAsync('npx tsc --noEmit');
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
  } catch (error) {
    console.error('TypeScript compilation failed:', error.message);
    throw error;
  }
}

function build() {
  return tsProject.src()
    .pipe(sourcemaps.init())
    .pipe(tsProject())
    .pipe(sourcemaps.write('.', {
      includeContent: false,
      sourceRoot: '../nodes'
    }))
    .pipe(gulp.dest('dist'));
}

function copyPackageJson() {
  return gulp.src('package.json').pipe(gulp.dest('dist'));
}

function copyIcons() {
  return gulp.src(['nodes/**/*.svg', 'nodes/icons/**/*.svg'], { base: 'nodes' }).pipe(gulp.dest('dist/nodes'));
}

function buildDev() {
  return tsProject.src()
    .pipe(sourcemaps.init())
    .pipe(tsProject())
    .pipe(sourcemaps.write('.', {
      includeContent: false,
      sourceRoot: '../nodes'
    }))
    .pipe(gulp.dest('dist'));
}

function watchFiles() {
  gulp.watch('nodes/**/*.ts', buildDev);
}

exports.build = gulp.series(clean, typeCheck, build, copyPackageJson, copyIcons);
exports.buildDev = gulp.series(clean, buildDev, copyPackageJson, copyIcons);
exports.dev = gulp.series(clean, buildDev, copyPackageJson, copyIcons, watchFiles);
exports.typeCheck = typeCheck;
exports.clean = clean;
exports.default = build;
