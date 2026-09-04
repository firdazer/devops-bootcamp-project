import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ec2MonthlyCost,
  s3MonthlyCost,
  ebsMonthlyCost,
  rdsMonthlyCost,
  getDataTransferPrice,
} from './pricing-data.js';

test('ec2MonthlyCost returns expected value for t4g.micro on-demand in Singapore', () => {
  const cost = ec2MonthlyCost('t4g.micro', 'ap-southeast-1', 1, 'ondemand');
  // base 0.0106 * regionMult 1.07 * 730
  assert.ok(Math.abs(cost - (0.0106 * 1.07 * 730)) < 0.01);
});

test('ec2MonthlyCost scales with quantity', () => {
  const one = ec2MonthlyCost('t3.micro', 'ap-southeast-1', 1, 'ondemand');
  const ten = ec2MonthlyCost('t3.micro', 'ap-southeast-1', 10, 'ondemand');
  assert.ok(Math.abs(one * 10 - ten) < 0.01);
});

test('reserved pricing is cheaper than on-demand', () => {
  const onDemand = ec2MonthlyCost('m5.large', 'us-east-1', 1, 'ondemand');
  const reserved = ec2MonthlyCost('m5.large', 'us-east-1', 1, 'reserved-1y');
  assert.ok(reserved < onDemand);
});

test('s3MonthlyCost uses storage class pricing', () => {
  const standard = s3MonthlyCost('ap-southeast-1', 'standard', 100);
  const glacier = s3MonthlyCost('ap-southeast-1', 'glacier', 100);
  assert.ok(glacier < standard);
  assert.ok(standard > 0);
});

test('ebsMonthlyCost returns positive for gp3', () => {
  const cost = ebsMonthlyCost('gp3', 16, 3000);
  assert.ok(cost > 0);
  assert.ok(cost < 10);
});

test('rdsMonthlyCost doubles for multi-AZ', () => {
  const single = rdsMonthlyCost('db.t4g.micro', 'ap-southeast-1', 1, false);
  const multi = rdsMonthlyCost('db.t4g.micro', 'ap-southeast-1', 1, true);
  assert.ok(Math.abs(single * 2 - multi) < 0.01);
});

test('getDataTransferPrice is 0 within free tier', () => {
  assert.equal(getDataTransferPrice(100), 0);
});

test('getDataTransferPrice charges beyond free tier', () => {
  const cost = getDataTransferPrice(200); // 100 free, 100 @ 0.09 = 9.0
  assert.ok(Math.abs(cost - 9.0) < 0.01);
});