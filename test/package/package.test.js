'use strict';

const path = require('path');
let pack = require('../../lib/package/package');
const template = require('../../lib/package/template');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const tpl = require('../../lib/tpl');
const client = require('../../lib/client');
const util = require('../../lib/import/utils');
const profile = require('../../lib/profile');
const sandbox = sinon.createSandbox();
const assert = sandbox.assert;

describe('test package', () => {

  const tplPath = 'tplPath';
  const bucket = 'bucket';
  const outputTemplateFile = 'outputTemplateFile';

  const mock = require('../tpl-mock-data');

  let ossClient;

  let getProfileRes = {
    accountId: 111111,
    defaultRegion: 'cn-hangzhou'
  };
  
  beforeEach(() => {
    ossClient = sandbox.stub({
      getBucketLocation: function() {}
    });

    sandbox.stub(tpl, 'getTpl').resolves(mock.tpl);
    sandbox.stub(client, 'getOssClient').resolves(ossClient);
    sandbox.stub(template, 'uploadAndUpdateFunctionCode').resolves(mock.tpl);
    sandbox.stub(template, 'zipToOss').resolves('objectName');
    sandbox.stub(template, 'uploadNasService').resolves('./');
    sandbox.stub(template, 'generateRosTemplateForNasService').returns({});
    sandbox.stub(template, 'generateRosTemplateForResources').returns({});
    sandbox.stub(template, 'generateRosTemplateForOutputs').returns({});
    sandbox.stub(template, 'generateRosTemplateForRegionMap').returns({});
    sandbox.stub(util, 'outputTemplateFile').returns();
    sandbox.stub(profile, 'getProfile').resolves(getProfileRes);

    pack = proxyquire('../../lib/package/package', {
      '../tpl': tpl,
      '../client': client,
      'path': path
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('test outputTemplateFile', async () => {
    const packedYmlPath = path.resolve(process.cwd(), outputTemplateFile);

    await pack.pack(tplPath, bucket, outputTemplateFile);

    assert.calledWith(tpl.getTpl, tplPath);
    assert.calledWith(client.getOssClient, bucket);
    assert.calledWith(template.uploadAndUpdateFunctionCode, path.dirname(tplPath), mock.tpl, ossClient);
    assert.calledWith(util.outputTemplateFile, packedYmlPath, mock.tpl);
  });

  it('test default outputTemplateFile', async () => {
    const packedYmlPath = path.resolve(process.cwd(), 'template.packaged.yml');

    await pack.pack(tplPath, bucket);

    assert.calledWith(tpl.getTpl, tplPath);
    assert.calledWith(client.getOssClient, bucket);
    assert.calledWith(template.uploadAndUpdateFunctionCode, path.dirname(tplPath), mock.tpl, ossClient);
    assert.calledWith(util.outputTemplateFile, packedYmlPath, mock.tpl);
  });

  it('test generate default oss bucket when bucket did not specified', async () => {
    const packedYmlPath = path.resolve(process.cwd(), 'template.packaged.yml');
    await pack.pack(tplPath);

    assert.calledWith(tpl.getTpl, tplPath);
    assert.calledWith(client.getOssClient, `fun-gen-${getProfileRes.defaultRegion}-${getProfileRes.accountId}`);
    assert.calledWith(template.uploadAndUpdateFunctionCode, path.dirname(tplPath), mock.tpl, ossClient);
    assert.calledWith(util.outputTemplateFile, packedYmlPath, mock.tpl);
  });
});