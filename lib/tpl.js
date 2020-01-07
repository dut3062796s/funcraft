'use strict';

const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');

const yaml = require('js-yaml');
const debug = require('debug')('fun:tpl');
const { red, yellow } = require('colors');

const DEFAULT_BUILD_ARTIFACTS_PATH_SUFFIX = path.join('.fun', 'build', 'artifacts');
const DEFAULT_NAS_PATH_SUFFIX = path.join('.fun', 'nas');
const DEFAULT_LOCAL_TMP_PATH_SUFFIX = path.join('.fun', 'tmp', 'local');

let firstDetect = true;

async function asyncFind(pathArrays, filter) {
  for (let path of pathArrays) {
    if (await filter(path)) {
      return path;
    }
  }

  return null;
}

async function detectTplPath(preferBuildTpl = true, customTemplateLocations = []) {

  let buildTemplate = [];

  if (preferBuildTpl) {
    buildTemplate = ['template.yml', 'template.yaml'].map(f => {
      return path.join(process.cwd(), '.fun', 'build', 'artifacts', f);
    });
  }

  const defaultTemplate = ['template.yml', 'template.yaml', 'faas.yml', 'faas.yaml']
    .map((f) => path.join(process.cwd(), f));

  const tplPath = await asyncFind([...customTemplateLocations, ...buildTemplate, ...defaultTemplate], async (path) => {
    return await fs.pathExists(path);
  });

  if (tplPath && firstDetect) {
    console.log(yellow(`using template: ${path.relative(process.cwd(), tplPath)}`));
    firstDetect = false;
  }

  return tplPath;
}

async function detectOverrideTplPath(tplPath) {
  if (!tplPath) {
    return;
  }
  const overrideTplPath = path.resolve(path.dirname(tplPath), 'template.override.yml');
  if (await fs.pathExists(overrideTplPath)) {
    return overrideTplPath;
  }
  return;
}

async function getTpl(...tplPaths) {

  let tpl = {};
  for (const tplPath of tplPaths) {
    const tplContent = await fs.readFile(tplPath, 'utf8');
    const source = yaml.safeLoad(tplContent);
    _.merge(tpl, source);
  }

  debug('exist tpl: %j', tpl);

  return tpl;
}

function validateYmlName(...tplPaths) {
  for (const tplPath of tplPaths) {
    if (!(path.basename(tplPath).endsWith('.yml') || path.basename(tplPath).endsWith('.yaml'))) {
      throw new Error(red(`The template file name must end with yml or yaml.`));
    }
  }
}

function getBaseDir(tplPath) {
  const idx = tplPath.indexOf(DEFAULT_BUILD_ARTIFACTS_PATH_SUFFIX);

  if (idx !== -1) {
    const baseDir = tplPath.substring(0, idx);
    if (!baseDir) {
      return process.cwd();
    }
    return baseDir;
  }
  return path.resolve(path.dirname(tplPath));
}

function getRootBaseDir(baseDir) {
  const idx = baseDir.indexOf(DEFAULT_BUILD_ARTIFACTS_PATH_SUFFIX);
  if (idx !== -1) { // exist
    return baseDir.substring(0, idx);
  }
  return baseDir;
}

function getRootTplPath(tplPath) {
  const baseDir = getBaseDir(tplPath);
  return path.join(baseDir, path.basename(tplPath));
}

function getNasYmlPath(tplPath) {
  const baseDir = getBaseDir(tplPath);
  return path.join(baseDir, '.nas.yml');
}

function detectTmpDir(tplPath, tmpDir) {
  if (tmpDir) { return tmpDir; }

  const baseDir = getBaseDir(tplPath);
  return path.join(baseDir, DEFAULT_LOCAL_TMP_PATH_SUFFIX);
}

function detectNasBaseDir(tplPath) {
  const baseDir = getBaseDir(tplPath);

  return path.join(baseDir, DEFAULT_NAS_PATH_SUFFIX);
}

module.exports = {
  getTpl, detectTplPath, validateYmlName,
  detectNasBaseDir, DEFAULT_BUILD_ARTIFACTS_PATH_SUFFIX, DEFAULT_NAS_PATH_SUFFIX,
  detectTmpDir, DEFAULT_LOCAL_TMP_PATH_SUFFIX, getBaseDir, getNasYmlPath, getRootBaseDir,
  getRootTplPath, detectOverrideTplPath
};