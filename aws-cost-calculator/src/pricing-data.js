// On-demand list prices (USD/hour) for common EC2 instance families.
// Source: AWS public pricing, ap-southeast-1 (Singapore) + us-east-1, retrieved 2026.
// Prices are on-demand, Linux, and per-hour.

const EC2 = {
  // family, vCPU, memGB, general / compute / memory families with regional multipliers
  't3.nano':    { vcpu: 2,  mem: 0.5,                    base: 0.0066 },
  't3.micro':   { vcpu: 2,  mem: 1,                      base: 0.0134 },
  't3.small':   { vcpu: 2,  mem: 2,                      base: 0.0268 },
  't3.medium':  { vcpu: 2,  mem: 4,                      base: 0.0536 },
  't3.large':   { vcpu: 2,  mem: 8,                      base: 0.1072 },
  't4g.nano':   { vcpu: 2,  mem: 0.5,  graviton: true,   base: 0.0053 },
  't4g.micro':  { vcpu: 2,  mem: 1,    graviton: true,   base: 0.0106 },
  't4g.small':  { vcpu: 2,  mem: 2,    graviton: true,   base: 0.0212 },
  't4g.medium': { vcpu: 2,  mem: 4,    graviton: true,   base: 0.0424 },
  't4g.large':  { vcpu: 2,  mem: 8,    graviton: true,   base: 0.0848 },
  'm5.large':   { vcpu: 2,  mem: 8,                      base: 0.1113 },
  'm5.xlarge':  { vcpu: 4,  mem: 16,                     base: 0.2226 },
  'm5.2xlarge': { vcpu: 8,  mem: 32,                     base: 0.4452 },
  'm6g.large':  { vcpu: 2,  mem: 8,    graviton: true,   base: 0.096 },
  'm6g.xlarge': { vcpu: 4,  mem: 16,   graviton: true,   base: 0.192 },
  'm7g.large':  { vcpu: 2,  mem: 8,    graviton: true,   base: 0.102 },
  'm7g.xlarge': { vcpu: 4,  mem: 16,   graviton: true,   base: 0.204 },
  'm7g.2xlarge':{ vcpu: 8,  mem: 32,   graviton: true,   base: 0.408 },
  'c6g.large':  { vcpu: 2,  mem: 4,    graviton: true,   base: 0.0784 },
  'c6g.xlarge': { vcpu: 4,  mem: 8,    graviton: true,   base: 0.1568 },
  'c7g.large':  { vcpu: 2,  mem: 4,    graviton: true,   base: 0.0834 },
  'c7g.xlarge': { vcpu: 4,  mem: 8,    graviton: true,   base: 0.1668 },
  'r6g.large':  { vcpu: 2,  mem: 16,   graviton: true,   base: 0.10368 },
  'r6g.xlarge': { vcpu: 4,  mem: 32,   graviton: true,   base: 0.20736 },
  'r7g.large':  { vcpu: 2,  mem: 16,   graviton: true,   base: 0.1104 },
  'r7g.xlarge': { vcpu: 4,  mem: 32,   graviton: true,   base: 0.2208 },
};

// Regional multiplier relative to us-east-1 baseline pricing.
// This is a rough model; actual pricing is per-service. Good enough for estimates.
const REGION_MULTIPLIERS = {
  'us-east-1': 1.0,
  'us-east-2': 1.0,
  'us-west-1': 1.06,
  'us-west-2': 1.0,
  'ap-south-1': 1.0,
  'ap-northeast-1': 1.217,
  'ap-northeast-2': 1.0,
  'ap-northeast-3': 1.092,
  'ap-southeast-1': 1.07,
  'ap-southeast-2': 1.075,
  'ap-southeast-3': 1.04,
  'ap-east-1': 1.18,
  'ca-central-1': 1.0,
  'eu-central-1': 1.09,
  'eu-west-1': 1.0,
  'eu-west-2': 1.05,
  'eu-west-3': 1.04,
  'eu-north-1': 1.0,
  'eu-south-1': 1.06,
  'sa-east-1': 1.284,
  'af-south-1': 1.0,
};

