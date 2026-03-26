export default function handler(req, res) {
  console.log('Test endpoint hit');
  res.status(200).json({ message: 'Test works' });
}