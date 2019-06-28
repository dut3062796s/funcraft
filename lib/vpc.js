'use strict'

const getProfile = require('./profile').getProfile;
const _ = require('lodash');
const { getVpcPopClient, getEcsPopClient } = require('./client');

const vswitch = require('./vswitch');
const securityGroup = require('./security-group');

var requestOption = {
  method: 'POST'
};

const defaultVSwitchName = 'fc-fun-vswitch-1';
const defaultSecurityGroupName = 'fc-fun-sg-1';

async function findVpc(vpcClient, region, vpcName) {

  const pageSize = 50; // max value is 50. see https://help.aliyun.com/document_detail/104577.html
  let requestPageNumber = 0;
  let totalCount;
  let pageNumber;

  let vpc;

  do {
    var params = {
      "RegionId": region,
      "PageSize": pageSize,
      "PageNumber": ++requestPageNumber
    };

    const rs = await vpcClient.request('DescribeVpcs', params, requestOption);

    totalCount = rs.TotalCount;
    pageNumber = rs.PageNumber;
    const vpcs = rs.Vpcs.Vpc;
  
    console.log("vpcs: " + JSON.stringify(vpcs));
    console.log("totalCount: " + totalCount);
    console.log("pageNumber: " + pageNumber);
  
    vpc = _.find(vpcs, { VpcName: vpcName });
    console.log("fun-defualt-vpc: " + JSON.stringify(vpc));
    
  } while(!vpc && totalCount && pageNumber && pageNumber * pageSize < totalCount);

  return vpc;
}

async function createVpc(vpcClient, region, vpcName) {
  var createParams = {
    "RegionId": region,
    "CidrBlock": "10.0.0.0/8",
    "EnableIpv6": false,
    "VpcName": vpcName,
    "Description": "default vpc created by fc fun"
  };

  const createRs = await vpcClient.request('CreateVpc', createParams, requestOption);

  const vpcId = createRs.VpcId;

  console.log("create rs is : " + JSON.stringify(createRs));

  await waitVpcUntilAvaliable(vpcClient, region, vpcId);

  return vpcId;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitVpcUntilAvaliable(vpcClient, region, vpcId) {

  let count = 0;
  let status;

  do {
    count++;

    var params = {
      "RegionId": region,
      "VpcId": vpcId
    };
    
    await sleep(800);

    const rs = await vpcClient.request('DescribeVpcs', params, requestOption);
    
    status = rs.Vpcs.Vpc[0].Status;

    console.log("####### vpc status is: " + status);
    
  } while(count < 10 && status !== 'Available');
}

async function createDefaultVSwitchIfNotExist(vpcClient, region, vpcId, vswitchIds) {
  let vswitchId = await vswitch.findVswitchExistByName(vpcClient, region, vswitchIds, defaultVSwitchName);

  if (!vswitchId) { // create vswitch
    vswitchId = await vswitch.createDefaultVSwitch(vpcClient, region, vpcId, defaultVSwitchName);
  }

  return vswitchId;
}

async function createDefaultSecurityGroupIfNotExist(ecsClient, region, vpcId) {
  // check fun default security group exist?
  const defaultSecurityGroup = await securityGroup.describeSecurityGroups(ecsClient, region, vpcId, defaultSecurityGroupName);
  console.log("default security grpup: " + JSON.stringify(defaultSecurityGroup));

  // create security group if not exist
  console.log('check security');

  // create security group
  if (_.isEmpty(defaultSecurityGroup)) {
    return await securityGroup.createSecurityGroup(ecsClient, region, vpcId, defaultSecurityGroupName);
  } else {
    return defaultSecurityGroup[0].SecurityGroupId;
  }
}

async function createDefaultVpcIfNotExist() {

  const profile = await getProfile();
  const region = profile.defaultRegion;

  const vpcClient = await getVpcPopClient();

  const ecsClient = await getEcsPopClient();

  const defaultVpcName = 'fc-fun-vpc';

  let vswitchIds;
  let vpcId;

  const funDefaultVpc = await findVpc(vpcClient, region, defaultVpcName);

  if (funDefaultVpc) { // update
    vswitchIds = funDefaultVpc.VSwitchIds.VSwitchId;
    vpcId = funDefaultVpc.VpcId;
  } else { // create
    vpcId = await createVpc(vpcClient, region, defaultVpcName);
  }

  console.log("vpcId is " + vpcId);

  const vswitchId = await createDefaultVSwitchIfNotExist(vpcClient, region, vpcId, vswitchIds);

  vswitchIds = [ vswitchId ];

  // create security

  const securityGroupId = await createDefaultSecurityGroupIfNotExist(ecsClient, region, vpcId);

  return {
    vpcId,
    vswitchIds,
    securityGroupId
  }
}

module.exports = {
  createDefaultVpcIfNotExist
};