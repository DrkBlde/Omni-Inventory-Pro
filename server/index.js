const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Omni Server is Running Offline');
});

app.listen(PORT, () => {
  console.log(`Backend Brain running at http://localhost:${PORT}`);
});