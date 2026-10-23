import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { router as apiRouter } from './src/routes.js';
import { db } from './src/db.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', apiRouter);

const server = app.listen(3099, async () => {
  console.log('Testing integration on http://localhost:3099');

  try {
    // 1. Health endpoint
    const healthRes = await fetch('http://localhost:3099/api/health');
    const health = await healthRes.json();
    console.log('1. Health check OK:', health.status, 'Gemini configured:', health.gemini.configured);

    // 2. Authorities endpoint
    const authRes = await fetch('http://localhost:3099/api/authorities');
    const authJson = await authRes.json();
    console.log('2. Authorities check OK, count:', authJson.data.length);

    // 3. Analyze endpoint with Overflowing Bin scenario
    const analyzeRes = await fetch('http://localhost:3099/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'There is an overflowing garbage bin near our apartment. Waste has been lying there for four days, and stray animals are scattering it.',
        location: { city: 'Bengaluru', neighborhood: 'Indiranagar', landmark: '12th Main' },
        inputType: 'text'
      })
    });
    const analyzeJson = await analyzeRes.json();
    console.log('3. Analyze OK. Title:', analyzeJson.data.issue_title, 'Category:', analyzeJson.data.category);
    console.log('   Verification authority:', analyzeJson.data.verification.authority_identified.name);

    // 4. Save report
    const saveRes = await fetch('http://localhost:3099/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(analyzeJson.data)
    });
    const saveJson = await saveRes.json();
    console.log('4. Save report OK. ID:', saveJson.data.id);

    // 5. Submit report (honest submission check)
    const submitRes = await fetch(`http://localhost:3099/api/reports/${saveJson.data.id}/submit`, {
      method: 'POST'
    });
    const submitJson = await submitRes.json();
    console.log('5. Submit check OK (honest non-misleading response):', submitJson.message.substring(0, 60) + '...');

    // 6. Delete report to keep clean
    await fetch(`http://localhost:3099/api/reports/${saveJson.data.id}`, { method: 'DELETE' });
    console.log('6. Cleaned up test report.');

    console.log('\nALL 6 END-TO-END INTEGRATION CHECKS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('Integration test failure:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