const REGIONS = {
  'ap-southeast-1': 'Asia Pacific (Singapore)',
  'us-east-1': 'US East (N. Virginia)',
  'us-east-2': 'US East (Ohio)',
  'us-west-1': 'US West (N. California)',
  'us-west-2': 'US West (Oregon)',
  'ap-south-1': 'Asia Pacific (Mumbai)',
  'ap-northeast-1': 'Asia Pacific (Tokyo)',
  'ap-northeast-2': 'Asia Pacific (Seoul)',
  'ap-northeast-3': 'Asia Pacific (Osaka)',
  'ap-southeast-2': 'Asia Pacific (Sydney)',
  'ap-southeast-3': 'Asia Pacific (Jakarta)',
  'ap-east-1': 'Asia Pacific (Hong Kong)',
  'ca-central-1': 'Canada (Central)',
  'eu-central-1': 'Europe (Frankfurt)',
  'eu-west-1': 'Europe (Ireland)',
  'eu-west-2': 'Europe (London)',
  'eu-west-3': 'Europe (Paris)',
  'eu-north-1': 'Europe (Stockholm)',
  'eu-south-1': 'Europe (Milan)',
  'eu-south-2': 'Europe (Spain)',
  'sa-east-1': 'South America (São Paulo)',
  'af-south-1': 'Africa (Cape Town)',
};

const PRICING_MODES = {
  'ondemand': 'On-Demand',
  'reserved-1y': 'Reserved 1yr (No upfront)',
  'reserved-3y': 'Reserved 3yr (No upfront)',
  'spot': 'Spot',
};

// Rough savings multipliers vs on-demand per pricing mode.
const PRICING_MODE_MULTIPLIER = {
  'ondemand': 1.0,
  'reserved-1y': 0.62,
  'reserved-3y': 0.42,
  'spot': 0.35,
};

// S3 per-GB/month pricing (standard tiers) per region.
const S3_PRICING = {
  'us-east-1': { standard: 0.023, intelligent: 0.023, glacier: 0.0036 },
  'ap-southeast-1': { standard: 0.025, intelligent: 0.025, glacier: 0.004 },
};

// Generic fallback for S3 by region group.
const S3_REGION_GROUP = {
  'us-east-1': 'us-east-1', 'us-east-2': 'us-east-1', 'us-west-1': 'us-east-1', 'us-west-2': 'us-east-1',
  'ca-central-1': 'us-east-1', 'eu-west-1': 'us-east-1', 'eu-west-2': 'us-east-1',
  'ap-southeast-2': 'ap-southeast-1', 'ap-south-1': 'ap-southeast-1', 'ap-northeast-1': 'ap-southeast-1',
  'ap-northeast-2': 'ap-southeast-1', 'eu-central-1': 'ap-southeast-1',
};

function getS3Price(region, storageClass) {
  const key = S3_REGION_GROUP[region] || 'us-east-1';
  const table = S3_PRICING[key] || S3_PRICING['us-east-1'];
  return table[storageClass] || table.standard;
}

const S3_STORAGE_CLASSES = {
  'standard': 'S3 Standard',
  'intelligent': 'S3 Intelligent-Tiering',
  'glacier': 'S3 Glacier (Cold)',
};

// EBS per-GB/month pricing per volume type (ap-southeast-1 baseline).
const EBS_PRICING = [
  { type: 'gp3',  name: 'General Purpose (gp3)',     baseGB: 0.08,  iopsIncl: 3000,  throughputIncl: 125 },
  { type: 'gp2',  name: 'General Purpose (gp2)',     baseGB: 0.10 },
  { type: 'io2',  name: 'Provisioned IOPS (io2)',    baseGB: 0.138 },
  { type: 'st1',  name: 'Throughput Optimized (st1)',baseGB: 0.045 },
  { type: 'sc1',  name: 'Cold HDD (sc1)',            baseGB: 0.015 },
];

