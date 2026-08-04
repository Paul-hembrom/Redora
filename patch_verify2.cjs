const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Replace personal usage increment
const personalIncrTarget = `    if (limit !== 'unlimited' && count >= limit) {
      throw new SubscriptionLimitError(\`Personal limit reached for \${type}. Upgrade your plan.\`);
    }

    // Increment
    if (type === 'document') {`;
const personalIncrReplace = `    if (limit !== 'unlimited' && count >= limit) {
      throw new SubscriptionLimitError(\`Personal limit reached for \${type}. Upgrade your plan.\`);
    }

    if (verifyOnly) return;

    // Increment
    if (type === 'document') {`;
code = code.replace(personalIncrTarget, personalIncrReplace);

// Replace school usage increment
const schoolIncrTarget = `    if (count >= currentLimits[type]) {
      throw new SubscriptionLimitError(\`Plan limit reached for \${planName} plan.\`);
    }
  }

  // Increment school (using sql.unsafe to bypass prepared-statement cache)
  if (type === 'document') {`;
const schoolIncrReplace = `    if (count >= currentLimits[type]) {
      throw new SubscriptionLimitError(\`Plan limit reached for \${planName} plan.\`);
    }
  }

  if (verifyOnly) return;

  // Increment school (using sql.unsafe to bypass prepared-statement cache)
  if (type === 'document') {`;
code = code.replace(schoolIncrTarget, schoolIncrReplace);

fs.writeFileSync('server.ts', code);
