import express from 'express';
const router = express.Router();

router.all('*', (req, res) => {
  console.log('Stub route hit:', req.method, req.url);
  res.json({ success: true, stub: true, data: [] });
});

export default router;