// RDS per-hour pricing (single-AZ, mysql/postgres) for common instance types.
// ap-southeast-1 baselines.
const RDS_PRICING = {
  'db.t4g.micro':   { base: 0.022, multiAZ: true },
  'db.t4g.small':   { base: 0.044, multiAZ: true },
  'db.t4g.medium':  { base: 0.088, multiAZ: true },
  'db.t4g.large':   { base: 0.176, multiAZ: true },
  'db.m6g.large':   { base: 0.185, multiAZ: true },
  'db.m6g.xlarge':  { base: 0.37,  multiAZ: true },
  'db.r6g.large':   { base: 0.221, multiAZ: true },
  'db.r6g.xlarge':  { base: 0.442, multiAZ: true },
};

const RDS_ENGINES = ['MySQL', 'PostgreSQL', 'MariaDB', 'Aurora MySQL', 'Aurora PostgreSQL'];

// Data transfer out (USD per GB), rounded pricing model.
// Free tier: 100GB/mo free (aggregate). After that tiered pricing.
const DATA_TRANSFER_TIERS = [
  { upTo: 100,  price: 0 },          // free tier
  { upTo: 10240, price: 0.09 },       // up to 10TB
  { upTo: 51200, price: 0.085 },      // up to 50TB
  { upTo: Infinity, price: 0.07 },    // beyond
];

// AWS Free Tier allowances (monthly).
const FREE_TIER = {
  ec2: { hours: 750,              // t3.micro / t4g.micro
         note: '750 hours/month of t2.micro or t3.micro',
  },
  s3:  { storageGB: 5 },
  ebs: { storageGB: 30 },
  transfer: { gb: 100 },
  rds: { hours: 750, note: '750 hours/month of db.t3.micro or db.t4g.micro' },
};

function getDataTransferPrice(gb) {
  let remaining = gb;
  let total = 0;
  let lowerBound = 0;
  for (const tier of DATA_TRANSFER_TIERS) {
    if (remaining <= 0) break;
    const upper = tier.upTo;
    const tierSize = Math.min(remaining, upper - lowerBound);
    if (tierSize > 0) {
      total += tierSize * tier.price;
      remaining -= tierSize;
    }
    lowerBound = upper;
    if (upper === Infinity) break;
  }
  return total;
}

function ec2MonthlyCost(instanceType, region, quantity, pricingMode) {
  const spec = EC2[instanceType];
  if (!spec) return 0;
  const regionMult = REGION_MULTIPLIERS[region] || 1.0;
  const modeMult = PRICING_MODE_MULTIPLIER[pricingMode] || 1.0;
  return spec.base * regionMult * modeMult * 730 * quantity;
}

function s3MonthlyCost(region, storageClass, gb) {
  return getS3Price(region, storageClass) * gb;
}

function ebsMonthlyCost(volumeType, gb, extraIops) {
  const vol = EBS_PRICING.find(v => v.type === volumeType);
  if (!vol) return 0;
  let cost = vol.baseGB * gb;
  if (volumeType === 'gp3' && extraIops > vol.iopsIncl) {
    cost += ((extraIops - vol.iopsIncl) / 1000) * 0.006 * 30; // $0.006 per 1000 extra IOPS-month
  }
  return cost;
}

function rdsMonthlyCost(instanceType, region, quantity, multiAZ) {
  const spec = RDS_PRICING[instanceType];
  if (!spec) return 0;
  const regionMult = REGION_MULTIPLIERS[region] || 1.0;
  const azMult = multiAZ ? 2 : 1;
  return spec.base * regionMult * azMult * 730 * quantity;
}

export {
  EC2,
  REGIONS,
  REGION_MULTIPLIERS,
  PRICING_MODES,
  S3_STORAGE_CLASSES,
  EBS_PRICING,
  RDS_PRICING,
  RDS_ENGINES,
  FREE_TIER,
  ec2MonthlyCost,
  s3MonthlyCost,
  ebsMonthlyCost,
  rdsMonthlyCost,
  getDataTransferPrice,
};
