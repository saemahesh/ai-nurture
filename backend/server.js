const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// ...existing code...

app.use('/frontend', express.static(path.join(__dirname, 'public/frontend')));

// ...existing code...

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});